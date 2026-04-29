from sqlalchemy import Column, Integer, String, Text, TIMESTAMP
from sqlalchemy.sql import func
from app.core.database import Base


class SavedReport(Base):
    __tablename__ = "saved_reports"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    account_id = Column(Integer, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(String(500), nullable=True)
    business_class = Column(String(255), nullable=False)
    config_json = Column(Text, nullable=False)  # JSON: fields, groupBy, aggregate, filter, limit, reportMode
    result_data_json = Column(Text, nullable=True)  # JSON: snapshot of aggregation result at save time
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())
