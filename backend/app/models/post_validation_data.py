from sqlalchemy import Column, Integer, String, Text, TIMESTAMP, Index
from sqlalchemy.sql import func
from app.core.database import Base


class PostValidationData(Base):
    """Temporary table for post-validation report data.
    Cleared and repopulated each time a report is run.
    Stores raw FSM records for server-side aggregation."""
    __tablename__ = "post_validation_data"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    account_id = Column(Integer, nullable=False, index=True)
    business_class = Column(String(255), nullable=False)
    row_data = Column(Text, nullable=False)  # JSON string of the record's _fields
    created_at = Column(TIMESTAMP, server_default=func.now())

    __table_args__ = (
        Index('idx_pv_account_class', 'account_id', 'business_class'),
    )
