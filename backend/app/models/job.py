from sqlalchemy import Column, Integer, String, Text, TIMESTAMP, ForeignKey
from sqlalchemy.sql import func
from app.core.database import Base

class ConversionJob(Base):
    __tablename__ = "conversion_jobs"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    account_id = Column(Integer, ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False, index=True)
    business_class = Column(String(255), nullable=False)
    filename = Column(String(500), nullable=False)
    total_records = Column(Integer)
    valid_records = Column(Integer, default=0)
    invalid_records = Column(Integer, default=0)
    status = Column(String(50), nullable=False, index=True)  # pending, validating, validated, loading, completed, failed
    created_at = Column(TIMESTAMP, server_default=func.now(), index=True)
    completed_at = Column(TIMESTAMP)

class ValidationError(Base):
    __tablename__ = "validation_errors"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    conversion_job_id = Column(Integer, ForeignKey("conversion_jobs.id", ondelete="CASCADE"), nullable=False, index=True)
    row_number = Column(Integer, nullable=False)
    field_name = Column(String(255), nullable=False, index=True)
    invalid_value = Column(Text)
    error_type = Column(String(100), nullable=False, index=True)  # required, type, enum, pattern, reference, rule
    error_message = Column(Text, nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.now())

class LoadResult(Base):
    __tablename__ = "load_results"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    conversion_job_id = Column(Integer, ForeignKey("conversion_jobs.id", ondelete="CASCADE"), nullable=False, index=True)
    chunk_number = Column(Integer, nullable=False)
    success_count = Column(Integer, default=0)
    failure_count = Column(Integer, default=0)
    fsm_response = Column(Text)
    created_at = Column(TIMESTAMP, server_default=func.now())
