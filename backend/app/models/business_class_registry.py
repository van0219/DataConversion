"""
Business Class Registry Model

Stores FSM business class metadata for auto-detection of single vs multiple table structures.
"""

from sqlalchemy import Column, Integer, String, Boolean, JSON, Text
from app.core.database import Base


class BusinessClassRegistry(Base):
    """
    Registry of FSM business classes with metadata for auto-detection.
    
    Populated from CSV files containing FSM business class structure information.
    Used by BusinessClassDetector to determine if a business class uses single
    or multiple table structure.
    """
    __tablename__ = "business_class_registry"
    
    id = Column(Integer, primary_key=True, index=True)
    business_class = Column(String(200), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)
    is_load_business_class = Column(Boolean, default=False, nullable=False)
    
    # Structure type: 'single', 'multiple', 'non_load'
    single_or_multiple = Column(String(20), nullable=False, index=True)
    
    # Family information
    load_family_root = Column(String(200), nullable=True, index=True)
    family_root_base = Column(String(200), nullable=True)
    
    # Naming pattern: 'Import', 'Interface', etc.
    naming_pattern = Column(String(50), nullable=True)
    
    # Relationship role: 'header', 'lines', 'distributions', etc.
    relationship_role = Column(String(50), nullable=True)
    
    # Family member count
    family_member_count = Column(Integer, default=0)
    
    # Related business classes (JSON array)
    # Example: ["PayablesInvoiceImport", "PayablesInvoiceDetailImport", "PayablesInvoiceDistributionImport"]
    related_business_classes = Column(JSON, nullable=True)
    
    # Table roles (JSON object)
    # Example: {"PayablesInvoiceImport": "header", "PayablesInvoiceDetailImport": "lines"}
    table_roles = Column(JSON, nullable=True)
    
    def __repr__(self):
        return f"<BusinessClassRegistry(business_class='{self.business_class}', type='{self.single_or_multiple}')>"
