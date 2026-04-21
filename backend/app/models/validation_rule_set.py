from sqlalchemy import Column, Integer, String, Boolean, Text, TIMESTAMP
from sqlalchemy.sql import func
from app.core.database import Base

class ValidationRuleSet(Base):
    """
    Validation rule sets for organizing rules by scenario/source.
    
    Each business class has:
    - One "Default" rule set (is_common=True, always applied)
    - Multiple optional rule sets (is_common=False, user selects one)
    
    During validation:
    - Default rules always apply
    - Selected rule set rules apply
    - Total rules = Default + Selected
    
    Example:
    - GLTransactionInterface > Default (3 rules, always applied)
    - GLTransactionInterface > Custom1 (5 rules, optional)
    - GLTransactionInterface > Custom2 (2 rules, optional)
    """
    __tablename__ = "validation_rule_sets"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    business_class = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    is_common = Column(Boolean, default=False, nullable=False)  # Original Default rule set
    is_user_default = Column(Boolean, default=False, nullable=False)  # User-selected default
    is_active = Column(Boolean, default=True, nullable=False)
    account_id = Column(Integer, nullable=True, index=True)  # NULL = global (visible to all), set = account-specific
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())
    
    # Unique constraint: One "Default" per business class, unique names per business class
    # Note: SQLite doesn't support partial indexes, so we'll enforce in application logic
