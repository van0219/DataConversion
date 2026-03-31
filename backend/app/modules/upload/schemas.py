from pydantic import BaseModel
from typing import List, Optional, Dict, Any

class DetectionResult(BaseModel):
    business_class: str
    structure_type: str
    family_root: str
    member_count: int
    related_tables: List[str]
    table_roles: Dict[str, str]
    naming_pattern: Optional[str] = None
    is_load_class: bool
    detected: bool
    confidence: str

class UploadResponse(BaseModel):
    job_id: int
    filename: str
    business_class: Optional[str]
    estimated_records: int
    headers: List[str]
    sample_records: List[dict]
    detection: Optional[Dict[str, Any]] = None  # Detection result

class FileInfoResponse(BaseModel):
    job_id: int
    filename: str
    business_class: str
    total_records: int
    headers: List[str]
    status: str
