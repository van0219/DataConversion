from sqlalchemy import Column, Integer, String, Boolean, Text, ForeignKey
from app.core.database import Base


class SchemaField(Base):
    __tablename__ = "schema_fields"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    schema_id = Column(Integer, ForeignKey("schemas.id", ondelete="CASCADE"), nullable=False, index=True)
    business_class = Column(String(255), nullable=False, index=True)
    field_name = Column(String(255), nullable=False, index=True)
    field_type = Column(String(100), nullable=False)
    required = Column(Boolean, default=False)
    enum_values_json = Column(Text)  # JSON array of enum values
    pattern = Column(String(500))
    description = Column(Text)
    example = Column(Text)
