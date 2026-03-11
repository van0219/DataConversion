from sqlalchemy import Column, Integer, String, ForeignKey
from app.core.database import Base


class SchemaOperation(Base):
    __tablename__ = "schema_operations"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    schema_id = Column(Integer, ForeignKey("schemas.id", ondelete="CASCADE"), nullable=False, index=True)
    business_class = Column(String(255), nullable=False, index=True)
    operation_name = Column(String(100), nullable=False)  # e.g., 'create', 'createUnreleased', 'createReleased'
