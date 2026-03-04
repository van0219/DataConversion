from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.modules.accounts.router import get_current_account_id
from app.modules.snapshot.service import SnapshotService
from app.modules.snapshot.schemas import (
    SnapshotSyncAllRequest,
    SnapshotSyncSingleRequest,
    SnapshotSyncResponse,
    SnapshotRegistryItem,
    SetupBusinessClassCreate,
    SetupBusinessClassUpdate,
    SetupBusinessClassResponse
)

router = APIRouter()

# Snapshot Sync Endpoints

@router.post("/sync/all", response_model=SnapshotSyncResponse)
async def sync_all_setup_classes(
    account_id: int = Depends(get_current_account_id),
    db: Session = Depends(get_db)
):
    """
    Sync all active setup business classes.
    Fetches data from FSM using configured endpoints.
    """
    try:
        result = await SnapshotService.sync_all_active_setup_classes(db, account_id)
        return SnapshotSyncResponse(**result)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Snapshot sync failed: {str(e)}"
        )

@router.post("/sync/single", response_model=SnapshotSyncResponse)
async def sync_single_setup_class(
    request: SnapshotSyncSingleRequest,
    account_id: int = Depends(get_current_account_id),
    db: Session = Depends(get_db)
):
    """
    Sync a single setup business class by name.
    """
    try:
        result = await SnapshotService.sync_single_setup_class_by_name(
            db,
            account_id,
            request.business_class_name
        )
        return SnapshotSyncResponse(
            status="success",
            classes_synced=[result],
            total_records=result["record_count"]
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Snapshot sync failed: {str(e)}"
        )

@router.get("/registry", response_model=List[SnapshotRegistryItem])
def get_snapshot_registry(
    account_id: int = Depends(get_current_account_id),
    db: Session = Depends(get_db)
):
    """Get snapshot registry showing all synced business classes"""
    registry = SnapshotService.get_snapshot_registry(db, account_id)
    return [SnapshotRegistryItem.from_orm(item) for item in registry]

# Setup Business Class Management Endpoints

@router.get("/setup-classes", response_model=List[SetupBusinessClassResponse])
def get_all_setup_classes(db: Session = Depends(get_db)):
    """Get all setup business classes (configuration)"""
    classes = SnapshotService.get_all_setup_classes(db)
    return [SetupBusinessClassResponse.from_orm(cls) for cls in classes]

@router.get("/available-swagger-files")
def get_available_swagger_files(db: Session = Depends(get_db)):
    """
    Get list of available swagger files that haven't been added yet.
    Returns business class names from FSM_Swagger/Setup/ and FSM_Swagger/Conversion/ folders.
    """
    try:
        available_files = SnapshotService.get_available_swagger_files(db)
        return {"available_files": available_files}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list swagger files: {str(e)}"
        )

@router.get("/setup-classes/{class_id}", response_model=SetupBusinessClassResponse)
def get_setup_class(class_id: int, db: Session = Depends(get_db)):
    """Get setup business class by ID"""
    setup_class = SnapshotService.get_setup_class_by_id(db, class_id)
    if not setup_class:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Setup business class with ID {class_id} not found"
        )
    return SetupBusinessClassResponse.from_orm(setup_class)

@router.post("/setup-classes", response_model=SetupBusinessClassResponse)
def create_setup_class(
    request: SetupBusinessClassCreate,
    db: Session = Depends(get_db)
):
    """Create new setup business class"""
    try:
        setup_class = SnapshotService.create_setup_class(
            db,
            name=request.name,
            endpoint_url=request.endpoint_url,
            key_field=request.key_field,
            is_active=request.is_active
        )
        return SetupBusinessClassResponse.from_orm(setup_class)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create setup class: {str(e)}"
        )

@router.put("/setup-classes/{class_id}", response_model=SetupBusinessClassResponse)
def update_setup_class(
    class_id: int,
    request: SetupBusinessClassUpdate,
    db: Session = Depends(get_db)
):
    """Update setup business class"""
    try:
        setup_class = SnapshotService.update_setup_class(
            db,
            class_id=class_id,
            name=request.name,
            endpoint_url=request.endpoint_url,
            key_field=request.key_field,
            is_active=request.is_active
        )
        return SetupBusinessClassResponse.from_orm(setup_class)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update setup class: {str(e)}"
        )

@router.delete("/setup-classes/{class_id}")
def delete_setup_class(class_id: int, db: Session = Depends(get_db)):
    """Delete setup business class"""
    try:
        SnapshotService.delete_setup_class(db, class_id)
        return {"message": "Setup business class deleted successfully"}
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete setup class: {str(e)}"
        )

@router.post("/setup-classes/{class_id}/toggle", response_model=SetupBusinessClassResponse)
def toggle_setup_class_active(class_id: int, db: Session = Depends(get_db)):
    """Toggle is_active status of setup business class"""
    try:
        setup_class = SnapshotService.toggle_setup_class_active(db, class_id)
        return SetupBusinessClassResponse.from_orm(setup_class)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to toggle setup class: {str(e)}"
        )

@router.post("/setup-classes/{class_id}/reset", response_model=SetupBusinessClassResponse)
def reset_setup_class(class_id: int, db: Session = Depends(get_db)):
    """
    Reset setup business class to original values.
    - Standard classes: Revert to out-of-the-box values
    - Custom classes: Revert to first saved values
    """
    try:
        setup_class = SnapshotService.reset_setup_class(db, class_id)
        return SetupBusinessClassResponse.from_orm(setup_class)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to reset setup class: {str(e)}"
        )
