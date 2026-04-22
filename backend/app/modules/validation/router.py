from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.core.logging import logger
from app.modules.accounts.router import get_current_account_id
from app.modules.validation.service import ValidationService
from app.modules.validation.schemas import (
    ValidationStartRequest,
    ValidationProgress,
    ValidationSummary,
    ValidationErrorItem
)
from app.models.job import ConversionJob

router = APIRouter()

@router.post("/start")
async def start_validation(
    request: ValidationStartRequest,
    account_id: int = Depends(get_current_account_id),
    db: Session = Depends(get_db)
):
    """Start validation process for uploaded file - BLOCKING until complete"""
    try:
        logger.info(f"DEBUG: start_validation called with job_id={request.job_id}, account_id={account_id}")
        
        # Get job
        job = db.query(ConversionJob).filter(
            ConversionJob.id == request.job_id,
            ConversionJob.account_id == account_id
        ).first()
        
        if not job:
            logger.error(f"DEBUG: Job {request.job_id} not found with account_id={account_id}")
            raise ValueError(f"Job {request.job_id} not found")
        
        logger.info(f"DEBUG: Job found, starting validation")
        
        # Run validation synchronously - blocks until complete
        await ValidationService.start_validation(
            db,
            account_id,
            request.job_id,
            request.business_class,
            request.mapping,
            request.enable_rules,
            request.selected_rule_set_id,
            request.date_source_format
        )
        
        logger.info(f"DEBUG: Validation complete, returning response")
        
        # Return only after validation is complete
        return {"message": "Validation completed", "job_id": request.job_id}
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Validation failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Validation failed: {str(e)}"
        )

@router.get("/{job_id}/progress", response_model=ValidationProgress)
def get_validation_progress(
    job_id: int,
    account_id: int = Depends(get_current_account_id),
    db: Session = Depends(get_db)
):
    """Get validation progress for job"""
    logger.info(f"DEBUG: get_validation_progress called with job_id={job_id}, account_id={account_id}")
    
    # Check if job exists at all
    job_any = db.query(ConversionJob).filter(ConversionJob.id == job_id).first()
    if job_any:
        logger.info(f"DEBUG: Job {job_id} exists with account_id={job_any.account_id}, status={job_any.status}")
    else:
        logger.info(f"DEBUG: Job {job_id} does not exist in database")
    
    progress = ValidationService.get_progress(db, account_id, job_id)
    
    if not progress:
        logger.error(f"DEBUG: get_progress returned None for job_id={job_id}, account_id={account_id}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found"
        )
    
    return ValidationProgress(**progress)

@router.get("/{job_id}/summary", response_model=ValidationSummary)
def get_validation_summary(
    job_id: int,
    account_id: int = Depends(get_current_account_id),
    db: Session = Depends(get_db)
):
    """Get validation summary with top errors"""
    summary = ValidationService.get_summary(db, account_id, job_id)
    
    if not summary:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found"
        )
    
    return ValidationSummary(**summary)

@router.get("/{job_id}/errors", response_model=List[ValidationErrorItem])
def get_validation_errors(
    job_id: int,
    error_type: str = None,
    field_name: str = None,
    limit: int = 100,
    offset: int = 0,
    account_id: int = Depends(get_current_account_id),
    db: Session = Depends(get_db)
):
    """Get validation errors with filtering"""
    errors = ValidationService.get_errors(
        db,
        account_id,
        job_id,
        error_type,
        field_name,
        limit,
        offset
    )
    
    return [ValidationErrorItem(**e) for e in errors]

@router.get("/{job_id}/errors/export")
def export_validation_errors(
    job_id: int,
    account_id: int = Depends(get_current_account_id),
    db: Session = Depends(get_db)
):
    """Export original CSV with ErrorMessage column added"""
    # Get job to get original filename
    job = db.query(ConversionJob).filter(
        ConversionJob.id == job_id,
        ConversionJob.account_id == account_id
    ).first()
    
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found"
        )
    
    csv_content = ValidationService.export_errors_csv(db, account_id, job_id)
    
    if not csv_content:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No errors found for job or original file not available"
        )
    
    # Create filename based on original filename
    # Example: "file.csv" -> "file_error.csv"
    # Example: "data.xlsx" -> "data_error.xlsx"
    original_filename = job.filename
    logger.info(f"EXPORT DEBUG: Original filename = {original_filename}")
    if '.' in original_filename:
        name_part, ext_part = original_filename.rsplit('.', 1)
        export_filename = f"{name_part}_error.{ext_part}"
    else:
        export_filename = f"{original_filename}_error"
    logger.info(f"EXPORT DEBUG: Export filename = {export_filename}")
    
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename={export_filename}"
        }
    )
