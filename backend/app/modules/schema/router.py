from fastapi import APIRouter, Depends, HTTPException, status, Form, UploadFile, File
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.modules.accounts.router import get_current_account_id
from app.modules.schema.service import SchemaService
from app.modules.schema.schemas import SchemaFetchRequest, SchemaResponse

router = APIRouter()

@router.post("/fetch", response_model=SchemaResponse)
async def fetch_schema(
    request: SchemaFetchRequest,
    account_id: int = Depends(get_current_account_id),
    db: Session = Depends(get_db)
):
    """Fetch schema from FSM and store with versioning"""
    try:
        schema = await SchemaService.fetch_and_store_schema(
            db,
            account_id,
            request.business_class,
            request.force_refresh
        )
        return SchemaResponse.from_orm(schema)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch schema: {str(e)}"
        )

@router.get("/{business_class}/latest", response_model=SchemaResponse)
def get_latest_schema(
    business_class: str,
    account_id: int = Depends(get_current_account_id),
    db: Session = Depends(get_db)
):
    """Get latest schema version for business class"""
    schema = SchemaService.get_latest_schema(db, account_id, business_class)
    
    if not schema:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No schema found for {business_class}"
        )
    
    return SchemaResponse.from_orm(schema)

@router.get("/{business_class}/version/{version_number}", response_model=SchemaResponse)
def get_schema_by_version(
    business_class: str,
    version_number: int,
    account_id: int = Depends(get_current_account_id),
    db: Session = Depends(get_db)
):
    """Get specific schema version"""
    schema = SchemaService.get_schema_by_version(db, account_id, business_class, version_number)
    
    if not schema:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Schema version {version_number} not found for {business_class}"
        )
    
    return SchemaResponse.from_orm(schema)


@router.get("/list")
def list_schemas(
    account_id: int = Depends(get_current_account_id),
    db: Session = Depends(get_db)
):
    """
    List all ACTIVE schemas for the current account (only latest versions).
    
    Returns:
        List of active schemas with version info, field counts, and operations
    """
    from app.models.schema import Schema
    from sqlalchemy import func
    
    try:
        # Get only active schemas for account, ordered by business_class
        schemas = db.query(Schema).filter(
            Schema.account_id == account_id,
            Schema.is_active == True
        ).order_by(
            Schema.business_class,
            Schema.version_number.desc()
        ).all()
        
        # Format response
        result = []
        for schema in schemas:
            import json
            # Parse JSON fields
            operations = json.loads(schema.operations_json) if schema.operations_json else []
            required_fields = json.loads(schema.required_fields_json) if schema.required_fields_json else []
            enum_fields = json.loads(schema.enum_fields_json) if schema.enum_fields_json else {}
            
            # Calculate total fields from schema_json
            total_fields = 0
            try:
                schema_data = json.loads(schema.schema_json)
                
                # New format: {"properties": {...}, "required": [...]}
                if 'properties' in schema_data:
                    total_fields = len(schema_data['properties'])
                # Old format: {"business_class": "...", "fields": [...], "raw_schema": {...}}
                elif 'fields' in schema_data and isinstance(schema_data['fields'], list):
                    total_fields = len(schema_data['fields'])
                # Fallback: count from required_fields and enum_fields
                else:
                    total_fields = len(required_fields) + len(enum_fields)
            except Exception as e:
                logger.warning(f"Error parsing schema_json for {schema.business_class}: {e}")
                # Fallback to old calculation on error
                total_fields = len(required_fields) + len(enum_fields)
            
            result.append({
                "id": schema.id,
                "business_class": schema.business_class,
                "version": schema.version_number,
                "version_hash": schema.schema_hash,
                "source": schema.source,
                "created_at": schema.created_at.isoformat() if schema.created_at else None,
                "fields_count": total_fields,
                "required_fields_count": len(required_fields),
                "operations": operations
            })
        
        return {"schemas": result}
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list schemas: {str(e)}"
        )


@router.post("/import-swagger")
async def import_swagger(
    business_class: str = Form(...),
    swagger_file: UploadFile = File(...),
    account_id: int = Depends(get_current_account_id),
    db: Session = Depends(get_db)
):
    """
    Import Swagger/OpenAPI JSON file and create schema version.
    Auto-generates validation rules from schema.
    
    Request:
        - business_class: FSM business class name
        - swagger_file: Swagger JSON file
    
    Response:
        - business_class: Business class name
        - version: Schema version number
        - new_schema: Whether this is a new schema version
        - fields_count: Number of fields
        - required_fields: Number of required fields
        - operations: List of available operations
        - schema_hash: SHA256 hash of schema
        - rules_generated: Count of auto-generated validation rules
    """
    from fastapi import Form, UploadFile, File
    from app.services.swagger_importer import SwaggerImporter
    
    try:
        # Read file content
        content = await swagger_file.read()
        swagger_content = content.decode('utf-8')
        
        # Import swagger (now auto-generates rules)
        result = SwaggerImporter.import_swagger(
            db,
            account_id,
            business_class,
            swagger_content
        )
        
        return result
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to import swagger: {str(e)}"
        )


@router.post("/{schema_id}/generate-rules")
def generate_rules_for_schema(
    schema_id: int,
    account_id: int = Depends(get_current_account_id),
    db: Session = Depends(get_db)
):
    """
    Generate validation rules for an existing schema.
    Useful for schemas imported before auto-generation was implemented.
    
    Returns:
        Count of generated rules by type
    """
    from app.models.schema import Schema
    from app.services.schema_rule_generator import SchemaRuleGenerator
    
    try:
        # Get schema
        schema = db.query(Schema).filter(
            Schema.id == schema_id,
            Schema.account_id == account_id
        ).first()
        
        if not schema:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Schema {schema_id} not found"
            )
        
        # Generate rules
        rules_created = SchemaRuleGenerator.generate_rules_for_schema(db, schema)
        
        return {
            "schema_id": schema_id,
            "business_class": schema.business_class,
            "rules_generated": rules_created
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate rules: {str(e)}"
        )


@router.delete("/{schema_id}")
def deactivate_schema(
    schema_id: int,
    account_id: int = Depends(get_current_account_id),
    db: Session = Depends(get_db)
):
    """
    Deactivate a schema (soft delete).
    Schema is marked as inactive but not deleted from database.
    All auto-generated validation rules from this schema are also deactivated.
    Version numbers continue incrementing for future uploads.
    
    Returns:
        Success message with schema details and rules deactivated count
    """
    from app.models.schema import Schema
    from app.models.rule import ValidationRuleTemplate
    
    try:
        # Get schema
        schema = db.query(Schema).filter(
            Schema.id == schema_id,
            Schema.account_id == account_id
        ).first()
        
        if not schema:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Schema {schema_id} not found"
            )
        
        business_class = schema.business_class
        version = schema.version_number
        
        # Deactivate all schema-generated rules for this schema
        rules_deactivated = db.query(ValidationRuleTemplate).filter(
            ValidationRuleTemplate.schema_id == schema_id,
            ValidationRuleTemplate.source == "schema"
        ).update({"is_active": False})
        
        # Deactivate schema
        schema.is_active = False
        db.commit()
        
        return {
            "status": "success",
            "message": f"Schema {business_class} v{version} deactivated",
            "schema_id": schema_id,
            "business_class": business_class,
            "version": version,
            "rules_deactivated": rules_deactivated
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to deactivate schema: {str(e)}"
        )
