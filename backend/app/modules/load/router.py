from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from app.core.database import get_db
from app.modules.accounts.router import get_current_account_id
from app.modules.load.service import LoadService

router = APIRouter()

class LoadStartRequest(BaseModel):
    job_id: int
    business_class: str
    mapping: dict
    chunk_size: int = 100
    trigger_interface: bool = False

@router.post("/start")
async def start_load(
    request: LoadStartRequest,
    account_id: int = Depends(get_current_account_id),
    db: Session = Depends(get_db)
):
    """Start loading validated records to FSM"""
    try:
        result = await LoadService.start_load(
            db,
            account_id,
            request.job_id,
            request.business_class,
            request.mapping,
            request.chunk_size,
            request.trigger_interface
        )
        return {
            "message": "Load completed",
            "job_id": request.job_id,
            **result
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Load failed: {str(e)}"
        )

@router.get("/{job_id}/results")
def get_load_results(
    job_id: int,
    account_id: int = Depends(get_current_account_id),
    db: Session = Depends(get_db)
):
    """Get load results for job"""
    results = LoadService.get_load_results(db, account_id, job_id)
    
    if not results:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found"
        )
    
    return results

# Placeholder - will implement in Task 6.2
