"""
Load Strategy Resolver Service

Dynamically determines FSM load method based on available operations in schema.
Validates user-requested load modes against schema capabilities.
"""

from typing import List, Optional
from sqlalchemy.orm import Session
from app.models.schema import Schema
from app.models.schema_operation import SchemaOperation
from app.core.logging import logger
import json


class LoadStrategyResolver:
    """Service for resolving FSM load strategies based on schema operations"""
    
    # Load method priority order
    LOAD_METHOD_PRIORITY = [
        "createReleased",      # Direct release (highest priority)
        "createUnreleased",    # Staging mode
        "create"               # Direct create (lowest priority)
    ]
    
    @staticmethod
    def resolve_load_method(
        db: Session,
        account_id: int,
        business_class: str,
        schema_version: Optional[int] = None
    ) -> str:
        """
        Resolve the best load method for a business class.
        
        Args:
            db: Database session
            account_id: Account ID
            business_class: FSM business class name
            schema_version: Optional specific schema version (uses latest if None)
            
        Returns:
            Load method name (e.g., 'createUnreleased', 'createReleased', 'create')
            
        Raises:
            ValueError: If no supported load operation found
        """
        # Get schema
        if schema_version:
            schema = db.query(Schema).filter(
                Schema.account_id == account_id,
                Schema.business_class == business_class,
                Schema.version_number == schema_version
            ).first()
        else:
            schema = db.query(Schema).filter(
                Schema.account_id == account_id,
                Schema.business_class == business_class
            ).order_by(Schema.version_number.desc()).first()
        
        if not schema:
            raise ValueError(f"No schema found for {business_class}")
        
        # Get available operations
        operations = LoadStrategyResolver.get_available_operations(db, schema.id)
        
        if not operations:
            # Fallback: check operations_json in schema
            if schema.operations_json:
                operations = json.loads(schema.operations_json)
        
        if not operations:
            raise ValueError(f"No operations found for {business_class}")
        
        # Find best load method based on priority
        for method in LoadStrategyResolver.LOAD_METHOD_PRIORITY:
            if method in operations:
                logger.info(f"Resolved load method '{method}' for {business_class}")
                return method
        
        # If no standard method found, check for any create operation
        create_ops = [op for op in operations if "create" in op.lower()]
        if create_ops:
            logger.warning(f"Using non-standard create operation '{create_ops[0]}' for {business_class}")
            return create_ops[0]
        
        raise ValueError(f"No supported load operation found for {business_class}. Available: {operations}")
    
    @staticmethod
    def get_available_operations(db: Session, schema_id: int) -> List[str]:
        """
        Get list of available operations for a schema.
        
        Args:
            db: Database session
            schema_id: Schema ID
            
        Returns:
            List of operation names
        """
        operations = db.query(SchemaOperation).filter(
            SchemaOperation.schema_id == schema_id
        ).all()
        
        return [op.operation_name for op in operations]
    
    @staticmethod
    def validate_load_mode(
        db: Session,
        account_id: int,
        business_class: str,
        requested_mode: str,
        schema_version: Optional[int] = None
    ) -> bool:
        """
        Validate if requested load mode is supported by schema.
        
        Args:
            db: Database session
            account_id: Account ID
            business_class: FSM business class name
            requested_mode: User-requested load mode
            schema_version: Optional specific schema version
            
        Returns:
            True if mode is supported, False otherwise
        """
        try:
            # Get schema
            if schema_version:
                schema = db.query(Schema).filter(
                    Schema.account_id == account_id,
                    Schema.business_class == business_class,
                    Schema.version_number == schema_version
                ).first()
            else:
                schema = db.query(Schema).filter(
                    Schema.account_id == account_id,
                    Schema.business_class == business_class
                ).order_by(Schema.version_number.desc()).first()
            
            if not schema:
                logger.error(f"No schema found for {business_class}")
                return False
            
            # Get available operations
            operations = LoadStrategyResolver.get_available_operations(db, schema.id)
            
            if not operations and schema.operations_json:
                operations = json.loads(schema.operations_json)
            
            # Check if requested mode is available
            is_valid = requested_mode in operations
            
            if not is_valid:
                logger.warning(
                    f"Requested load mode '{requested_mode}' not available for {business_class}. "
                    f"Available: {operations}"
                )
            
            return is_valid
            
        except Exception as e:
            logger.error(f"Error validating load mode: {e}")
            return False
    
    @staticmethod
    def get_load_mode_options(
        db: Session,
        account_id: int,
        business_class: str,
        schema_version: Optional[int] = None
    ) -> List[dict]:
        """
        Get available load mode options for UI dropdown.
        
        Args:
            db: Database session
            account_id: Account ID
            business_class: FSM business class name
            schema_version: Optional specific schema version
            
        Returns:
            List of dicts with 'value' and 'label' keys
        """
        try:
            # Get schema
            if schema_version:
                schema = db.query(Schema).filter(
                    Schema.account_id == account_id,
                    Schema.business_class == business_class,
                    Schema.version_number == schema_version
                ).first()
            else:
                schema = db.query(Schema).filter(
                    Schema.account_id == account_id,
                    Schema.business_class == business_class
                ).order_by(Schema.version_number.desc()).first()
            
            if not schema:
                return []
            
            # Get available operations
            operations = LoadStrategyResolver.get_available_operations(db, schema.id)
            
            if not operations and schema.operations_json:
                operations = json.loads(schema.operations_json)
            
            # Map operations to user-friendly labels
            operation_labels = {
                "createReleased": "Create Released (Direct Release)",
                "createUnreleased": "Create Unreleased (Staging Mode)",
                "create": "Create (Direct Create)"
            }
            
            options = []
            for op in operations:
                if "create" in op.lower():
                    options.append({
                        "value": op,
                        "label": operation_labels.get(op, op)
                    })
            
            return options
            
        except Exception as e:
            logger.error(f"Error getting load mode options: {e}")
            return []
