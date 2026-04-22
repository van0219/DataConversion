from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.core.database import get_db
from app.modules.accounts.router import get_current_account_id
from app.modules.upload.service import UploadService
from app.modules.upload.schemas import UploadResponse, FileInfoResponse
from app.services.business_class_detector import BusinessClassDetector

class InterfaceJobRequest(BaseModel):
    job_id: int
    run_group: str
    enterprise_group: str = ""
    accounting_entity: str = ""
    edit_only: bool = False
    edit_and_interface: bool = False
    partial_update: bool = False
    journalize_by_entity: bool = True
    journal_by_journal_code: bool = False
    bypass_organization_code: bool = True
    bypass_account_code: bool = True
    bypass_structure_relation_edit: bool = False
    interface_in_detail: bool = True
    currency_table: str = ""
    bypass_negative_rate_edit: bool = False
    primary_ledger: str = ""
    move_errors_to_new_run_group: bool = False
    error_run_group_prefix: str = ""

router = APIRouter()

@router.post("/detect")
def detect_business_class_structure(
    filename: str,
    db: Session = Depends(get_db)
):
    """
    Auto-detect business class structure from filename.
    
    Returns detection result with structure type, table count, and related tables.
    """
    try:
        result = BusinessClassDetector.detect_from_filename(db, filename)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Detection failed: {str(e)}"
        )

@router.post("/", response_model=UploadResponse)
async def upload_file(
    file: UploadFile = File(...),
    business_class: str = Form(None),
    account_id: int = Depends(get_current_account_id),
    db: Session = Depends(get_db)
):
    """
    Upload CSV file and create conversion job.
    Returns job_id and file metadata.
    """
    # Validate file type
    if not file.filename.lower().endswith('.csv'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only CSV files are supported"
        )
    
    try:
        result = await UploadService.handle_upload(
            db,
            account_id,
            file,
            business_class
        )
        return UploadResponse(**result)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Upload failed: {str(e)}"
        )

@router.get("/{job_id}/info", response_model=FileInfoResponse)
def get_file_info(
    job_id: int,
    account_id: int = Depends(get_current_account_id),
    db: Session = Depends(get_db)
):
    """Get file information for uploaded job"""
    info = UploadService.get_file_info(db, account_id, job_id)
    
    if not info:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found"
        )
    
    return FileInfoResponse(**info)

@router.get("/{job_id}/sample-data")
def get_job_sample_data(
    job_id: int,
    account_id: int = Depends(get_current_account_id),
    db: Session = Depends(get_db)
):
    """Get sample data from the CSV file for a job"""
    from app.models.job import ConversionJob
    from app.services.streaming_engine import StreamingEngine
    
    # Verify job belongs to account
    job = db.query(ConversionJob).filter(
        ConversionJob.id == job_id,
        ConversionJob.account_id == account_id
    ).first()
    
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found"
        )
    
    try:
        # Get file path
        file_path = UploadService.get_file_path(job_id)
        
        if not file_path.exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="CSV file not found"
            )
        
        # Get sample records (increase sample size for better frequency analysis)
        headers = StreamingEngine.get_csv_headers(file_path)
        sample_records = StreamingEngine.get_sample_records(file_path, sample_size=20)
        
        return {
            "job_id": job_id,
            "headers": headers,
            "sample_records": sample_records,
            "sample_size": len(sample_records)
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get sample data: {str(e)}"
        )

