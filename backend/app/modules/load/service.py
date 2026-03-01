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
        
        for chunk in StreamingEngine.stream_csv(file_path, chunk_size=chunk_size):
            for record in chunk:
                row_number = record.get('_row_number', 0)
                
                # Skip invalid rows
                if row_number in invalid_row_numbers:
                    continue
                
                # Apply field mapping
                mapped_record = MappingEngine.apply_mapping(record, mapping)
                
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
                        trigger_interface
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
                trigger_interface
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
        trigger_interface: bool
    ) -> tuple[int, int]:
        """
        Load a single chunk to FSM.
        Returns: (success_count, failure_count)
        """
        try:
            # Call FSM batch create
            response = await fsm_client.batch_create_unreleased(
                business_class,
                records,
                trigger_interface
            )
            
            # Parse response
            success_count = response.get("success_count", 0)
            failure_count = response.get("failure_count", 0)
            
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
