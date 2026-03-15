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
        trigger_interface: bool = False,
        interface_params: Optional[Dict] = None
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
        
        if job.status not in ["validated", "completed"]:
            raise ValueError(f"Job must be validated before loading. Current status: {job.status}")
        
        # If job is completed, check if it had failures (meaning it was rolled back and can be retried)
        if job.status == "completed":
            from app.models.job import LoadResult
            load_results = db.query(LoadResult).filter(LoadResult.conversion_job_id == job_id).all()
            if load_results:
                # Check if any load had failures
                has_failures = any(result.failure_count > 0 for result in load_results)
                if not has_failures:
                    raise ValueError("Job has already been successfully loaded. Cannot load again.")
            # If no load results or had failures, allow retry
        
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
        
        # Generate unique RunGroup for this conversion run (max 30 characters)
        from datetime import datetime
        now = datetime.now()
        # Create 14-digit timestamp: YYYYMMDDHHMMSS + 2 microsecond digits for uniqueness
        base_timestamp = now.strftime("%Y%m%d%H%M%S")  # 14 digits
        microseconds = now.strftime("%f")[:2]  # First 2 microsecond digits
        timestamp = base_timestamp + microseconds  # Total: 16 digits
        
        # But we need exactly 14 digits to fit in 30 chars with longest business class names
        # So let's use just YYYYMMDDHHMMSS (14 digits) and add microseconds only if we have space
        timestamp = base_timestamp  # 14 digits: YYYYMMDDHHMMSS
        
        # Calculate available space for business class prefix
        # Format: <prefix>_<timestamp> = 30 chars total
        # Timestamp is 14 chars, underscore is 1 char
        # So prefix can be: 30 - 14 - 1 = 15 chars max
        max_prefix_length = 30 - len(timestamp) - 1
        
        # Truncate business class name if needed
        business_class_prefix = business_class[:max_prefix_length].upper()
        
        # Generate RunGroup with exact 30 character limit
        run_group = f"{business_class_prefix}_{timestamp}"
        
        # If we have extra space, we can add microseconds for better uniqueness
        if len(run_group) < 30:
            available_space = 30 - len(run_group)
            extra_microseconds = microseconds[:available_space]
            run_group = f"{business_class_prefix}_{timestamp}{extra_microseconds}"
        
        # Ensure it's exactly 30 characters or less
        if len(run_group) > 30:
            run_group = run_group[:30]
        
        logger.info(f"Generated unique RunGroup for conversion: {run_group} (length: {len(run_group)})")
        
        # Process file in chunks
        chunk_buffer = []
        chunk_num = 0
        total_success = 0
        total_failure = 0
        first_error_details = None  # Capture first error for user display
        
        for chunk in StreamingEngine.stream_csv(file_path, chunk_size=chunk_size):
            for record in chunk:
                row_number = record.get('_row_number', 0)
                
                # Skip invalid rows
                if row_number in invalid_row_numbers:
                    continue
                
                # Apply field mapping
                mapped_record = MappingEngine.apply_mapping(record, mapping)
                
                # Override RunGroup with our generated unique RunGroup
                # Find the RunGroup field in the mapped record and replace it
                for field_name in mapped_record.keys():
                    if 'rungroup' in field_name.lower():
                        mapped_record[field_name] = run_group
                        break
                
                # Remove internal fields
                mapped_record.pop('_row_number', None)
                
                chunk_buffer.append(mapped_record)
                
                # When buffer reaches chunk_size, send to FSM
                if len(chunk_buffer) >= chunk_size:
                    chunk_num += 1
                    success, failure, error_details = await LoadService._load_chunk(
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
                    
                    # Capture first error for display
                    if error_details and not first_error_details:
                        first_error_details = error_details
                    
                    chunk_buffer = []
        
        # Load remaining records
        if chunk_buffer:
            chunk_num += 1
            success, failure, error_details = await LoadService._load_chunk(
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
            
            # Capture first error for display
            if error_details and not first_error_details:
                first_error_details = error_details
        
        # Update final job status
        job.status = "completed"
        db.commit()
        
        logger.info(f"Load complete for job {job_id}: {total_success} success, {total_failure} failures")
        
        # If trigger_interface is enabled and load was successful, interface the transactions
        interface_result = None
        if trigger_interface and total_success > 0 and total_failure == 0 and run_group:
            logger.info(f"Triggering interface for RunGroup: {run_group} (waiting 3 seconds for FSM to process records)")
            
            # Wait 3 seconds to allow FSM to fully process the loaded records
            import asyncio
            await asyncio.sleep(3)
            
            logger.info(f"Starting interface for RunGroup: {run_group}")
            try:
                # Use interface parameters from frontend or defaults
                params = interface_params or {}
                
                interface_result = await LoadService.interface_transactions(
                    db=db,
                    account_id=account_id,
                    job_id=job_id,
                    business_class=business_class,
                    run_group=run_group,
                    enterprise_group=params.get("enterpriseGroup", ""),
                    accounting_entity=params.get("accountingEntity", ""),
                    edit_only=params.get("editOnly", False),
                    edit_and_interface=params.get("editAndInterface", True),
                    partial_update=params.get("partialUpdate", False),
                    journalize_by_entity=params.get("journalizeByEntity", True),
                    journal_by_journal_code=params.get("journalByJournalCode", False),
                    bypass_organization_code=params.get("bypassOrganizationCode", True),
                    bypass_account_code=params.get("bypassAccountCode", True),
                    bypass_structure_relation_edit=params.get("bypassStructureRelationEdit", False),
                    interface_in_detail=params.get("interfaceInDetail", True),
                    currency_table=params.get("currencyTable", ""),
                    bypass_negative_rate_edit=params.get("bypassNegativeRateEdit", False),
                    primary_ledger=params.get("primaryLedger", ""),
                    move_errors_to_new_run_group=False,
                    error_run_group_prefix=""
                )
                logger.info(f"Interface completed successfully for RunGroup: {run_group}")
            except Exception as e:
                logger.error(f"Interface failed for RunGroup {run_group}: {e}")
                # Don't fail the entire load if interface fails
                interface_result = {"error": str(e)}
        
        return {
            "total_success": total_success,
            "total_failure": total_failure,
            "chunks_processed": chunk_num,
            "run_group": run_group,
            "error_details": first_error_details,
            "interface_result": interface_result
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
    ) -> tuple[int, int, dict]:
        """
        Load a single chunk to FSM.
        If any record fails, rollback all successfully imported records for the RunGroup.
        Returns: (success_count, failure_count, error_details)
        """
        error_details = None
        
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
                
                # Capture error details from response
                error_details = {
                    "chunk_number": chunk_num,
                    "failure_count": failure_count,
                    "fsm_response": response
                }
                
                try:
                    await fsm_client.delete_all_transactions_for_run_group(
                        business_class,
                        run_group
                    )
                    logger.info(f"Rollback successful for RunGroup: {run_group}")
                except Exception as rollback_error:
                    logger.error(f"Rollback failed: {rollback_error}")
                    error_details["rollback_error"] = str(rollback_error)
            
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
            
            return success_count, failure_count, error_details
            
        except Exception as e:
            logger.error(f"Failed to load chunk {chunk_num}: {e}")
            
            # Capture exception details
            error_details = {
                "chunk_number": chunk_num,
                "exception": str(e),
                "exception_type": type(e).__name__
            }
            
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
            
            return 0, len(records), error_details
    
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
        logger.info(f"Waiting 5 seconds for FSM to process interface, then querying results for RunGroup: {run_group}")
        
        # Wait for FSM to process the interface (interface is asynchronous in FSM)
        import asyncio
        await asyncio.sleep(5)
        
        # Query interface results with retry logic (interface may take time to complete)
        summary = None
        error_details = []
        max_retries = 3
        retry_delay = 3
        
        for attempt in range(max_retries):
            try:
                summary = await fsm_client.query_gl_transaction_interface_result(run_group)
                if summary:
                    # If there are errors, get detailed error information
                    if summary.get('records_with_error', 0) > 0:
                        logger.info(f"Interface has {summary['records_with_error']} errors, fetching detailed error information...")
                        error_details = await fsm_client.query_gl_transaction_interface_errors(run_group)
                    break
                else:
                    logger.info(f"No interface result found yet (attempt {attempt + 1}/{max_retries}), retrying in {retry_delay} seconds...")
                    if attempt < max_retries - 1:  # Don't sleep on last attempt
                        await asyncio.sleep(retry_delay)
            except Exception as e:
                logger.warning(f"Failed to query interface result (attempt {attempt + 1}/{max_retries}): {e}")
                if attempt < max_retries - 1:  # Don't sleep on last attempt
                    await asyncio.sleep(retry_delay)
        
        if summary:
            logger.info(f"Interface result: Status={summary['status_label']}, {summary['total_records']} processed, {summary['successfully_imported']} imported, {summary['records_with_error']} errors")
            
            # Determine if interface was truly successful
            interface_successful = summary.get('interface_successful', False)
            
            return {
                "api_response": result,
                "interface_successful": interface_successful,
                "verification": {
                    "result_sequence": summary["result_sequence"],
                    "status": summary["status"],
                    "status_label": summary["status_label"],
                    "total_records": summary["total_records"],
                    "successfully_imported": summary["successfully_imported"],
                    "records_with_error": summary["records_with_error"],
                    "run_group": summary["run_group"]
                },
                "error_details": error_details  # Include detailed error information
            }
        else:
            logger.warning(f"No interface result found for RunGroup: {run_group} after {max_retries} attempts")
            return {
                "api_response": result,
                "interface_successful": False,
                "verification": None,
                "error_details": [],
                "error": "Could not verify interface results - no GLTransactionInterfaceResult found"
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
