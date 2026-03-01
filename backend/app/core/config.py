from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./fsm_workbench.db"
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_HOURS: int = 8
    ENCRYPTION_KEY: str
    
    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
