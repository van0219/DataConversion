from pydantic import BaseModel
from typing import Dict, List
from datetime import datetime

class AutoMapRequest(BaseModel):
    job_id: int
    business_class: str

class MappingInfo(BaseModel):
    fsm_field: str | None
    confidence: str
    score: float

class MappingValidation(BaseModel):
    is_valid: bool
    missing_required_fields: List[str]
    mapped_fields_count: int
    required_fields_count: int

class AutoMapResponse(BaseModel):
    job_id: int
    business_class: str
    mapping: Dict[str, MappingInfo]
    validation: MappingValidation
    schema_version: int

class MappingTemplateSave(BaseModel):
    business_class: str
    template_name: str
    mapping: Dict
    schema_version: int

class MappingTemplateResponse(BaseModel):
    id: int
    business_class: str
    template_name: str
    schema_version: int
    is_valid: bool
    created_at: datetime
    
    class Config:
        from_attributes = True
