from sqlalchemy import Column, Integer, String, Text, Boolean, TIMESTAMP, ForeignKey, UniqueConstraint
from sqlalchemy.sql import func
from app.core.database import Base

class MappingTemplate(Base):
    __tablename__ = "mapping_templates"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    account_id = Column(Integer, ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False, index=True)
    business_class = Column(String(255), nullable=False, index=True)
    template_name = Column(String(255), nullable=False)
    mapping_json = Column(Text, nullable=False)  # {"csv_column": "fsm_field", ...}
    enabled_fields_json = Column(Text)  # {"fsm_field": true/false, ...} - which fields are enabled
    schema_version = Column(Integer, nullable=False)
    is_valid = Column(Boolean, default=True)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())
    
    __table_args__ = (
        UniqueConstraint('account_id', 'business_class', 'template_name', name='uq_mapping_template'),
    )
