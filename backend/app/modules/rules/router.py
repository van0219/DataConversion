from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.database import get_db
from app.modules.accounts.router import get_current_account_id
from app.modules.rules.service import RuleService
from app.modules.rules.schemas import (
    RuleTemplateCreate, RuleTemplateUpdate, RuleTemplateResponse,
    RuleAssignmentCreate, RuleAssignmentUpdate, RuleAssignmentResponse,
    RuleWithAssignment
)

router = APIRouter()

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
        schema = db.query(Schema).filter(
            Schema.account_id == account_id,
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
                "source": rule.source,
                "is_readonly": rule.is_readonly,
                "error_message": rule.error_message,
                "reference_business_class": rule.reference_business_class,
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

