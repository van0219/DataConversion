from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List, Optional
import json
from app.core.database import get_db
from app.modules.accounts.router import get_current_account_id
from app.modules.rules.service import RuleService
from app.modules.rules.schemas import (
    RuleTemplateCreate, RuleTemplateUpdate, RuleTemplateResponse,
    RuleAssignmentCreate, RuleAssignmentUpdate, RuleAssignmentResponse,
    RuleWithAssignment
)

router = APIRouter()


@router.get("/required-fields/{business_class}")
def get_required_fields(
    business_class: str,
    db: Session = Depends(get_db)
):
    """
    Get all required field names for a business class from its rule sets.
    Returns fields that have REQUIRED_FIELD or REQUIRED_OVERRIDE rules
    in the Default (is_common=True) rule set.
    """
    from app.models.validation_rule_set import ValidationRuleSet
    from app.models.rule import ValidationRuleTemplate

    # Find the Default rule set for this business class
    default_set = db.query(ValidationRuleSet).filter(
        ValidationRuleSet.business_class == business_class,
        ValidationRuleSet.is_common == True
    ).first()

    if not default_set:
        return {"required_fields": []}

    # Get all REQUIRED rules from the default set
    rules = db.query(ValidationRuleTemplate).filter(
        ValidationRuleTemplate.rule_set_id == default_set.id,
        ValidationRuleTemplate.rule_type.in_(["REQUIRED_FIELD", "REQUIRED_OVERRIDE"]),
        ValidationRuleTemplate.field_name != "_file_level_"
    ).all()

    return {
        "required_fields": [r.field_name for r in rules],
        "rule_set_name": default_set.name
    }


# Rule Templates

@router.post("/templates", response_model=RuleTemplateResponse)
def create_rule_template(
    rule: RuleTemplateCreate,
    db: Session = Depends(get_db),
    account_id: int = Depends(get_current_account_id)
):
    """Create a new validation rule template"""
    try:
        return RuleService.create_rule_template(db, rule)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/templates", response_model=List[RuleTemplateResponse])
def get_rule_templates(
    business_class: Optional[str] = None,
    rule_type: Optional[str] = None,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db),
    account_id: int = Depends(get_current_account_id)
):
    """Get all rule templates with optional filters"""
    return RuleService.get_rule_templates(db, business_class, rule_type, is_active)

@router.get("/templates/{rule_id}", response_model=RuleTemplateResponse)
def get_rule_template(
    rule_id: int,
    db: Session = Depends(get_db),
    account_id: int = Depends(get_current_account_id)
):
    """Get a specific rule template"""
    rule = RuleService.get_rule_template(db, rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="Rule template not found")
    return rule

@router.put("/templates/{rule_id}", response_model=RuleTemplateResponse)
def update_rule_template(
    rule_id: int,
    rule_update: RuleTemplateUpdate,
    db: Session = Depends(get_db),
    account_id: int = Depends(get_current_account_id)
):
    """Update a rule template"""
    rule = RuleService.update_rule_template(db, rule_id, rule_update)
    if not rule:
        raise HTTPException(status_code=404, detail="Rule template not found")
    return rule

@router.delete("/templates/{rule_id}")
def delete_rule_template(
    rule_id: int,
    db: Session = Depends(get_db),
    account_id: int = Depends(get_current_account_id)
):
    """Delete a rule template"""
    success = RuleService.delete_rule_template(db, rule_id)
    if not success:
        raise HTTPException(status_code=404, detail="Rule template not found")
    return {"status": "success", "message": "Rule template deleted"}

# Rule Assignments

@router.post("/assignments", response_model=RuleAssignmentResponse)
def create_rule_assignment(
    assignment: RuleAssignmentCreate,
    db: Session = Depends(get_db),
    account_id: int = Depends(get_current_account_id)
):
    """Assign a rule to an account"""
    try:
        return RuleService.create_rule_assignment(db, assignment)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/assignments", response_model=List[RuleAssignmentResponse])
