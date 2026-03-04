from sqlalchemy import Column, Integer, String, Boolean, Text, TIMESTAMP
from sqlalchemy.sql import func
from app.core.database import Base

class ValidationRuleSet(Base):
    """
    Validation rule sets for organizing rules by scenario/source.
    
    Each business class has:
    - One "Common" rule set (is_common=True, always applied)
    - Multiple optional rule sets (is_common=False, user selects one)
    
    During validation:
    - Common rules always apply
    - Selected rule set rules apply
    - Total rules = Common + Selected
    
    Example:
    - GLTransactionInterface > Common (3 rules, always applied)
    - GLTransactionInterface > Legacy Import (5 rules, optional)
    - GLTransactionInterface > Manual Entry (2 rules, optional)
    """
    __tablename__ = "validation_rule_sets"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    business_class = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    is_common = Column(Boolean, default=False, nullable=False)  # Common rules always apply
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())
    
    # Unique constraint: One "Common" per business class, unique names per business class
    # Note: SQLite doesn't support partial indexes, so we'll enforce in application logic
