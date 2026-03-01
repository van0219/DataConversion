from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.modules.accounts.router import get_current_account_id
from app.modules.upload.service import UploadService
from app.modules.upload.schemas import UploadResponse, FileInfoResponse

router = APIRouter()

@router.post("/", response_model=UploadResponse)
async def upload_file(
    file: UploadFile = File(...),
    business_class: str = None,
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