def get_rule_assignments(
    account_id: Optional[int] = None,
    rule_template_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_account_id: int = Depends(get_current_account_id)
):
    """Get rule assignments with optional filters"""
    return RuleService.get_rule_assignments(db, account_id, rule_template_id)

@router.put("/assignments/{assignment_id}", response_model=RuleAssignmentResponse)
def update_rule_assignment(
    assignment_id: int,
    assignment_update: RuleAssignmentUpdate,
    db: Session = Depends(get_db),
    account_id: int = Depends(get_current_account_id)
):
    """Update a rule assignment (enable/disable, override message)"""
    assignment = RuleService.update_rule_assignment(db, assignment_id, assignment_update)
    if not assignment:
        raise HTTPException(status_code=404, detail="Rule assignment not found")
    return assignment

@router.delete("/assignments/{assignment_id}")
def delete_rule_assignment(
    assignment_id: int,
    db: Session = Depends(get_db),
    account_id: int = Depends(get_current_account_id)
):
    """Delete a rule assignment"""
    success = RuleService.delete_rule_assignment(db, assignment_id)
    if not success:
        raise HTTPException(status_code=404, detail="Rule assignment not found")
    return {"status": "success", "message": "Rule assignment deleted"}

# Combined View

@router.get("/account/{account_id}", response_model=List[RuleWithAssignment])
def get_rules_with_assignments(
    account_id: int,
    business_class: Optional[str] = None,
    db: Session = Depends(get_db),
    current_account_id: int = Depends(get_current_account_id)
):
    """Get all rules with their assignment status for a specific account"""
    return RuleService.get_rules_with_assignments(db, account_id, business_class)


# Rule Sets

from app.modules.rules.rule_set_service import RuleSetService
from app.modules.rules.rule_set_schemas import (
    RuleSetCreate, RuleSetUpdate, RuleSetResponse, RuleSetWithRules
)

@router.get("/rule-sets", response_model=List[RuleSetResponse])
def get_rule_sets(
    business_class: Optional[str] = None,
    db: Session = Depends(get_db),
    account_id: int = Depends(get_current_account_id)
):
    """
    Get all rule sets, optionally filtered by business class.
    Returns Common rule set first, then others alphabetically.
    Includes rule count for each set.
    """
    rule_sets = RuleSetService.get_all_rule_sets(db, business_class)
    
    # Add rule count to each set
    result = []
    for rule_set in rule_sets:
        rule_count = RuleSetService.get_rule_count(db, rule_set.id)
        rule_set_dict = {
            "id": rule_set.id,
            "name": rule_set.name,
            "business_class": rule_set.business_class,
            "description": rule_set.description,
            "is_common": rule_set.is_common,
            "is_user_default": rule_set.is_user_default,
            "is_active": rule_set.is_active,
            "created_at": rule_set.created_at,
            "updated_at": rule_set.updated_at,
            "rule_count": rule_count
        }
        result.append(rule_set_dict)
    
    return result

@router.get("/rule-sets/{rule_set_id}", response_model=RuleSetWithRules)
def get_rule_set(
    rule_set_id: int,
    db: Session = Depends(get_db),
    account_id: int = Depends(get_current_account_id)
):
    """Get a specific rule set with its rules"""
    rule_set = RuleSetService.get_rule_set_by_id(db, rule_set_id)
    
    if not rule_set:
        raise HTTPException(status_code=404, detail="Rule set not found")
    
    # Get rules for this set
    rules = RuleSetService.get_rules_for_set(db, rule_set_id)
    
    return {
        "id": rule_set.id,
        "name": rule_set.name,
        "business_class": rule_set.business_class,
        "description": rule_set.description,
        "is_common": rule_set.is_common,
        "is_user_default": rule_set.is_user_default,
        "is_active": rule_set.is_active,
        "created_at": rule_set.created_at,
        "updated_at": rule_set.updated_at,
        "rule_count": len(rules),
        "rules": [RuleTemplateResponse.from_orm(rule) for rule in rules]
    }

