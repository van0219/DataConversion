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
    chunk_size: int = 1000
    trigger_interface: bool = False
    # Interface parameters (used when trigger_interface is True)
    interface_params: Optional[dict] = None

class InterfaceTransactionsRequest(BaseModel):
    job_id: int
    business_class: str
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

class DeleteRunGroupRequest(BaseModel):
    job_id: int
    business_class: str
    run_group: str

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
            request.trigger_interface,
            request.interface_params
        )
        
        # Transform response to match frontend expectations
        from datetime import datetime
        
        # Extract error message from error details
        error_message = None
        if result.get("error_details"):
            error_details = result["error_details"]
            if "exception" in error_details:
                error_message = f"{error_details.get('exception_type', 'Error')}: {error_details.get('exception')}"
            elif "fsm_response" in error_details:
                # Try to extract meaningful error from FSM response
                fsm_resp = error_details.get("fsm_response", {})
                if isinstance(fsm_resp, dict):
                    error_message = fsm_resp.get("error") or fsm_resp.get("message") or "FSM API returned errors"
        
        # Include interface result if it was triggered
        interface_result = result.get("interface_result")
        
        return {
            "status": "completed" if result["total_failure"] == 0 else "failed",
            "total_records": result["total_success"] + result["total_failure"],
            "success_count": result["total_success"],
            "failure_count": result["total_failure"],
            "total_failure": result["total_failure"],
            "chunks_processed": result["chunks_processed"],
            "run_group": result.get("run_group", ""),
            "business_class": request.business_class,
            "timestamp": datetime.now().isoformat(),
            "error_details": result.get("error_details"),
            "error_message": error_message,
            "interface_result": interface_result  # Include interface verification data
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

@router.post("/interface")
async def interface_transactions(
    request: InterfaceTransactionsRequest,
    account_id: int = Depends(get_current_account_id),
    db: Session = Depends(get_db)
):
    """Interface (post/journalize) transactions for a RunGroup"""
    try:
        result = await LoadService.interface_transactions(
            db,
            account_id,
            request.job_id,
            request.business_class,
            request.run_group,
            request.enterprise_group,
            request.accounting_entity,
            request.edit_only,
            request.edit_and_interface,
            request.partial_update,
            request.journalize_by_entity,
            request.journal_by_journal_code,
            request.bypass_organization_code,
            request.bypass_account_code,
            request.bypass_structure_relation_edit,
            request.interface_in_detail,
            request.currency_table,
            request.bypass_negative_rate_edit,
            request.primary_ledger,
            request.move_errors_to_new_run_group,
            request.error_run_group_prefix
        )
        return {
            "message": "Interface completed successfully",
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

@router.get("/check-rungroup/{job_id}/{run_group}")
async def check_run_group(
    job_id: int,
    run_group: str,
    account_id: int = Depends(get_current_account_id),
    db: Session = Depends(get_db)
):
    """Check if a RunGroup already exists in FSM before loading"""
    try:
        result = await LoadService.check_run_group_exists(
            db,
            account_id,
            job_id,
            run_group
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
            detail=f"Check failed: {str(e)}"
        )


@router.post("/delete-rungroup")
async def delete_run_group(
    request: DeleteRunGroupRequest,
    account_id: int = Depends(get_current_account_id),
    db: Session = Depends(get_db)
):
    """Delete all transactions for a RunGroup (useful for testing/cleanup)"""
    try:
        result = await LoadService.delete_run_group(
            db,
            account_id,
            request.job_id,
            request.business_class,
            request.run_group
        )
        
        # Reset job status to "validated" so it can be reloaded
        from app.models.job import ConversionJob, LoadResult
        job = db.query(ConversionJob).filter(
            ConversionJob.id == request.job_id,
            ConversionJob.account_id == account_id
        ).first()
        if job:
            job.status = "validated"
            # Remove load results for this job
            db.query(LoadResult).filter(LoadResult.conversion_job_id == request.job_id).delete()
            db.commit()
        
        return {
            "message": "RunGroup deleted successfully",
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
            detail=f"Delete failed: {str(e)}"
        )

# Placeholder - will implement in Task 6.2


@router.get("/interface-results/{job_id}/{run_group}")
async def get_interface_results(
    job_id: int,
    run_group: str,
    account_id: int = Depends(get_current_account_id),
    db: Session = Depends(get_db)
):
    """
    Query GLTransactionInterface records to check interface status.
    Returns records with error messages if any.
    """
    try:
        service = LoadService(db, account_id)
        results = await service.get_interface_results(job_id, run_group)
        return results
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
