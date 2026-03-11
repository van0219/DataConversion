from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.modules.accounts.router import get_current_account_id
from app.modules.mapping.service import MappingService
from app.modules.mapping.schemas import (
    AutoMapRequest,
    AutoMapResponse,
    MappingTemplateSave,
    MappingTemplateResponse
)
from app.models.mapping import MappingTemplate

router = APIRouter()

@router.post("/auto-map", response_model=AutoMapResponse)
async def auto_map_fields(
    request: AutoMapRequest,
    account_id: int = Depends(get_current_account_id),
    db: Session = Depends(get_db)
):
    """
    Auto-map CSV columns to FSM fields.
    Returns mapping with confidence scores.
    """
    try:
        result = await MappingService.auto_map(
            db,
            account_id,
            request.job_id,
            request.business_class
        )
        return AutoMapResponse(**result)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Auto-mapping failed: {str(e)}"
        )

@router.post("/templates", response_model=MappingTemplateResponse)
def save_mapping_template(
    template: MappingTemplateSave,
    account_id: int = Depends(get_current_account_id),
    db: Session = Depends(get_db)
):
    """Save mapping configuration as template"""
    try:
        result = MappingService.save_template(
            db,
            account_id,
            template.business_class,
            template.template_name,
            template.mapping,
            template.enabled_fields,
            template.schema_version
        )
        return MappingTemplateResponse.from_orm(result)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.get("/templates/{business_class}", response_model=List[MappingTemplateResponse])
def list_mapping_templates(
    business_class: str,
    account_id: int = Depends(get_current_account_id),
    db: Session = Depends(get_db)
):
    """List all mapping templates for business class"""
    templates = MappingService.list_templates(db, account_id, business_class)
    return [MappingTemplateResponse.from_orm(t) for t in templates]

@router.delete("/templates/{template_id}")
def delete_mapping_template(
    template_id: int,
    account_id: int = Depends(get_current_account_id),
    db: Session = Depends(get_db)
):
    """Delete mapping template"""
    template = db.query(MappingTemplate).filter(
        MappingTemplate.id == template_id,
        MappingTemplate.account_id == account_id
    ).first()
    
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found"
        )
    
    db.delete(template)
    db.commit()
    return {"message": "Template deleted successfully"}
