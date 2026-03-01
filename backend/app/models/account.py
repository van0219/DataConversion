from sqlalchemy import Column, Integer, String, TIMESTAMP, LargeBinary
from sqlalchemy.sql import func
from app.core.database import Base

class Account(Base):
    __tablename__ = "accounts"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    account_name = Column(String(255), unique=True, nullable=False, index=True)
    project_name = Column(String(255), nullable=False)
    tenant_id = Column(String(255), nullable=False)
    base_url = Column(String(500), nullable=False)
    oauth_url = Column(String(500), nullable=False)  # OAuth provider URL (pu)
    client_id_encrypted = Column(LargeBinary, nullable=False)
    client_secret_encrypted = Column(LargeBinary, nullable=False)
    saak_encrypted = Column(LargeBinary, nullable=False)  # Service account access key
    sask_encrypted = Column(LargeBinary, nullable=False)  # Service account secret key
    username = Column(String(255), nullable=False)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())
