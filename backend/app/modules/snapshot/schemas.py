from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

# Snapshot Sync Schemas

class SnapshotSyncAllRequest(BaseModel):
    """Request to sync all active setup classes"""
    pass

class SnapshotSyncSingleRequest(BaseModel):
    """Request to sync a single setup class"""
    business_class_name: str

class SnapshotSyncResult(BaseModel):
    """Result of syncing a single business class"""
    business_class: str
    status: str
    record_count: int
    last_sync: Optional[str] = None
    error: Optional[str] = None

class SnapshotSyncResponse(BaseModel):
    """Response from snapshot sync operation"""
    status: str
    classes_synced: List[SnapshotSyncResult]
    total_records: int
    message: Optional[str] = None

class SnapshotRegistryItem(BaseModel):
    """Snapshot registry entry"""
    id: int
    account_id: int
    business_class: str
    last_sync_timestamp: Optional[datetime]
    record_count: int
    
    class Config:
        from_attributes = True

# Setup Business Class Management Schemas

class SetupBusinessClassBase(BaseModel):
    """Base schema for setup business class"""
    name: str
    endpoint_url: str
    key_field: str
    is_active: bool = True

class SetupBusinessClassCreate(SetupBusinessClassBase):
    """Schema for creating setup business class"""
    pass

class SetupBusinessClassUpdate(BaseModel):
    """Schema for updating setup business class"""
    name: Optional[str] = None
    endpoint_url: Optional[str] = None
    key_field: Optional[str] = None
    is_active: Optional[bool] = None

class SetupBusinessClassResponse(SetupBusinessClassBase):
    """Schema for setup business class response"""
    id: int
    category: str  # 'standard' or 'custom'
    original_endpoint_url: Optional[str] = None
    original_key_field: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
