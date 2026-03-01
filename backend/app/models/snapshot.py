from sqlalchemy import Column, Integer, String, Text, TIMESTAMP, ForeignKey, UniqueConstraint, Index
from sqlalchemy.sql import func
from app.core.database import Base

class SnapshotRegistry(Base):
    __tablename__ = "snapshot_registry"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    account_id = Column(Integer, ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False, index=True)
    business_class = Column(String(255), nullable=False)
    last_sync_timestamp = Column(TIMESTAMP)
    record_count = Column(Integer, default=0)
    
    __table_args__ = (
        UniqueConstraint('account_id', 'business_class', name='uq_snapshot_registry'),
    )

class SnapshotRecord(Base):
    """
    CORRECTED: Single consolidated table for all snapshot data.
    No dynamic table creation.
    """
    __tablename__ = "snapshot_records"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    account_id = Column(Integer, ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False)
    business_class = Column(String(255), nullable=False)
    primary_key = Column(String(255), nullable=False)
    last_modified_date = Column(TIMESTAMP)
    raw_json = Column(Text, nullable=False)
    
    __table_args__ = (
        UniqueConstraint('account_id', 'business_class', 'primary_key', name='uq_snapshot_record'),
        Index('idx_snapshot_lookup', 'account_id', 'business_class', 'primary_key'),
    )
