from pydantic import BaseModel
from typing import List, Optional

class ValidationStartRequest(BaseModel):
    job_id: int
    business_class: str
    mapping: dict
    enable_rules: bool = True
    selected_rule_set_id: Optional[int] = None  # Optional rule set to apply (in addition to Default)

class ValidationProgress(BaseModel):
    job_id: int
    status: str
    progress: float
    current_chunk: int
    total_chunks: int
    records_processed: int
    total_records: int
    errors_found: int
    filename: str

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
