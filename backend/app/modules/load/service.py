from sqlalchemy.orm import Session
from typing import Dict, List, Optional
from app.models.job import ConversionJob, LoadResult
from app.services.fsm_client import FSMClient
from app.services.streaming_engine import StreamingEngine
from app.services.mapping_engine import MappingEngine
from app.modules.schema.service import SchemaService
from app.modules.upload.service import UploadService
from app.modules.accounts.service import AccountService
from app.core.logging import logger
import json

class LoadService:
    @staticmethod
    async def start_load(
        db: Session,
        account_id: int,
        job_id: int,
        business_class: str,
        mapping: Dict,
        chunk_size: int = 100,
        trigger_interface: bool = False
    ):
        """
        Load validated records to FSM in chunks.
        Only loads valid records (skips records with validation errors).
        """
        # Get job
        job = db.query(ConversionJob).filter(
            ConversionJob.id == job_id,
            ConversionJob.account_id == account_id
        ).first()
        
        if not job:
            raise ValueError("Job not found")
        
        if job.status != "validated":
            raise ValueError(f"Job must be validated before loading. Current status: {job.status}")
        
        # Update job status
        job.status = "loading"
        db.commit()
        
        # Get account credentials
        account = AccountService.get_account_by_id(db, account_id)
        if not account:
            raise ValueError("Account not found")
        
        credentials = AccountService.get_decrypted_credentials(account)
        
        # Initialize FSM client
        fsm_client = FSMClient(
            base_url=credentials["base_url"],
            oauth_url=credentials["oauth_url"],
            tenant_id=credentials["tenant_id"],
            client_id=credentials["client_id"],
            client_secret=credentials["client_secret"],
            saak=credentials["saak"],
            sask=credentials["sask"]
        )
        
        # Authenticate
        await fsm_client.authenticate()
        
        # Get file path
        file_path = UploadService.get_file_path(job_id)
        
        # Get validation errors to skip invalid rows
        from app.models.job import ValidationError as ValidationErrorModel
        invalid_rows = set(
            db.query(ValidationErrorModel.row_number)
            .filter(ValidationErrorModel.conversion_job_id == job_id)
            .distinct()
            .all()
        )
        invalid_row_numbers = {row[0] for row in invalid_rows}
        
        logger.info(f"Starting load for job {job_id}. Skipping {len(invalid_row_numbers)} invalid rows.")
        
        # Process file in chunks
        chunk_buffer = []
        chunk_num = 0
        total_success = 0
        total_failure = 0
        run_group = None  # Extract RunGroup from first record
        
        for chunk in StreamingEngine.stream_csv(file_path, chunk_size=chunk_size):
            for record in chunk:
                row_number = record.get('_row_number', 0)
                
                # Skip invalid rows
                if row_number in invalid_row_numbers:
                    continue
                
                # Apply field mapping
                mapped_record = MappingEngine.apply_mapping(record, mapping)
                
                # Extract RunGroup from first record (for rollback if needed)
                if run_group is None:
                    run_group = mapped_record.get('GLTransactionInterface.RunGroup')
                
                # Remove internal fields
                mapped_record.pop('_row_number', None)
                
                chunk_buffer.append(mapped_record)
                
                # When buffer reaches chunk_size, send to FSM
                if len(chunk_buffer) >= chunk_size:
                    chunk_num += 1
                    success, failure = await LoadService._load_chunk(
                        db,
                        fsm_client,
                        business_class,
                        chunk_buffer,
                        job_id,
                        chunk_num,
                        trigger_interface,
                        run_group
                    )
                    total_success += success
                    total_failure += failure
                    chunk_buffer = []
        
        # Load remaining records
        if chunk_buffer:
            chunk_num += 1
            success, failure = await LoadService._load_chunk(
                db,
                fsm_client,
                business_class,
                chunk_buffer,
                job_id,
                chunk_num,
                trigger_interface,
                run_group
            )
            total_success += success
            total_failure += failure
        
        # Update final job status
        job.status = "completed"
        db.commit()
        
        logger.info(f"Load complete for job {job_id}: {total_success} success, {total_failure} failures")
        
        return {
            "total_success": total_success,
            "total_failure": total_failure,
            "chunks_processed": chunk_num
        }
    
    @staticmethod
    async def _load_chunk(
        db: Session,
        fsm_client: FSMClient,
        business_class: str,
        records: List[Dict],
        job_id: int,
        chunk_num: int,
        trigger_interface: bool,
        run_group: str = None
    ) -> tuple[int, int]:
        """
        Load a single chunk to FSM.
        If any record fails, rollback all successfully imported records for the RunGroup.
        Returns: (success_count, failure_count)
        """
        try:
            # Call FSM batch create
            response = await fsm_client.batch_create_unreleased(
                business_class,
                records,
                trigger_interface
            )
            
            # Parse response (FSM uses camelCase)
            success_count = response.get("successCount", response.get("success_count", 0))
            failure_count = response.get("failureCount", response.get("failure_count", 0))
            
            # CRITICAL: If any record failed, rollback all successfully imported records
            if failure_count > 0 and run_group:
                logger.warning(f"Chunk {chunk_num} has {failure_count} failures. Rolling back all records for RunGroup: {run_group}")
                
                try:
                    await fsm_client.delete_all_transactions_for_run_group(
                        business_class,
                        run_group
                    )
                    logger.info(f"Rollback successful for RunGroup: {run_group}")
                except Exception as rollback_error:
                    logger.error(f"Rollback failed: {rollback_error}")
                    # Continue to store the error result
            
            # Store load result
            load_result = LoadResult(
                conversion_job_id=job_id,
                chunk_number=chunk_num,
                success_count=success_count,
                failure_count=failure_count,
                fsm_response=json.dumps(response)
            )
            db.add(load_result)
            db.commit()
            
            logger.info(f"Chunk {chunk_num} loaded: {success_count} success, {failure_count} failures")
            
            return success_count, failure_count
            
        except Exception as e:
            logger.error(f"Failed to load chunk {chunk_num}: {e}")
            
            # Store failure result
            load_result = LoadResult(
                conversion_job_id=job_id,
                chunk_number=chunk_num,
                success_count=0,
                failure_count=len(records),
                fsm_response=json.dumps({"error": str(e)})
            )
            db.add(load_result)
            db.commit()
            
            return 0, len(records)
    
    @staticmethod
    async def interface_transactions(
        db: Session,
        account_id: int,
        job_id: int,
        business_class: str,
        run_group: str,
        enterprise_group: str = "",
        accounting_entity: str = "",
        edit_only: bool = False,
        edit_and_interface: bool = False,
        partial_update: bool = False,
        journalize_by_entity: bool = True,
        journal_by_journal_code: bool = False,
        bypass_organization_code: bool = True,
        bypass_account_code: bool = True,
        bypass_structure_relation_edit: bool = False,
        interface_in_detail: bool = True,
        currency_table: str = "",
        bypass_negative_rate_edit: bool = False,
        primary_ledger: str = "",
        move_errors_to_new_run_group: bool = False,
        error_run_group_prefix: str = ""
    ):
        """
        Interface (post/journalize) transactions for a specific RunGroup.
        """
        # Get job
        job = db.query(ConversionJob).filter(
            ConversionJob.id == job_id,
            ConversionJob.account_id == account_id
        ).first()
        
        if not job:
            raise ValueError("Job not found")
        
        # Get account credentials
        account = AccountService.get_account_by_id(db, account_id)
        if not account:
            raise ValueError("Account not found")
        
        credentials = AccountService.get_decrypted_credentials(account)
        
        # Initialize FSM client
        fsm_client = FSMClient(
            base_url=credentials["base_url"],
            oauth_url=credentials["oauth_url"],
            tenant_id=credentials["tenant_id"],
            client_id=credentials["client_id"],
            client_secret=credentials["client_secret"],
            saak=credentials["saak"],
            sask=credentials["sask"]
        )
        
        # Authenticate
        await fsm_client.authenticate()
        
        # Call interface transactions
        result = await fsm_client.interface_transactions(
            business_class=business_class,
            run_group=run_group,
            enterprise_group=enterprise_group,
            accounting_entity=accounting_entity,
            edit_only=edit_only,
            edit_and_interface=edit_and_interface,
            partial_update=partial_update,
            journalize_by_entity=journalize_by_entity,
            journal_by_journal_code=journal_by_journal_code,
            bypass_organization_code=bypass_organization_code,
            bypass_account_code=bypass_account_code,
            bypass_structure_relation_edit=bypass_structure_relation_edit,
            interface_in_detail=interface_in_detail,
            currency_table=currency_table,
            bypass_negative_rate_edit=bypass_negative_rate_edit,
            primary_ledger=primary_ledger,
            move_errors_to_new_run_group=move_errors_to_new_run_group,
            error_run_group_prefix=error_run_group_prefix
        )
        
        logger.info(f"Interface API call completed for job {job_id}, RunGroup: {run_group}")
        
        # CRITICAL: Query GLTransactionInterfaceResult to verify actual interface results
        # The interface API call success doesn't mean records were actually posted to GL
        # We must query GLTransactionInterfaceResult to get the summary
        logger.info(f"Querying GLTransactionInterfaceResult to verify interface results for RunGroup: {run_group}")
        
        summary = await fsm_client.query_gl_transaction_interface_result(run_group)
        
        if summary:
            logger.info(f"Interface result: Status={summary['status_label']}, {summary['records_processed']} processed, {summary['records_imported']} imported, {summary['records_with_error']} errors")
            
            return {
                "api_response": result,
                "verification": {
                    "result_sequence": summary["result_sequence"],
                    "status": summary["status"],
                    "status_label": summary["status_label"],
                    "records_processed": summary["records_processed"],
                    "records_imported": summary["records_imported"],
                    "records_with_error": summary["records_with_error"],
                    "run_group": summary["run_group"]
                }
            }
        else:
            logger.warning(f"No interface result found for RunGroup: {run_group}")
            return {
                "api_response": result,
                "verification": None
            }
    
    @staticmethod
    async def check_run_group_exists(
        db: Session,
        account_id: int,
        job_id: int,
        run_group: str
    ):
        """
        Check if a RunGroup already exists in FSM before loading.
        Returns count of existing records.
        """
        # Get job
        job = db.query(ConversionJob).filter(
            ConversionJob.id == job_id,
            ConversionJob.account_id == account_id
        ).first()
        
        if not job:
            raise ValueError("Job not found")
        
        # Get account credentials
        account = AccountService.get_account_by_id(db, account_id)
        if not account:
            raise ValueError("Account not found")
        
        credentials = AccountService.get_decrypted_credentials(account)
        
        # Initialize FSM client
        fsm_client = FSMClient(
            base_url=credentials["base_url"],
            oauth_url=credentials["oauth_url"],
            tenant_id=credentials["tenant_id"],
            client_id=credentials["client_id"],
            client_secret=credentials["client_secret"],
            saak=credentials["saak"],
            sask=credentials["sask"]
        )
        
        # Authenticate
        await fsm_client.authenticate()
        
        # Check if RunGroup exists
        result = await fsm_client.check_run_group_exists(run_group)
        
        logger.info(f"RunGroup check for job {job_id}: {result}")
        
        return result
    
    @staticmethod
    async def delete_run_group(
        db: Session,
        account_id: int,
        job_id: int,
        business_class: str,
        run_group: str
    ):
        """
        Delete all transactions for a specific RunGroup.
        Useful for testing and cleanup.
        """
        # Get job
        job = db.query(ConversionJob).filter(
            ConversionJob.id == job_id,
            ConversionJob.account_id == account_id
        ).first()
        
        if not job:
            raise ValueError("Job not found")
        
        # Get account credentials
        account = AccountService.get_account_by_id(db, account_id)
        if not account:
            raise ValueError("Account not found")
        
        credentials = AccountService.get_decrypted_credentials(account)
        
        # Initialize FSM client
        fsm_client = FSMClient(
            base_url=credentials["base_url"],
            oauth_url=credentials["oauth_url"],
            tenant_id=credentials["tenant_id"],
            client_id=credentials["client_id"],
            client_secret=credentials["client_secret"],
            saak=credentials["saak"],
            sask=credentials["sask"]
        )
        
        # Authenticate
        await fsm_client.authenticate()
        
        # Delete all transactions for RunGroup
        result = await fsm_client.delete_all_transactions_for_run_group(
            business_class=business_class,
            run_group=run_group
        )
        
        logger.info(f"Deleted all transactions for job {job_id}, RunGroup: {run_group}")
        
        return result
    
    @staticmethod
    def get_load_results(
        db: Session,
        account_id: int,
        job_id: int
    ) -> Optional[Dict]:
        """Get load results summary"""
        job = db.query(ConversionJob).filter(
            ConversionJob.id == job_id,
            ConversionJob.account_id == account_id
        ).first()
        
        if not job:
            return None
        
        # Get all load results
        results = db.query(LoadResult).filter(
            LoadResult.conversion_job_id == job_id
        ).order_by(LoadResult.chunk_number).all()
        
        total_success = sum(r.success_count for r in results)
        total_failure = sum(r.failure_count for r in results)
        
        return {
            "job_id": job_id,
            "status": job.status,
            "total_success": total_success,
            "total_failure": total_failure,
            "chunks_processed": len(results),
            "chunks": [
                {
                    "chunk_number": r.chunk_number,
                    "success_count": r.success_count,
                    "failure_count": r.failure_count,
                    "created_at": r.created_at.isoformat() if r.created_at else None
                }
                for r in results
            ]
        }

    async def get_interface_results(self, job_id: int, run_group: str) -> Dict:
        """
        Query GLTransactionInterface records to check interface status.
        Returns records with error messages and summary statistics.
        """
        # Get account and FSM credentials
        account = self.db.query(Account).filter(Account.id == self.account_id).first()
        if not account:
            raise Exception("Account not found")
        
        # Decrypt FSM credentials
        credentials = encryption.decrypt(account.fsm_credentials)
        
        # Initialize FSM client
        fsm_client = FSMClient(
            base_url=credentials["base_url"],
            oauth_url=credentials["oauth_url"],
            tenant_id=credentials["tenant_id"],
            client_id=credentials["client_id"],
            client_secret=credentials["client_secret"],
            saak=credentials["saak"],
            sask=credentials["sask"]
        )
        
        # Query GLTransactionInterface records
        records = await fsm_client.query_gl_transaction_interface(run_group)
        
        # Analyze results
        total_records = len(records)
        records_with_errors = sum(1 for r in records if r.get(" ErrorMessage", "").strip())
        records_without_errors = total_records - records_with_errors
        
        return {
            "total_records": total_records,
            "records_with_errors": records_with_errors,
            "records_without_errors": records_without_errors,
            "records": records
        }
