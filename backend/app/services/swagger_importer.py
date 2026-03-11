"""
Swagger Importer Service

Handles importing FSM Swagger/OpenAPI schemas into the database.
Extracts field metadata, operations, and creates schema versions.
"""

import json
import hashlib
from typing import Dict, List, Optional, Tuple
from sqlalchemy.orm import Session
from app.models.schema import Schema
from app.core.logging import logger


class SwaggerImporter:
    """Service for importing and processing Swagger/OpenAPI schemas"""
    
    @staticmethod
    def import_swagger(
        db: Session,
        account_id: int,
        business_class: str,
        swagger_content: str
    ) -> Dict:
        """
        Import Swagger JSON and create schema version if new.
        
        Args:
            db: Database session
            account_id: Account ID
            business_class: FSM business class name
            swagger_content: Swagger JSON string
            
        Returns:
            dict with schema info and whether it's new
        """
        try:
            # Parse JSON
            swagger_json = json.loads(swagger_content)
            
            # Parse OpenAPI schema
            schema_data = SwaggerImporter.parse_openapi_schema(swagger_json, business_class)
            
            # Compute hash
            schema_hash = SwaggerImporter.compute_schema_hash(schema_data["schema_json"])
            
            # Check if schema already exists
            existing_schema = SwaggerImporter.find_existing_schema(
                db, account_id, business_class, schema_hash
            )
            
            if existing_schema:
                logger.info(f"Schema already exists for {business_class} with hash {schema_hash}")
                return {
                    "business_class": business_class,
                    "version": existing_schema.version_number,
                    "new_schema": False,
                    "fields_count": len(schema_data["fields"]),
                    "required_fields": len(schema_data["required_fields"]),
                    "operations": schema_data["operations"],
                    "schema_hash": schema_hash,
                    "schema_id": existing_schema.id
                }
            
            # Create new schema version
            new_schema = SwaggerImporter.create_schema_version(
                db, account_id, business_class, schema_data, schema_hash
            )
            
            logger.info(f"Created new schema version {new_schema.version_number} for {business_class}")
            
            return {
                "business_class": business_class,
                "version": new_schema.version_number,
                "new_schema": True,
                "fields_count": len(schema_data["fields"]),
                "required_fields": len(schema_data["required_fields"]),
                "operations": schema_data["operations"],
                "schema_hash": schema_hash,
                "schema_id": new_schema.id
            }
            
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON in Swagger file: {e}")
            raise ValueError(f"Invalid JSON: {str(e)}")
        except Exception as e:
            logger.error(f"Error importing Swagger: {e}", exc_info=True)
            raise
    
    @staticmethod
    def parse_openapi_schema(swagger_json: Dict, business_class: str) -> Dict:
        """
        Parse OpenAPI/Swagger JSON and extract metadata.
        
        Args:
            swagger_json: Parsed Swagger JSON
            business_class: FSM business class name
            
        Returns:
            dict with schema_json, fields, operations, required_fields, etc.
        """
        # Extract schema from components.schemas
        schemas = swagger_json.get("components", {}).get("schemas", {})
        
        # Look for createAllFieldsMultipart or createAllFields schema
        schema_key = None
        for key in ["createAllFieldsMultipart", "createAllFields", business_class]:
            if key in schemas:
                schema_key = key
                break
        
        if not schema_key:
            raise ValueError(f"No schema found for {business_class} in Swagger")
        
        schema = schemas[schema_key]
        
        # Extract fields
        fields = SwaggerImporter.extract_fields(schema)
        
        # Extract operations from paths
        operations = SwaggerImporter.extract_operations(swagger_json.get("paths", {}))
        
        # Extract required fields
        required_fields = schema.get("required", [])
        
        # Extract enum fields
        enum_fields = SwaggerImporter.extract_enum_fields(schema.get("properties", {}))
        
        # Extract date fields
        date_fields = SwaggerImporter.extract_date_fields(schema.get("properties", {}))
        
        return {
            "schema_json": schema,
            "fields": fields,
            "operations": operations,
            "required_fields": required_fields,
            "enum_fields": enum_fields,
            "date_fields": date_fields
        }
    
    @staticmethod
    def extract_fields(schema: Dict) -> List[Dict]:
        """
        Extract field metadata from schema properties.
        
        Args:
            schema: OpenAPI schema object
            
        Returns:
            List of field dictionaries
        """
        fields = []
        properties = schema.get("properties", {})
        required_fields = schema.get("required", [])
        
        for field_name, field_def in properties.items():
            field_info = {
                "field_name": field_name,
                "field_type": field_def.get("type", "string"),
                "required": field_name in required_fields,
                "enum_values": field_def.get("enum"),
                "pattern": field_def.get("pattern"),
                "description": field_def.get("description"),
                "example": field_def.get("example")
            }
            fields.append(field_info)
        
        return fields
    
    @staticmethod
    def extract_operations(paths: Dict) -> List[str]:
        """
        Extract operation names from OpenAPI paths.
        
        Args:
            paths: OpenAPI paths object
            
        Returns:
            List of operation names (e.g., ['create', 'createUnreleased'])
        """
        operations = []
        
        for path, methods in paths.items():
            for method, details in methods.items():
                if isinstance(details, dict) and "operationId" in details:
                    operation_id = details["operationId"]
                    # Extract operation name (e.g., 'create', 'createUnreleased')
                    if operation_id not in operations:
                        operations.append(operation_id)
        
        return operations
    
    @staticmethod
    def extract_enum_fields(properties: Dict) -> Dict[str, List]:
        """
        Extract fields with enum values.
        
        Args:
            properties: Schema properties
            
        Returns:
            Dict mapping field names to enum values
        """
        enum_fields = {}
        
        for field_name, field_def in properties.items():
            if "enum" in field_def:
                enum_fields[field_name] = field_def["enum"]
        
        return enum_fields
    
    @staticmethod
    def extract_date_fields(properties: Dict) -> List[str]:
        """
        Extract date/datetime field names.
        
        Args:
            properties: Schema properties
            
        Returns:
            List of date field names
        """
        date_fields = []
        
        for field_name, field_def in properties.items():
            field_type = field_def.get("type")
            field_format = field_def.get("format")
            
            if field_type == "string" and field_format in ["date", "date-time"]:
                date_fields.append(field_name)
        
        return date_fields
    
    @staticmethod
    def compute_schema_hash(schema_content: Dict) -> str:
        """
        Compute SHA256 hash of schema content.
        
        Args:
            schema_content: Schema dictionary
            
        Returns:
            SHA256 hash string
        """
        # Convert to JSON string with sorted keys for consistent hashing
        schema_str = json.dumps(schema_content, sort_keys=True)
        return hashlib.sha256(schema_str.encode()).hexdigest()
    
    @staticmethod
    def find_existing_schema(
        db: Session,
        account_id: int,
        business_class: str,
        schema_hash: str
    ) -> Optional[Schema]:
        """
        Find existing schema with same hash.
        
        Args:
            db: Database session
            account_id: Account ID
            business_class: Business class name
            schema_hash: Schema hash to search for
            
        Returns:
            Schema object if found, None otherwise
        """
        return db.query(Schema).filter(
            Schema.account_id == account_id,
            Schema.business_class == business_class,
            Schema.schema_hash == schema_hash
        ).first()
    
    @staticmethod
    def create_schema_version(
        db: Session,
        account_id: int,
        business_class: str,
        schema_data: Dict,
        schema_hash: str
    ) -> Schema:
        """
        Create new schema version in database.
        
        Args:
            db: Database session
            account_id: Account ID
            business_class: Business class name
            schema_data: Parsed schema data
            schema_hash: Computed schema hash
            
        Returns:
            Created Schema object
        """
        # Get next version number
        latest_version = db.query(Schema).filter(
            Schema.account_id == account_id,
            Schema.business_class == business_class
        ).order_by(Schema.version_number.desc()).first()
        
        next_version = (latest_version.version_number + 1) if latest_version else 1
        
        # Create schema record
        new_schema = Schema(
            account_id=account_id,
            business_class=business_class,
            schema_json=json.dumps(schema_data["schema_json"]),
            schema_hash=schema_hash,
            version_number=next_version,
            source="imported",
            operations_json=json.dumps(schema_data["operations"]),
            required_fields_json=json.dumps(schema_data["required_fields"]),
            enum_fields_json=json.dumps(schema_data["enum_fields"]),
            date_fields_json=json.dumps(schema_data["date_fields"])
        )
        
        db.add(new_schema)
        db.commit()
        db.refresh(new_schema)
        
        # Create schema_fields records (will be added in Step 2)
        # Create schema_operations records (will be added in Step 2)
        
        return new_schema
