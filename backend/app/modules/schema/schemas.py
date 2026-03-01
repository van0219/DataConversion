from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class SchemaFetchRequest(BaseModel):
    business_class: str
    force_refresh: bool = False

class SchemaResponse(BaseModel):
    id: int
    business_class: str
    version_number: int
    schema_hash: str
    fetched_timestamp: datetime
    schema_json: str
    
    class Config:
        from_attributes = True

class SchemaFieldInfo(BaseModel):
    name: str
    type: str
    required: bool
    enum: Optional[list] = None
    pattern: Optional[str] = None
    format: Optional[str] = None
    maxLength: Optional[int] = None
    description: Optional[str] = None
