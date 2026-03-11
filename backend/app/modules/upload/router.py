from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.core.database import get_db
from app.modules.accounts.router import get_current_account_id
from app.modules.upload.service import UploadService
from app.modules.upload.schemas import UploadResponse, FileInfoResponse

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
    if not file.filename.endswith('.csv'):
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
