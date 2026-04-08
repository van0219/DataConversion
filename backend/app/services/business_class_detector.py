"""
Business Class Detector Service

Auto-detects business class structure from filename using FSM metadata registry.
"""

from typing import Dict, Optional
from sqlalchemy.orm import Session
from app.models.business_class_registry import BusinessClassRegistry
from app.core.logging import logger
import re


class BusinessClassDetector:
    """
    Auto-detect business class structure from CSV filename.
    
    Uses business class registry populated from FSM metadata to determine:
    - Business class name
    - Structure type (single vs. multiple tables)
    - Related tables and their roles
    """
    
    @staticmethod
    def detect_from_filename(db: Session, filename: str) -> Dict:
        """
        Detect business class and structure from CSV filename.
        
        Args:
            db: Database session
            filename: CSV filename (e.g., "PayablesInvoice_20250101.csv")
            
        Returns:
            {
                "business_class": "PayablesInvoice",
                "structure_type": "multiple",
                "family_root": "PayablesInvoice",
                "member_count": 8,
                "related_tables": ["PayablesInvoiceDetailImport", ...],
                "table_roles": {"PayablesInvoiceImport": "header", ...},
                "detected": True,
                "confidence": "high"
            }
        """
        # Extract business class name from filename
        business_class = BusinessClassDetector._extract_business_class(filename)
        
        logger.info(f"Detecting business class structure for: {business_class}")
        
        # Look up in registry
        registry_entry = db.query(BusinessClassRegistry).filter(
            BusinessClassRegistry.business_class == business_class
        ).first()
        
        if not registry_entry:
            # Try fuzzy matching
            registry_entry = BusinessClassDetector._fuzzy_match(db, business_class)
        
        if not registry_entry:
            logger.warning(f"Business class '{business_class}' not found in registry, using fallback")
            return BusinessClassDetector._fallback_detection(business_class)
        
        # Build detection result
        related_tables = registry_entry.related_business_classes or []
        
        # Filter out Interface tables (FSM internal processing tables)
        # Only show Import tables which are the ones users actually work with
        conversion_tables = [
            table for table in related_tables
            if 'Import' in table and 'Interface' not in table
        ]
        
        # If no Import tables found, use all tables (fallback for non-standard naming)
        if not conversion_tables:
            conversion_tables = related_tables
        
        # Recalculate member count based on filtered tables
        member_count = len(conversion_tables)
        
        # Filter table roles to match filtered tables
        all_roles = registry_entry.table_roles or BusinessClassDetector._infer_roles(related_tables)
        filtered_roles = {
            table: role for table, role in all_roles.items()
            if table in conversion_tables
        }
        
        result = {
            "business_class": registry_entry.business_class,
            "structure_type": registry_entry.single_or_multiple,
            "family_root": registry_entry.load_family_root or registry_entry.business_class,
            "member_count": member_count,
            "related_tables": conversion_tables,
            "table_roles": filtered_roles,
            "naming_pattern": registry_entry.naming_pattern,
            "is_load_class": registry_entry.is_load_business_class,
            "detected": True,
            "confidence": "high"
        }
        
        logger.info(f"Detection complete: {result['structure_type']} table structure with {result['member_count']} members")
        
        return result
    
    @staticmethod
    def _extract_business_class(filename: str) -> str:
        """
        Extract business class name from filename.
        
        Examples:
            "PayablesInvoice_20250101.csv" -> "PayablesInvoice"
            "GLTransactionInterface.csv" -> "GLTransactionInterface"
            "Vendor_Import_Data.csv" -> "Vendor"
        """
        # Remove file extension
        name = filename.replace('.csv', '').replace('.CSV', '')
        
        # Business class is the first part before the first underscore
        if '_' in name:
            name = name.split('_')[0]
        
        return name
    
    @staticmethod
    def _fuzzy_match(db: Session, business_class: str) -> Optional[BusinessClassRegistry]:
        """
        Attempt fuzzy matching if exact match fails.
        
        Tries:
        1. Case-insensitive match
        2. Match with common suffixes (Import, Interface)
        3. Match without suffixes
        """
        # Try case-insensitive
        entry = db.query(BusinessClassRegistry).filter(
            BusinessClassRegistry.business_class.ilike(business_class)
        ).first()
        
        if entry:
            return entry
        
        # Try with common suffixes
        for suffix in ['Import', 'Interface', 'Importer']:
            entry = db.query(BusinessClassRegistry).filter(
                BusinessClassRegistry.business_class == f"{business_class}{suffix}"
            ).first()
            if entry:
                return entry
        
        # Try without common suffixes
        for suffix in ['Import', 'Interface', 'Importer']:
            if business_class.endswith(suffix):
                base = business_class[:-len(suffix)]
                entry = db.query(BusinessClassRegistry).filter(
                    BusinessClassRegistry.business_class == base
                ).first()
                if entry:
                    return entry
        
        return None
    
    @staticmethod
    def _fallback_detection(business_class: str) -> Dict:
        """
        Fallback detection when business class not found in registry.
        Assumes single table structure.
        """
        logger.warning(f"Using fallback detection for {business_class}")
        
        return {
            "business_class": business_class,
            "structure_type": "single",
            "family_root": business_class,
            "member_count": 1,
            "related_tables": [],
            "table_roles": {business_class: "main"},
            "naming_pattern": None,
            "is_load_class": True,  # Assume it's a load class
            "detected": True,
            "confidence": "low"  # Low confidence for fallback
        }
    
    @staticmethod
    def _infer_roles(related_tables: list) -> Dict[str, str]:
        """
        Infer table roles from naming patterns.
        
        Patterns:
        - *Detail*, *Line* -> "lines"
        - *Distribution* -> "distributions"
        - *Comment* -> "comments"
        - *Error* -> "errors"
        - *Result* -> "results"
        - *AddOnCharge*, *AOC* -> "charges"
        - *Payment* -> "payments"
        - Default -> "header"
        """
        roles = {}
        
        for table in related_tables:
            if "Detail" in table or "Line" in table:
                roles[table] = "lines"
            elif "Distribution" in table:
                roles[table] = "distributions"
            elif "Comment" in table:
                roles[table] = "comments"
            elif "Error" in table:
                roles[table] = "errors"
            elif "Result" in table:
                roles[table] = "results"
            elif "AddOnCharge" in table or "AOC" in table:
                roles[table] = "charges"
            elif "Payment" in table:
                roles[table] = "payments"
            elif "Fund" in table:
                roles[table] = "funds"
            elif "Options" in table:
                roles[table] = "options"
            else:
                roles[table] = "header"
        
        return roles
    
    @staticmethod
    def get_role_icon(role: str) -> str:
        """Get emoji icon for table role"""
        icons = {
            "header": "📄",
            "lines": "📝",
            "distributions": "💰",
            "comments": "💬",
            "errors": "❌",
            "results": "✅",
            "charges": "💳",
            "payments": "💵",
            "funds": "🏦",
            "options": "⚙️",
            "main": "📊"
        }
        return icons.get(role, "📊")
