from sqlalchemy.orm import Session
from typing import Optional, Dict
from app.models.schema import Schema
from app.models.account import Account
from app.services.fsm_client import FSMClient
from app.services.openapi_parser import OpenAPIParser
from app.utils.hashing import compute_schema_hash
from app.modules.accounts.service import AccountService
from app.core.logging import logger
import json
from pathlib import Path

class SchemaService:
    @staticmethod
    def _load_local_swagger(business_class: str) -> Optional[Dict]:
        """
        Load OpenAPI schema from local FSM_Swagger folder.
        Checks both Setup/ and Conversion/ subfolders.
        Returns None if file not found.
        """
        # Look for swagger file in FSM_Swagger folder (relative to project root)
        swagger_base_dir = Path(__file__).parent.parent.parent.parent.parent / "FSM_Swagger"
        
        # Check Conversion folder first (for classes going through conversion workflow)
        conversion_file = swagger_base_dir / "Conversion" / f"{business_class}.json"
        if conversion_file.exists():
            logger.info(f"Loading schema from Conversion folder: {conversion_file}")
            with open(conversion_file, 'r') as f:
                return json.load(f)
        
        # Check Setup folder (for reference data classes)
        setup_file = swagger_base_dir / "Setup" / f"{business_class}.json"
        if setup_file.exists():
            logger.info(f"Loading schema from Setup folder: {setup_file}")
            with open(setup_file, 'r') as f:
                return json.load(f)
        
        # Check root folder for backward compatibility
        root_file = swagger_base_dir / f"{business_class}.json"
        if root_file.exists():
            logger.info(f"Loading schema from root folder: {root_file}")
            with open(root_file, 'r') as f:
                return json.load(f)
        
        logger.warning(f"Local swagger file not found for {business_class} in Conversion/, Setup/, or root folder")
        return None
    
    @staticmethod
    def _parse_local_swagger(swagger_json: Dict, business_class: str) -> Dict:
        """
        Parse local swagger file to extract schema fields.
        Looks for components.schemas.createAllFieldsMultipart.
        Returns format compatible with OpenAPIParser.parse_schema().
        """
        try:
            # Navigate to the schema
            schemas = swagger_json.get("components", {}).get("schemas", {})
            
            # Try createAllFieldsMultipart first (most complete)
            schema = schemas.get("createAllFieldsMultipart")
            if not schema:
                # Fallback to createAllFields
                schema = schemas.get("createAllFields")
            
            if not schema:
                raise ValueError(f"No createAllFieldsMultipart or createAllFields found in swagger")
            
            # Extract properties and required fields
            properties = schema.get("properties", {})
            required_fields = schema.get("required", [])
            
            # Build parsed schema in OpenAPIParser format (list of field objects)
            fields = []
            for field_name, field_def in properties.items():
                field_info = {
                    "name": field_name,
                    "type": field_def.get("type", "string"),
                    "required": field_name in required_fields,
                    "enum": field_def.get("enum"),
                    "pattern": field_def.get("pattern"),
                    "format": field_def.get("format"),
                    "maxLength": field_def.get("maxLength"),
                    "minLength": field_def.get("minLength"),
                    "minimum": field_def.get("minimum"),
                    "maximum": field_def.get("maximum"),
                    "description": field_def.get("description"),
                    "example": field_def.get("example"),
                    "default": field_def.get("default")
                }
                fields.append(field_info)
            
            parsed_schema = {
                "business_class": business_class,
                "fields": fields,
                "raw_schema": schema
            }
            
            logger.info(f"Parsed schema: {len(fields)} fields, {len(required_fields)} required")
            return parsed_schema
            
        except Exception as e:
            logger.error(f"Failed to parse local swagger: {e}")
            raise ValueError(f"Invalid swagger format: {e}")
    
    @staticmethod
    async def fetch_and_store_schema(
        db: Session,
        account_id: int,
        business_class: str,
        force_refresh: bool = False
    ) -> Schema:
        """
        Fetch schema from local swagger file (preferred) or FSM API (fallback).
        Parse it, compute hash, and store with versioning.
        If schema_hash unchanged and not force_refresh, return existing schema.
        """
        # Try local swagger file first
        openapi_json = SchemaService._load_local_swagger(business_class)
        
        if openapi_json:
            # Parse local swagger
            logger.info(f"Using local swagger file for {business_class}")
            parsed_schema = SchemaService._parse_local_swagger(openapi_json, business_class)
        else:
            # Fallback to FSM API
            logger.info(f"Local swagger not found, fetching from FSM API for {business_class}")
            
            # Get account and decrypt credentials
            account = AccountService.get_account_by_id(db, account_id)
            if not account:
                raise ValueError("Account not found")
            
            credentials = AccountService.get_decrypted_credentials(account)
            
            # Create FSM client
            fsm_client = FSMClient(
                base_url=credentials["base_url"],
                oauth_url=credentials["oauth_url"],
                tenant_id=credentials["tenant_id"],
                client_id=credentials["client_id"],
                client_secret=credentials["client_secret"],
                saak=credentials["saak"],
                sask=credentials["sask"]
            )
            
            # Fetch OpenAPI schema from FSM
            openapi_json = await fsm_client.get_openapi_schema(business_class)
            
            # Parse schema using OpenAPIParser
            parsed_schema = OpenAPIParser.parse_schema(openapi_json, business_class)
        
        # Compute hash
        schema_hash = compute_schema_hash(parsed_schema)
        
        # Check if schema already exists with same hash
        if not force_refresh:
            existing = db.query(Schema).filter(
                Schema.account_id == account_id,
                Schema.business_class == business_class,
                Schema.schema_hash == schema_hash
            ).first()
            
            if existing:
                logger.info(f"Schema unchanged for {business_class}, returning existing version {existing.version_number}")
                return existing
        
        # Get current max version
        max_version = db.query(Schema).filter(
            Schema.account_id == account_id,
            Schema.business_class == business_class
        ).count()
        
        new_version = max_version + 1
        
        # Deactivate all previous versions
        db.query(Schema).filter(
            Schema.account_id == account_id,
            Schema.business_class == business_class
        ).update({"is_active": False})
        
        # Store new schema version (active by default)
        schema = Schema(
            account_id=account_id,
            business_class=business_class,
            schema_json=json.dumps(parsed_schema),
            schema_hash=schema_hash,
            version_number=new_version,
            is_active=True
        )
        
        db.add(schema)
        db.commit()
        db.refresh(schema)
        
        logger.info(f"Stored new schema version {new_version} for {business_class} (deactivated {max_version} old versions)")
        
        # If version changed, invalidate mapping templates
        if new_version > 1:
            SchemaService._invalidate_mapping_templates(db, account_id, business_class)
        
        return schema
    
    @staticmethod
    def get_latest_schema(
        db: Session,
        account_id: int,
        business_class: str
    ) -> Optional[Schema]:
        """Get latest schema version for business class"""
        return db.query(Schema).filter(
            Schema.account_id == account_id,
            Schema.business_class == business_class
        ).order_by(Schema.version_number.desc()).first()
    
    @staticmethod
    def get_schema_by_version(
        db: Session,
        account_id: int,
        business_class: str,
        version_number: int
    ) -> Optional[Schema]:
        """Get specific schema version"""
        return db.query(Schema).filter(
            Schema.account_id == account_id,
            Schema.business_class == business_class,
            Schema.version_number == version_number
        ).first()
    
    @staticmethod
    def get_parsed_schema(schema: Schema) -> Dict:
        """
        Get parsed schema JSON from schema record.
        Handles both old format (business_class, fields, raw_schema) 
        and new format (properties, required).
        """
        data = json.loads(schema.schema_json)
        
        # If already in new format, return as-is
        if "properties" in data:
            return data
        
        # Convert old format to new format
        if "fields" in data and isinstance(data["fields"], list):
            properties = {}
            required = []
            
            for field in data["fields"]:
                field_name = field.get("name")
                if not field_name:
                    continue
                
                properties[field_name] = {
                    "type": field.get("type", "string"),
                    "description": field.get("description", "")
                }
                
                if field.get("required", False):
                    required.append(field_name)
            
            return {
                "properties": properties,
                "required": required
            }
        
        # If neither format, return empty structure
        return {"properties": {}, "required": []}
    
    @staticmethod
    def _invalidate_mapping_templates(db: Session, account_id: int, business_class: str):
        """Mark mapping templates as invalid when schema changes"""
        from app.models.mapping import MappingTemplate
        
        templates = db.query(MappingTemplate).filter(
            MappingTemplate.account_id == account_id,
            MappingTemplate.business_class == business_class
        ).all()
        
        for template in templates:
            template.is_valid = False
        
        db.commit()
        logger.info(f"Invalidated {len(templates)} mapping templates for {business_class}")
