from sqlalchemy import Column, Integer, String, Boolean, TIMESTAMP
from sqlalchemy.sql import func
from app.core.database import Base

class SetupBusinessClass(Base):
    """
    Configuration table for setup business classes used in snapshot orchestration.
    Each entry defines a setup class, its FSM list endpoint, and key field.
    """
    __tablename__ = "setup_business_classes"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(255), nullable=False, unique=True)
    endpoint_url = Column(String(1000), nullable=False)
    key_field = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())
