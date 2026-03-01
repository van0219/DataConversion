from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.modules.accounts.router import get_current_account_id
from app.modules.schema.service import SchemaService
from app.modules.schema.schemas import SchemaFetchRequest, SchemaResponse

router = APIRouter()

@router.post("/fetch", response_model=SchemaResponse)
async def fetch_schema(
    request: SchemaFetchRequest,
    account_id: int = Depends(get_current_account_id),
    db: Session = Depends(get_db)
):
    """Fetch schema from FSM and store with versioning"""
    try:
        schema = await SchemaService.fetch_and_store_schema(
            db,
            account_id,
            request.business_class,
            request.force_refresh
        )
        return SchemaResponse.from_orm(schema)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch schema: {str(e)}"
        )

@router.get("/{business_class}/latest", response_model=SchemaResponse)
def get_latest_schema(
    business_class: str,
    account_id: int = Depends(get_current_account_id),
    db: Session = Depends(get_db)
):
    """Get latest schema version for business class"""
    schema = SchemaService.get_latest_schema(db, account_id, business_class)
    
    if not schema:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No schema found for {business_class}"
        )
    
    return SchemaResponse.from_orm(schema)

@router.get("/{business_class}/version/{version_number}", response_model=SchemaResponse)
def get_schema_by_version(
    business_class: str,
    version_number: int,
    account_id: int = Depends(get_current_account_id),
    db: Session = Depends(get_db)
):
    """Get specific schema version"""
    schema = SchemaService.get_schema_by_version(db, account_id, business_class, version_number)
    
    if not schema:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Schema version {version_number} not found for {business_class}"
        )
    
    return SchemaResponse.from_orm(schema)
