from pydantic import BaseModel
from typing import List, Optional

class UploadResponse(BaseModel):
    job_id: int
    filename: str
    business_class: Optional[str]
    estimated_records: int
    headers: List[str]
    sample_records: List[dict]

class FileInfoResponse(BaseModel):
    job_id: int
    filename: str
    business_class: str
    total_records: int
    headers: List[str]
    status: str