@router.post("/rule-sets", response_model=RuleSetResponse)
def create_rule_set(
    rule_set: RuleSetCreate,
    db: Session = Depends(get_db),
    account_id: int = Depends(get_current_account_id)
):
    """Create a new rule set"""
    try:
        created_set = RuleSetService.create_rule_set(
            db,
            name=rule_set.name,
            business_class=rule_set.business_class,
            description=rule_set.description,
            is_active=rule_set.is_active
        )
        
        rule_count = RuleSetService.get_rule_count(db, created_set.id)
        
        return {
            "id": created_set.id,
            "name": created_set.name,
            "business_class": created_set.business_class,
            "description": created_set.description,
            "is_common": created_set.is_common,
            "is_user_default": created_set.is_user_default,
            "is_active": created_set.is_active,
            "created_at": created_set.created_at,
            "updated_at": created_set.updated_at,
            "rule_count": rule_count
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/rule-sets/{rule_set_id}", response_model=RuleSetResponse)
def update_rule_set(
    rule_set_id: int,
    rule_set: RuleSetUpdate,
    db: Session = Depends(get_db),
    account_id: int = Depends(get_current_account_id)
):
    """Update a rule set"""
    try:
        updated_set = RuleSetService.update_rule_set(
            db,
            rule_set_id=rule_set_id,
            name=rule_set.name,
            description=rule_set.description,
            is_active=rule_set.is_active
        )
        
        rule_count = RuleSetService.get_rule_count(db, updated_set.id)
        
        return {
            "id": updated_set.id,
            "name": updated_set.name,
            "business_class": updated_set.business_class,
            "description": updated_set.description,
            "is_common": updated_set.is_common,
            "is_user_default": updated_set.is_user_default,
            "is_active": updated_set.is_active,
            "created_at": updated_set.created_at,
            "updated_at": updated_set.updated_at,
            "rule_count": rule_count
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/rule-sets/{rule_set_id}")
def delete_rule_set(
    rule_set_id: int,
    db: Session = Depends(get_db),
    account_id: int = Depends(get_current_account_id)
):
    """Delete a rule set (cannot delete Common rule sets)"""
    try:
        RuleSetService.delete_rule_set(db, rule_set_id)
        return {"message": "Rule set deleted successfully"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/rule-sets/{rule_set_id}/make-default")
def make_rule_set_default(
    rule_set_id: int,
    db: Session = Depends(get_db),
    account_id: int = Depends(get_current_account_id)
):
    """Make a custom rule set the default for its business class"""
    try:
        RuleSetService.make_rule_set_default(db, rule_set_id)
        return {"message": "Rule set is now the default"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/rule-sets/{rule_set_id}/reset-default")
def reset_to_original_default(
    rule_set_id: int,
    db: Session = Depends(get_db),
    account_id: int = Depends(get_current_account_id)
):
    """Reset to the original Default rule set for the business class"""
    try:
        RuleSetService.reset_to_original_default(db, rule_set_id)
        return {"message": "Reset to original Default rule set"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/rule-sets/{rule_set_id}/rules", response_model=List[RuleTemplateResponse])
def get_rules_for_set(
    rule_set_id: int,
    db: Session = Depends(get_db),
    account_id: int = Depends(get_current_account_id)
):
    """Get all rules in a specific rule set"""
    rule_set = RuleSetService.get_rule_set_by_id(db, rule_set_id)
    
    if not rule_set:
        raise HTTPException(status_code=404, detail="Rule set not found")
    
    rules = RuleSetService.get_rules_for_set(db, rule_set_id)
    return [RuleTemplateResponse.from_orm(rule) for rule in rules]

@router.get("/rule-sets/{rule_set_id}/fields")
def get_rule_set_fields(
    rule_set_id: int,
    account_id: int = Depends(get_current_account_id),
    db: Session = Depends(get_db)
):
    """
    Get all fields from the business class schema with their associated rules.
    Returns a field-centric view showing which fields have rules and which don't.
    
    Returns:
        - business_class: Business class name
        - rule_set_name: Rule set name
        - fields: List of all fields with their rules
    """
    from app.models.validation_rule_set import ValidationRuleSet
    from app.models.rule import ValidationRuleTemplate
    from app.models.schema import Schema
    import json
    
    try:
        # Get rule set
        rule_set = db.query(ValidationRuleSet).filter(
            ValidationRuleSet.id == rule_set_id
        ).first()
        
        if not rule_set:
            raise HTTPException(
                status_code=404,
                detail=f"Rule set {rule_set_id} not found"
            )
        
        business_class = rule_set.business_class
        
        # Get latest active schema for this business class
        # Try current account first, then fall back to any account's schema
        # (schemas are the same regardless of account — they come from swagger files)
        schema = db.query(Schema).filter(
            Schema.account_id == account_id,
            Schema.business_class == business_class,
            Schema.is_active == True
        ).order_by(Schema.version_number.desc()).first()
        
        if not schema:
            schema = db.query(Schema).filter(
                Schema.business_class == business_class,
                Schema.is_active == True
            ).order_by(Schema.version_number.desc()).first()
        
        if not schema:
            raise HTTPException(
                status_code=404,
                detail=f"No active schema found for {business_class}"
            )
        
        # Parse schema to get all fields
        schema_json = json.loads(schema.schema_json)
        properties = schema_json.get("properties", {})
        required_fields = schema_json.get("required", [])
        
        # Get all rules for this rule set
        rules = db.query(ValidationRuleTemplate).filter(
            ValidationRuleTemplate.rule_set_id == rule_set_id,
            ValidationRuleTemplate.is_active == True
        ).all()
        
        # Group rules by field name
        rules_by_field = {}
        for rule in rules:
            field_name = rule.field_name
            if field_name not in rules_by_field:
                rules_by_field[field_name] = []
            rules_by_field[field_name].append({
                "id": rule.id,
                "name": rule.name,
                "rule_type": rule.rule_type,
                "field_name": rule.field_name,
                "source": rule.source,
                "is_readonly": rule.is_readonly,
                "error_message": rule.error_message,
                "reference_business_class": rule.reference_business_class,
                "reference_field_name": rule.reference_field_name,
                "condition_expression": rule.condition_expression,
                "pattern": rule.pattern,
                "enum_values": json.loads(rule.enum_values) if rule.enum_values else None
            })
        
        # Build field list with rules
        fields = []
        for field_name, field_def in properties.items():
            field_rules = rules_by_field.get(field_name, [])
            
            fields.append({
                "field_name": field_name,
                "field_type": field_def.get("type", "string"),
                "required": field_name in required_fields,
                "description": field_def.get("description"),
                "enum_values": field_def.get("enum"),
                "pattern": field_def.get("pattern"),
                "rules": field_rules,
                "rule_count": len(field_rules)
            })
        
        # Sort fields: required first, then alphabetically
        fields.sort(key=lambda x: (not x["required"], x["field_name"]))

        # Append file-level rules as a virtual entry (not a schema field)
        file_level_rules = rules_by_field.get("_file_level_", [])
        if file_level_rules:
            fields.append({
                "field_name": "_file_level_",
                "field_type": None,
                "required": False,
                "description": None,
                "enum_values": None,
                "pattern": None,
                "rules": file_level_rules,
                "rule_count": len(file_level_rules)
            })

        return {
            "business_class": business_class,
            "rule_set_id": rule_set_id,
            "rule_set_name": rule_set.name,
            "is_common": rule_set.is_common,
            "schema_id": schema.id,
            "schema_version": schema.version_number,
            "total_fields": len(fields),
            "fields_with_rules": len([f for f in fields if f["rule_count"] > 0]),
            "fields": fields
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get rule set fields: {str(e)}"
        )



@router.get("/rule-sets/{rule_set_id}/export")
def export_rule_set(
    rule_set_id: int,
    db: Session = Depends(get_db),
    account_id: int = Depends(get_current_account_id)
):
    """Export a rule set and its rules as a portable JSON file."""
    rule_set = RuleSetService.get_rule_set_by_id(db, rule_set_id)
    if not rule_set:
        raise HTTPException(status_code=404, detail="Rule set not found")

    rules = RuleSetService.get_rules_for_set(db, rule_set_id)

    export_data = {
        "databridge_export": "rule_set",
        "version": "1.0",
        "rule_set": {
            "name": rule_set.name,
            "business_class": rule_set.business_class,
            "description": rule_set.description,
            "is_active": rule_set.is_active,
        },
        "rules": [
            {
                "name": r.name,
                "rule_type": r.rule_type,
                "field_name": r.field_name,
                "from_field": r.from_field,
                "reference_business_class": r.reference_business_class,
                "reference_field_name": r.reference_field_name,
                "condition_expression": r.condition_expression,
                "error_message": r.error_message,
                "is_active": r.is_active,
                "is_readonly": r.is_readonly,
                "source": r.source,
                "pattern": r.pattern,
                "enum_values": r.enum_values,
            }
            for r in rules
        ],
    }

    safe_name = rule_set.name.replace(" ", "_").replace("/", "_")
    filename = f"{rule_set.business_class}_{safe_name}_rules.json"

    return JSONResponse(
        content=export_data,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/rule-sets/import")
async def import_rule_set(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    account_id: int = Depends(get_current_account_id)
):
    """Import a rule set from a previously exported JSON file."""
    try:
        content = await file.read()
        data = json.loads(content)
    except (json.JSONDecodeError, UnicodeDecodeError):
        raise HTTPException(status_code=400, detail="Invalid JSON file")

    if data.get("databridge_export") != "rule_set":
        raise HTTPException(status_code=400, detail="Not a valid DataBridge rule set export file")

    rs = data.get("rule_set", {})
    rules_data = data.get("rules", [])

    if not rs.get("name") or not rs.get("business_class"):
        raise HTTPException(status_code=400, detail="Export file missing rule set name or business class")

    # Check for name collision and auto-rename
    base_name = rs["name"]
    final_name = base_name
    suffix = 1
    while RuleSetService.get_rule_set_by_name(db, rs["business_class"], final_name):
        suffix += 1
        final_name = f"{base_name} ({suffix})"

    try:
        created_set = RuleSetService.create_rule_set(
            db,
            name=final_name,
            business_class=rs["business_class"],
            description=rs.get("description") or f"Imported from {file.filename}",
            is_active=rs.get("is_active", True),
        )

        imported_count = 0
        for rule in rules_data:
            from app.models.rule import ValidationRuleTemplate
            new_rule = ValidationRuleTemplate(
                name=rule.get("name", "Imported Rule"),
                business_class=rs["business_class"],
                rule_set_id=created_set.id,
                rule_type=rule.get("rule_type", "REQUIRED_FIELD"),
                field_name=rule.get("field_name", ""),
                from_field=rule.get("from_field"),
                reference_business_class=rule.get("reference_business_class"),
                reference_field_name=rule.get("reference_field_name"),
                condition_expression=rule.get("condition_expression"),
                error_message=rule.get("error_message", "Validation failed"),
                is_active=rule.get("is_active", True),
                source=rule.get("source", "custom"),
                is_readonly=rule.get("is_readonly", False),
                pattern=rule.get("pattern"),
                enum_values=rule.get("enum_values"),
            )
            db.add(new_rule)
            imported_count += 1

        db.commit()

        return {
            "message": f"Rule set '{final_name}' imported successfully with {imported_count} rules",
            "rule_set_id": created_set.id,
            "name": final_name,
            "rules_imported": imported_count,
        }

    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")
