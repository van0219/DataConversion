from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class RuleSetBase(BaseModel):
    """Base schema for rule set"""
    name: str
    business_class: str
    description: Optional[str] = None
    is_active: bool = True

class RuleSetCreate(BaseModel):
    """Schema for creating rule set"""
    name: str
    business_class: str
    description: Optional[str] = None
    is_active: bool = True

class RuleSetUpdate(BaseModel):
    """Schema for updating rule set"""
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None

class RuleSetResponse(BaseModel):
    """Schema for rule set response"""
    id: int
    name: str
    business_class: str
    description: Optional[str] = None
    is_common: bool
    is_active: bool
    created_at: datetime
    updated_at: datetime
    rule_count: Optional[int] = 0  # Number of rules in this set
    
    class Config:
        from_attributes = True

class RuleSetWithRules(RuleSetResponse):
    """Schema for rule set with its rules"""
    rules: list = []  # Will be populated with rule details