@router.get("/jobs/recent")
def get_recent_jobs(
    limit: int = 5,
    offset: int = 0,
    account_id: int = Depends(get_current_account_id),
    db: Session = Depends(get_db)
):
    """Get recent conversion jobs for the account with pagination"""
    from app.models.job import ConversionJob, LoadResult
    from sqlalchemy import func
    
    # Get total count
    total_count = db.query(ConversionJob).filter(
        ConversionJob.account_id == account_id
    ).count()
    
    # Get paginated jobs with load results
    jobs = db.query(ConversionJob).filter(
        ConversionJob.account_id == account_id
    ).order_by(
        ConversionJob.created_at.desc()
    ).limit(limit).offset(offset).all()
    
    # Enhance each job with accurate load status and interface capability
    enhanced_jobs = []
    for job in jobs:
        # Check if job has load results
        load_results = db.query(LoadResult).filter(
            LoadResult.conversion_job_id == job.id
        ).all()
        
        # Determine actual status based on job status and load results
        actual_status = job.status
        load_success_count = 0
        load_failure_count = 0
        run_group = None
        can_interface = False
        
        if load_results:
            load_success_count = sum(r.success_count for r in load_results)
            load_failure_count = sum(r.failure_count for r in load_results)
            
            # Extract run_group from FSM response (if available)
            for result in load_results:
                if result.fsm_response:
                    try:
                        import json
                        response_data = json.loads(result.fsm_response)
                        if 'run_group' in response_data:
                            run_group = response_data['run_group']
                            break
                    except:
                        pass
            
            # If we have load results, determine the actual load status
            if load_failure_count > 0:
                actual_status = "load_failed"  # Some records failed to load
            elif load_success_count > 0:
                actual_status = "loaded"  # Successfully loaded to FSM
                can_interface = True  # Can interface loaded records
            else:
                actual_status = "load_failed"  # Load attempted but no success
        elif job.status == "completed":
            # Job marked as completed but no load results = validation only
            actual_status = "validated"
        
        enhanced_jobs.append({
            "id": job.id,
            "business_class": job.business_class,
            "filename": job.filename,
            "total_records": job.total_records,
            "valid_records": job.valid_records,
            "invalid_records": job.invalid_records,
            "status": actual_status,
            "load_success_count": load_success_count,
            "load_failure_count": load_failure_count,
            "run_group": run_group,
            "can_interface": can_interface,
            "created_at": job.created_at.isoformat() if job.created_at else None,
            "completed_at": job.completed_at.isoformat() if job.completed_at else None
        })
    
    return {
        "jobs": enhanced_jobs,
        "total": total_count,
        "limit": limit,
        "offset": offset
    }

@router.post("/jobs/{job_id}/interface")
async def interface_job_transactions(
    job_id: int,
    request: InterfaceJobRequest,
    account_id: int = Depends(get_current_account_id),
    db: Session = Depends(get_db)
):
    """Interface (post/journalize) transactions for a loaded job"""
    from app.modules.load.service import LoadService
    
    # Verify job belongs to account
    from app.models.job import ConversionJob
    job = db.query(ConversionJob).filter(
        ConversionJob.id == job_id,
        ConversionJob.account_id == account_id
    ).first()
    
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found"
        )
    
    try:
        result = await LoadService.interface_transactions(
            db=db,
            account_id=account_id,
            job_id=job_id,
            business_class=job.business_class,
            run_group=request.run_group,
            enterprise_group=request.enterprise_group,
            accounting_entity=request.accounting_entity,
            edit_only=request.edit_only,
            edit_and_interface=request.edit_and_interface,
            partial_update=request.partial_update,
            journalize_by_entity=request.journalize_by_entity,
            journal_by_journal_code=request.journal_by_journal_code,
            bypass_organization_code=request.bypass_organization_code,
            bypass_account_code=request.bypass_account_code,
            bypass_structure_relation_edit=request.bypass_structure_relation_edit,
            interface_in_detail=request.interface_in_detail,
            currency_table=request.currency_table,
            bypass_negative_rate_edit=request.bypass_negative_rate_edit,
            primary_ledger=request.primary_ledger,
            move_errors_to_new_run_group=request.move_errors_to_new_run_group,
            error_run_group_prefix=request.error_run_group_prefix
        )
        
        return {
            "message": "Interface completed successfully",
            "job_id": job_id,
            "run_group": request.run_group,
            "result": result
        }
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Interface failed: {str(e)}"
        )


# ── Batch Upload Endpoints ───────────────────────────────────────────────────

from fastapi import BackgroundTasks
from typing import List as TypingList
import uuid, asyncio, shutil, os


