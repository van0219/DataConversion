"""
Business Class Configuration Model

Defines business class-specific behaviors for load and post-validation processes.
"""

from sqlalchemy import Column, Integer, String, Boolean, Text, DateTime, JSON
from sqlalchemy.sql import func
from app.core.database import Base


class BusinessClassConfig(Base):
    """
    Configuration for FSM business class-specific behaviors.
    
    Handles differences in:
    - Load strategies (single table vs. header/lines/distributions)
    - Post-validation requirements
    - Interface operations
    - Rollback strategies
    """
    __tablename__ = "business_class_configs"
    
    id = Column(Integer, primary_key=True, index=True)
    business_class = Column(String(100), unique=True, nullable=False, index=True)
    
    # Load Configuration
    load_type = Column(String(50), nullable=False, default="single_table")
    # Options: "single_table", "header_lines", "header_lines_distributions"
    
    related_tables = Column(JSON, nullable=True)
    # Example for AP: {"header": "PayablesInvoice", "lines": "PayablesInvoiceLine", "distributions": "PayablesInvoiceDistribution"}
    
    load_sequence = Column(JSON, nullable=True)
    # Example: ["header", "lines", "distributions"] - order matters for foreign key dependencies
    
    # Interface Configuration
    supports_interface = Column(Boolean, default=False)
    # Whether this business class has an interface operation (like GLTransactionInterface)
    
    interface_operation = Column(String(200), nullable=True)
    # Example: "InterfaceTransactions_InterfaceTransactionsForm_FormOperation"
    
    interface_result_table = Column(String(100), nullable=True)
    # Example: "GLTransactionInterfaceResult"
    
    # Rollback Configuration
    rollback_operation = Column(String(200), nullable=True)
    # Example: "DeleteAllTransactionsForRunGroup_DeleteAllTransactionsForRunGroupForm_FormOperation"
    
    supports_rungroup = Column(Boolean, default=True)
    # Whether this business class uses RunGroup for grouping transactions
    
    # Post-Validation Configuration
    post_validation_checks = Column(JSON, nullable=True)
    # Example: ["balance_check", "cross_reference_check", "duplicate_check"]
    
    # Metadata
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    def __repr__(self):
        return f"<BusinessClassConfig(business_class='{self.business_class}', load_type='{self.load_type}')>"
