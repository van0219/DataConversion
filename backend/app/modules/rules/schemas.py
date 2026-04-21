from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class RuleTemplateBase(BaseModel):
    name: str
    business_class: Optional[str] = None  # NULL for GLOBAL
    rule_set_id: Optional[int] = None  # Rule set assignment
    rule_type: str  # REFERENCE_EXISTS, REQUIRED_OVERRIDE, PATTERN_MATCH, ENUM_VALIDATION, etc.
    field_name: str
    reference_business_class: Optional[str] = None
    reference_field_name: Optional[str] = None  # Field name in reference class
    condition_expression: Optional[str] = None
    error_message: str
    is_active: bool = True
    
    # Schema-based validation fields
    source: str = 'custom'  # 'schema' | 'custom'
    is_readonly: bool = False
    pattern: Optional[str] = None
    schema_id: Optional[int] = None
    enum_values: Optional[str] = None  # JSON array

class RuleTemplateCreate(RuleTemplateBase):
    pass

class RuleTemplateUpdate(BaseModel):
    name: Optional[str] = None
    rule_set_id: Optional[int] = None
    is_active: Optional[bool] = None
    error_message: Optional[str] = None
    condition_expression: Optional[str] = None
    reference_business_class: Optional[str] = None
    reference_field_name: Optional[str] = None
    pattern: Optional[str] = None
    enum_values: Optional[str] = None

class RuleTemplateResponse(RuleTemplateBase):
    id: int
    version: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class RuleAssignmentBase(BaseModel):
    rule_template_id: int
    account_id: Optional[int] = None  # NULL for GLOBAL
    is_enabled: bool = True
    override_error_message: Optional[str] = None

class RuleAssignmentCreate(RuleAssignmentBase):
    pass

class RuleAssignmentUpdate(BaseModel):
    is_enabled: Optional[bool] = None
    override_error_message: Optional[str] = None

class RuleAssignmentResponse(RuleAssignmentBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True

class RuleWithAssignment(RuleTemplateResponse):
    assignment_id: Optional[int] = None
    is_enabled: Optional[bool] = None
    override_error_message: Optional[str] = None