@router.post("/batch")
async def start_batch_upload(
    background_tasks: BackgroundTasks,
    files: TypingList[UploadFile] = File(...),
    business_class: str = Form(""),
    rule_set_id: int = Form(0),
    date_source_format: str = Form(""),
    account_id: int = Depends(get_current_account_id),
    db: Session = Depends(get_db)
):
    """
    Accept multiple CSV files and process them sequentially in the background.
    Each file goes through: upload → auto-map → validate.
    Returns a batch_id for polling progress.
    """
    from app.services.batch_progress import batch_progress
    from app.core.database import SessionLocal
    from app.modules.accounts.service import AccountService
    from app.modules.upload.service import UploadService
    from app.modules.mapping.service import MappingService
    from app.modules.validation.service import ValidationService
    from app.core.logging import logger

    if not files:
        raise HTTPException(status_code=400, detail="No files provided")

    batch_id = str(uuid.uuid4())[:12]
    filenames = [f.filename for f in files]
    batch_progress.start(batch_id, filenames)

    # Save files temporarily using UploadService.UPLOAD_DIR (same as single upload)
    UploadService._ensure_upload_dir()
    saved_files = {}
    for f in files:
        temp_path = str(UploadService.UPLOAD_DIR / f"batch_{batch_id}_{f.filename}")
        content = await f.read()
        with open(temp_path, "wb") as out:
            out.write(content)
        saved_files[f.filename] = temp_path

    # Get account credentials
    account = AccountService.get_account_by_id(db, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    credentials = AccountService.get_decrypted_credentials(account)

    # Capture business class and rule set for background task
    batch_bc = business_class.strip() if business_class.strip() else None
    batch_rs_id = rule_set_id if rule_set_id > 0 else None
    batch_date_fmt = date_source_format.strip() if date_source_format.strip() else None

    async def process_batch():
        for filename in filenames:
            if batch_progress.is_cancelled(batch_id):
                break

            temp_path = saved_files.get(filename)
            if not temp_path:
                batch_progress.fail_file(batch_id, filename, "File not found")
                continue

            batch_db = SessionLocal()
            try:
                # Step 1: Upload
                batch_progress.update_file(batch_id, filename, status="uploading")
                logger.info(f"Batch {batch_id}: uploading {filename}")

                # Use user-provided business class, fallback to filename detection
                bc_name = batch_bc or (filename.split('_')[0] if '_' in filename else filename.replace('.csv', ''))

                # Create job via upload service (from saved file path)
                from app.models.job import ConversionJob
                from app.services.streaming_engine import StreamingEngine
                from pathlib import Path

                UploadService._ensure_upload_dir()

                job = ConversionJob(
                    account_id=account_id,
                    business_class=bc_name,
                    filename=filename,
                    total_records=0,
                    status="pending"
                )
                batch_db.add(job)
                batch_db.commit()
                batch_db.refresh(job)
                job_id = job.id

                # Copy temp file to uploads/ with job_id name
                stored_path = UploadService.UPLOAD_DIR / f"{job_id}.csv"
                shutil.copy2(temp_path, str(stored_path))

                headers = StreamingEngine.get_csv_headers(stored_path)
                total_records = StreamingEngine.estimate_record_count(stored_path)
                job.total_records = total_records
                batch_db.commit()

                batch_progress.update_file(batch_id, filename, job_id=job_id, records=total_records)

                # Step 2: Auto-map
                batch_progress.update_file(batch_id, filename, status="mapping")
                logger.info(f"Batch {batch_id}: mapping {filename} (job {job_id})")

                mapping_result = await MappingService.auto_map(batch_db, account_id, job_id, bc_name)
                mapping = mapping_result.get("mapping", {})

                # Store mapping in batch progress for later use during load
                batch_progress.update_file(batch_id, filename, mapping=mapping)

                # Step 3: Validate
                batch_progress.update_file(batch_id, filename, status="validating")
                logger.info(f"Batch {batch_id}: validating {filename} (job {job_id})")

                # Get rule set: use user-selected or fall back to default
                from app.modules.rules.rule_set_service import RuleSetService
                rs_id = batch_rs_id
                if not rs_id:
                    default_rs = RuleSetService.get_common_rule_set(batch_db, bc_name)
                    rs_id = default_rs.id if default_rs else None

                await ValidationService.start_validation(
                    batch_db, account_id, job_id, bc_name, mapping,
                    enable_rules=True, selected_rule_set_id=rs_id,
                    date_source_format=batch_date_fmt
                )

                # Read final job stats
                from app.models.job import ConversionJob
                job = batch_db.query(ConversionJob).filter(ConversionJob.id == job_id).first()
                valid = job.valid_records if job else 0
                invalid = job.invalid_records if job else 0

                batch_progress.complete_file(
                    batch_id, filename,
                    records=valid + invalid, valid=valid, invalid=invalid, errors=invalid
                )
                logger.info(f"Batch {batch_id}: {filename} done — {valid} valid, {invalid} invalid")

                # Brief pause between files to avoid hammering FSM
                await asyncio.sleep(1.5)

            except Exception as e:
                logger.error(f"Batch {batch_id}: {filename} failed — {e}")
                batch_progress.fail_file(batch_id, filename, str(e)[:200])
            finally:
                batch_db.close()

        batch_progress.finish(batch_id)
        logger.info(f"Batch {batch_id} complete")

    background_tasks.add_task(process_batch)

    return {"batch_id": batch_id, "total": len(filenames)}


@router.get("/batch-status")
def get_batch_status(batch_id: str):
    """Get progress of a batch upload."""
    from app.services.batch_progress import batch_progress
    result = batch_progress.get(batch_id)
    if not result:
        return {"running": False, "files": {}, "completed": 0, "total": 0}
    return result


class BatchCancelRequest(BaseModel):
    batch_id: str

@router.post("/batch-cancel")
def cancel_batch(request: BatchCancelRequest):
    """Cancel a running batch."""
    from app.services.batch_progress import batch_progress
    batch_progress.cancel(request.batch_id)
    return {"status": "cancelled"}
