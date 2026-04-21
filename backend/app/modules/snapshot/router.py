from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
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

@router.get("/sync/progress/{business_class}")
def get_sync_progress(business_class: str):
    """Get real-time sync progress for a business class."""
    from app.services.sync_progress import sync_progress
    progress = sync_progress.get(business_class)
    if not progress:
        return {"status": "no_sync", "message": "No active sync for this class"}
    return progress


@router.post("/sync/all-background")
async def sync_all_background(
    background_tasks: BackgroundTasks,
    account_id: int = Depends(get_current_account_id),
    db: Session = Depends(get_db)
):
    """
    Start syncing all active classes as a background task.
    Returns immediately. Poll /sync/batch-status for progress.
    """
    from app.services.sync_progress import sync_progress
    from app.models.setup_business_class import SetupBusinessClass
    from app.modules.accounts.service import AccountService
    from app.services.fsm_client import FSMClient
    from app.core.database import SessionLocal

    batch = sync_progress.get_batch()
    if batch and batch.get("running"):
        raise HTTPException(status_code=409, detail="A sync is already in progress")

    active_classes = db.query(SetupBusinessClass).filter(SetupBusinessClass.is_active == True).order_by(SetupBusinessClass.name).all()
    if not active_classes:
        raise HTTPException(status_code=400, detail="No active setup classes to sync")

    class_names = [c.name for c in active_classes]
    sync_progress.start_batch(class_names)

    account = AccountService.get_account_by_id(db, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    credentials = AccountService.get_decrypted_credentials(account)
    class_data = [(c.id, c.name) for c in active_classes]

    async def run_batch():
        from app.core.logging import logger
        logger.info(f"Background batch sync started for {len(class_data)} classes")
        for cls_id, cls_name in class_data:
            sync_progress.set_batch_current(cls_name)
            batch_db = SessionLocal()
            try:
                fsm_client = FSMClient(
                    base_url=credentials["base_url"],
                    oauth_url=credentials["oauth_url"],
                    tenant_id=credentials["tenant_id"],
                    client_id=credentials["client_id"],
                    client_secret=credentials["client_secret"],
                    saak=credentials["saak"],
                    sask=credentials["sask"]
                )
                setup_class = batch_db.query(SetupBusinessClass).filter(SetupBusinessClass.id == cls_id).first()
                if setup_class:
                    result = await SnapshotService._sync_single_setup_class(
                        batch_db, account_id, setup_class, fsm_client
                    )
                    sync_progress.set_batch_class_done(cls_name, result["record_count"])
                    logger.info(f"Batch: {cls_name} done — {result['record_count']} records")
                else:
                    sync_progress.set_batch_class_failed(cls_name, "Class not found")
            except Exception as e:
                logger.error(f"Batch: {cls_name} failed — {e}")
                sync_progress.set_batch_class_failed(cls_name, str(e))
            finally:
                batch_db.close()
        sync_progress.finish_batch()
        logger.info("Background batch sync complete")

    background_tasks.add_task(run_batch)

    return {"status": "started", "classes": class_names, "total": len(class_names)}


@router.get("/sync/batch-status")
def get_batch_status():
    """
    Get the status of the background batch sync.
    Returns per-class status (queued/syncing/completed/failed) and results.
    """
    from app.services.sync_progress import sync_progress
    batch = sync_progress.get_batch()
    if not batch:
        return {"running": False, "classes": {}}
    return batch

@router.get("/registry", response_model=List[SnapshotRegistryItem])
def get_snapshot_registry(
    account_id: int = Depends(get_current_account_id),
    db: Session = Depends(get_db)
):
    """Get snapshot registry showing all synced business classes"""
    registry = SnapshotService.get_snapshot_registry(db, account_id)
    return [SnapshotRegistryItem.from_orm(item) for item in registry]

@router.get("/last-sync")
def get_last_sync_time(
    account_id: int = Depends(get_current_account_id),
    db: Session = Depends(get_db)
):
    """Get the timestamp of the last snapshot sync"""
    from app.models.snapshot import SnapshotRegistry
    from sqlalchemy import func
    
    last_sync = db.query(func.max(SnapshotRegistry.last_sync_timestamp)).filter(
        SnapshotRegistry.account_id == account_id
    ).scalar()
    
    return {
        "last_sync_at": last_sync.isoformat() if last_sync else None
    }

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
    Returns business class names with available list options from FSM_Swagger/Setup/ folder.
    """
    try:
        from app.modules.snapshot.schemas import AvailableSwaggerFile
        
        available_files = SnapshotService.get_available_swagger_files(db)
        return {
            "available_files": [AvailableSwaggerFile(**file) for file in available_files]
        }
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
            list_name=request.list_name,
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
            list_name=request.list_name,
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


@router.get("/records/{business_class}")
def get_snapshot_records(
    business_class: str,
    account_id: int = Depends(get_current_account_id),
    db: Session = Depends(get_db),
    search: str = "",
    page: int = 1,
    page_size: int = 50
):
    """
    Get paginated snapshot records for a business class with optional search.
    Search matches against primary_key and raw_json content.
    """
    from app.models.snapshot import SnapshotRecord
    import json

    query = db.query(SnapshotRecord).filter(
        SnapshotRecord.account_id == account_id,
        SnapshotRecord.business_class == business_class
    )

    if search.strip():
        search_term = f"%{search.strip()}%"
        query = query.filter(
            (SnapshotRecord.primary_key.ilike(search_term)) |
            (SnapshotRecord.raw_json.ilike(search_term))
        )

    total = query.count()
    total_pages = max(1, (total + page_size - 1) // page_size)
    page = max(1, min(page, total_pages))

    records = query.order_by(SnapshotRecord.primary_key).offset((page - 1) * page_size).limit(page_size).all()

    # Parse raw_json and extract columns from first record
    parsed = []
    columns: List[str] = []
    for r in records:
        try:
            data = json.loads(r.raw_json)
            if not columns and data:
                columns = list(data.keys())
            parsed.append({"primary_key": r.primary_key, **data})
        except Exception:
            parsed.append({"primary_key": r.primary_key, "_raw": r.raw_json})

    if "primary_key" not in columns:
        columns.insert(0, "primary_key")

    return {
        "records": parsed,
        "columns": columns,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages
    }
