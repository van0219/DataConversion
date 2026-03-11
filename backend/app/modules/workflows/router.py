from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from app.core.database import get_db
from app.modules.accounts.router import get_current_account_id
from app.services.workflow_orchestrator import WorkflowOrchestrator

router = APIRouter()


class FullConversionRequest(BaseModel):
    file_path: str
    business_class: str
    load_to_fsm: bool = False
    template_id: Optional[int] = None
    enable_rules: bool = True


@router.post("/full-conversion")
async def run_full_conversion(
    request: FullConversionRequest,
    account_id: int = Depends(get_current_account_id),
    db: Session = Depends(get_db)
):
    """
    Run complete conversion workflow: upload → schema → mapping → validation → load.
    
    This endpoint orchestrates the entire conversion process in one call.
    Returns job_id for progress tracking.
    """
    try:
        result = await WorkflowOrchestrator.run_full_conversion(
            db,
            account_id,
            request.file_path,
            request.business_class,
            request.load_to_fsm,
            request.template_id,
            request.enable_rules
        )
        return result
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Workflow failed: {str(e)}"
        )
