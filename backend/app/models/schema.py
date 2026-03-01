from sqlalchemy import Column, Integer, String, Text, TIMESTAMP, ForeignKey, UniqueConstraint
from sqlalchemy.sql import func
from app.core.database import Base

class Schema(Base):
    __tablename__ = "schemas"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    account_id = Column(Integer, ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False, index=True)
    business_class = Column(String(255), nullable=False, index=True)
    schema_json = Column(Text, nullable=False)
    schema_hash = Column(String(64), nullable=False, index=True)
    version_number = Column(Integer, nullable=False)
    fetched_timestamp = Column(TIMESTAMP, server_default=func.now())
    
    __table_args__ = (
        UniqueConstraint('account_id', 'business_class', 'version_number', name='uq_schema_version'),
    )
