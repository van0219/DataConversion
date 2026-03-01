from pydantic import BaseModel
from typing import List, Optional

class ValidationStartRequest(BaseModel):
    job_id: int
    business_class: str
    mapping: dict
    enable_rules: bool = True

class ValidationProgress(BaseModel):
    job_id: int
    status: str
    total_records: int
    processed_records: int
    valid_records: int
    invalid_records: int
    current_chunk: int
    total_chunks: int

class ValidationErrorItem(BaseModel):
    row_number: int
    field_name: str
    invalid_value: Optional[str]
    error_type: str
    error_message: str

class ValidationSummary(BaseModel):
    job_id: int
    status: str
    total_records: int
    valid_records: int
    invalid_records: int
    error_count: int
    top_errors: List[dict]
