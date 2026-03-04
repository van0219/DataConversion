from sqlalchemy import Column, Integer, String, Boolean, TIMESTAMP
from sqlalchemy.sql import func
from app.core.database import Base

class SetupBusinessClass(Base):
    """
    Configuration table for setup business classes used in snapshot orchestration.
    Each entry defines a setup class, its FSM list endpoint, and key field.
    
    Category:
    - 'standard': Out-of-the-box FSM classes (can be deactivated, not deleted)
    - 'custom': User-added classes (can be deleted)
    
    Original values stored for reset functionality.
    
    List Name: The specific list to query (e.g., "FinanceDimension1FlatList", "DetailAccountList")
    Endpoint URL is constructed from: soap/classes/{name}/lists/{list_name}?params
    """
    __tablename__ = "setup_business_classes"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(255), nullable=False, unique=True)
    list_name = Column(String(255), nullable=True)  # Selected list name from swagger
    endpoint_url = Column(String(1000), nullable=False)
    key_field = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    category = Column(String(50), default='custom', nullable=False)  # 'standard' or 'custom'
    original_endpoint_url = Column(String(1000), nullable=True)  # For reset functionality
    original_key_field = Column(String(255), nullable=True)  # For reset functionality
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())
