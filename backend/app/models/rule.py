from sqlalchemy import Column, Integer, String, Text, Boolean, TIMESTAMP, ForeignKey, UniqueConstraint
from sqlalchemy.sql import func
from app.core.database import Base

class ValidationRuleTemplate(Base):
    __tablename__ = "validation_rule_templates"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    business_class = Column(String(255), index=True)  # NULL for GLOBAL rules
    rule_set_id = Column(Integer, ForeignKey("validation_rule_sets.id", ondelete="CASCADE"), nullable=True, index=True)  # NULL for unassigned
    rule_type = Column(String(100), nullable=False, index=True)  # REFERENCE_EXISTS, REQUIRED_OVERRIDE, PATTERN_MATCH, ENUM_VALIDATION, etc.
    field_name = Column(String(255), nullable=False)
    from_field = Column(Text)  # Source field that triggered the rule (for error reporting)
    reference_business_class = Column(String(255))  # For REFERENCE_EXISTS rules
    reference_field_name = Column(String(255))  # Field name in reference class to check against
    condition_expression = Column(Text)  # For conditional rules
    error_message = Column(Text, nullable=False)
    version = Column(Integer, default=1)
    is_active = Column(Boolean, default=True)
    
    # Schema-based validation fields
    source = Column(String(20), default='custom')  # 'schema' | 'custom'
    is_readonly = Column(Boolean, default=False)  # Schema rules are readonly
    pattern = Column(Text)  # Regex pattern for PATTERN_MATCH rules
    schema_id = Column(Integer, ForeignKey("schemas.id", ondelete="CASCADE"))  # Link to schema
    enum_values = Column(Text)  # JSON array of allowed values for ENUM_VALIDATION
    
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

class ValidationRuleAssignment(Base):
    __tablename__ = "validation_rule_assignments"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    rule_template_id = Column(Integer, ForeignKey("validation_rule_templates.id", ondelete="CASCADE"), nullable=False, index=True)
    account_id = Column(Integer, ForeignKey("accounts.id", ondelete="CASCADE"), index=True)  # NULL for GLOBAL
    is_enabled = Column(Boolean, default=True)
    override_error_message = Column(Text)
    created_at = Column(TIMESTAMP, server_default=func.now())
    
    __table_args__ = (
        UniqueConstraint('rule_template_id', 'account_id', name='uq_rule_assignment'),
    )
