"""
Workflow Orchestrator Service

Manages end-to-end conversion workflows.
Orchestrates: upload → schema → mapping → validation → load
"""

from typing import Optional, Dict
from sqlalchemy.orm import Session
from pathlib import Path
from app.modules.upload.service import UploadService
from app.modules.schema.service import SchemaService
from app.modules.mapping.service import MappingService
from app.modules.validation.service import ValidationService
from app.modules.load.service import LoadService
from app.core.logging import logger


class WorkflowOrchestrator:
    """Service for orchestrating multi-step conversion workflows"""
    
    @staticmethod
    async def run_full_conversion(
        db: Session,
        account_id: int,
        file_path: str,
        business_class: str,
        load_to_fsm: bool = False,
        template_id: Optional[int] = None,
        enable_rules: bool = True
    ) -> Dict:
        """
        Run complete conversion workflow.
        
        Steps:
        1. Upload file
        2. Fetch schema (latest version)
        3. Auto-map fields (or apply template)
        4. Start validation
        5. Optionally load to FSM
        
        Args:
            db: Database session
            account_id: Account ID
            file_path: Path to CSV file
            business_class: FSM business class name
            load_to_fsm: Whether to load valid records to FSM
            template_id: Optional mapping template ID
            enable_rules: Whether to enable validation rules
            
        Returns:
            dict with job_id, status, and steps completed
        """
        steps_completed = []
        
        try:
            logger.info(f"Starting full conversion workflow for {business_class}")
            
            # Step 1: Upload file
            logger.info("Step 1: Uploading file...")
            file_obj = Path(file_path)
            
            if not file_obj.exists():
                raise ValueError(f"File not found: {file_path}")
            
            # Create a mock UploadFile object
            from fastapi import UploadFile
            from io import BytesIO
            
            with open(file_path, 'rb') as f:
                file_content = f.read()
            
            upload_file = UploadFile(
                filename=file_obj.name,
                file=BytesIO(file_content)
            )
            
            upload_result = await UploadService.handle_upload(
                db,
                account_id,
                upload_file,
                business_class
            )
            
            job_id = upload_result["job_id"]
            steps_completed.append("upload")
            logger.info(f"✓ Upload complete. Job ID: {job_id}")
            
            # Step 2: Get existing schema (no auto-fetch)
            logger.info("Step 2: Getting existing schema...")
            schema = SchemaService.get_latest_schema(db, account_id, business_class)
            
            if not schema:
                raise ValueError(
                    f"No schema found for business class '{business_class}'. "
                    f"Please upload a schema via the Schema Management page first."
                )
            
            steps_completed.append("schema")
            logger.info(f"✓ Using existing schema. Version: {schema.version_number}")
            
            # Step 3: Auto-map fields or apply template
            logger.info("Step 3: Mapping fields...")
            if template_id:
                # Apply template (future implementation)
                logger.info(f"Applying template {template_id}...")
                mapping_result = await MappingService.auto_map(
                    db,
                    account_id,
                    job_id,
                    business_class
                )
            else:
                # Auto-map
                mapping_result = await MappingService.auto_map(
                    db,
                    account_id,
                    job_id,
                    business_class
                )
            
            mapping = mapping_result["mapping"]
            steps_completed.append("mapping")
            logger.info(f"✓ Mapping complete. {len(mapping)} fields mapped")
            
            # Step 4: Start validation
            logger.info("Step 4: Starting validation...")
            await ValidationService.start_validation(
                db,
                account_id,
                job_id,
                business_class,
                mapping,
                enable_rules
            )
            steps_completed.append("validation")
            logger.info("✓ Validation started")
            
            # Step 5: Optionally load to FSM
            if load_to_fsm:
                logger.info("Step 5: Loading to FSM...")
                load_result = await LoadService.start_load(
                    db,
                    account_id,
                    job_id,
                    business_class,
                    mapping,
                    chunk_size=100,
                    trigger_interface=True
                )
                steps_completed.append("load")
                logger.info(f"✓ Load complete. {load_result.get('total_loaded', 0)} records loaded")
            
            logger.info(f"✓ Full conversion workflow complete for job {job_id}")
            
            return {
                "job_id": job_id,
                "status": "started",
                "steps_completed": steps_completed,
                "business_class": business_class,
                "filename": upload_result["filename"]
            }
            
        except Exception as e:
            logger.error(f"Workflow failed at step {len(steps_completed) + 1}: {e}", exc_info=True)
            raise
