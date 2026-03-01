from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class AccountCreate(BaseModel):
    account_name: str = Field(..., min_length=1, max_length=255)
    project_name: str = Field(..., min_length=1, max_length=255)
    tenant_id: str = Field(..., min_length=1, max_length=255)
    base_url: str = Field(..., min_length=1, max_length=500)
    oauth_url: str = Field(..., min_length=1, max_length=500)
    client_id: str = Field(..., min_length=1)
    client_secret: str = Field(..., min_length=1)
    saak: str = Field(..., min_length=1)
    sask: str = Field(..., min_length=1)
    username: str = Field(..., min_length=1, max_length=255)
    password: str = Field(..., min_length=8)

class AccountLogin(BaseModel):
    account_name: str
    password: str

class AccountResponse(BaseModel):
    id: int
    account_name: str
    project_name: str
    tenant_id: str
    base_url: str
    created_at: datetime
    
    class Config:
        from_attributes = True

class AccountListItem(BaseModel):
    id: int
    account_name: str
    project_name: str
    
    class Config:
        from_attributes = True

class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    account: AccountResponse

class AccountUpdate(BaseModel):
    project_name: Optional[str] = None
    tenant_id: Optional[str] = None
    base_url: Optional[str] = None
    client_id: Optional[str] = None
    client_secret: Optional[str] = None
    password: Optional[str] = None
