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
        Returns None if file not found.
        """
        # Look for swagger file in FSM_Swagger folder (relative to project root)
        swagger_dir = Path(__file__).parent.parent.parent.parent.parent / "FSM_Swagger"
        swagger_file = swagger_dir / f"{business_class}.json"
        
        if swagger_file.exists():
            logger.info(f"Loading schema from local file: {swagger_file}")
            with open(swagger_file, 'r') as f:
                return json.load(f)
        
        logger.warning(f"Local swagger file not found: {swagger_file}")
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
        
        # Store new schema version
        schema = Schema(
            account_id=account_id,
            business_class=business_class,
            schema_json=json.dumps(parsed_schema),
            schema_hash=schema_hash,
            version_number=new_version
        )
        
        db.add(schema)
        db.commit()
        db.refresh(schema)
        
        logger.info(f"Stored new schema version {new_version} for {business_class}")
        
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
        """Get parsed schema JSON from schema record"""
        return json.loads(schema.schema_json)
    
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
