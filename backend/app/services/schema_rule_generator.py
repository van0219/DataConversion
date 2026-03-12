"""
Schema Rule Generator Service

Automatically generates validation rules from FSM schema metadata.
Creates a default rule set for each business class.
"""
import json
import logging
from typing import Dict, List
from sqlalchemy.orm import Session

from app.models.rule import ValidationRuleTemplate
from app.models.schema import Schema
from app.modules.rules.rule_set_service import RuleSetService

logger = logging.getLogger(__name__)


class SchemaRuleGenerator:
    """Generate validation rules from schema metadata."""
    
    @staticmethod
    def generate_rules_for_schema(db: Session, schema: Schema) -> Dict:
        """
        Generate validation rules from schema metadata.
        Creates a default rule set for the business class if it doesn't exist.
        
        Args:
            db: Database session
            schema: Schema object
            
        Returns:
            dict with counts of generated rules and rule set info
        """
        business_class = schema.business_class
        schema_id = schema.id
        
        # Get or create default rule set for this business class
        rule_set_name = f"{business_class}_Default"
        rule_set = RuleSetService.get_rule_set_by_name(db, business_class, rule_set_name)
        
        if not rule_set:
            logger.info(f"Creating default rule set: {rule_set_name}")
            rule_set = RuleSetService.create_rule_set(
                db=db,
                name=rule_set_name,
                business_class=business_class,
                description=f"Auto-generated schema validation rules for {business_class}",
                is_active=True
            )
        
        rule_set_id = rule_set.id
        
        # Parse schema JSON to get field definitions
        schema_json = json.loads(schema.schema_json)
        properties = schema_json.get("properties", {})
        
        # Parse metadata
        required_fields = json.loads(schema.required_fields_json) if schema.required_fields_json else []
        enum_fields = json.loads(schema.enum_fields_json) if schema.enum_fields_json else {}
        date_fields = json.loads(schema.date_fields_json) if schema.date_fields_json else []
        
        rules_created = {
            "pattern": 0,
            "enum": 0,
            "required": 0,
            "total": 0,
            "rule_set_id": rule_set_id,
            "rule_set_name": rule_set_name
        }
        
        # 1. Generate PATTERN_MATCH rules for date fields
        for field_name in properties.keys():
            field_def = properties[field_name]
            pattern = field_def.get("pattern")
            
            if pattern:
                # Check if rule already exists
                existing = db.query(ValidationRuleTemplate).filter(
                    ValidationRuleTemplate.business_class == business_class,
                    ValidationRuleTemplate.field_name == field_name,
                    ValidationRuleTemplate.rule_type == "PATTERN_MATCH",
                    ValidationRuleTemplate.source == "schema"
                ).first()
                
                if not existing:
                    description = field_def.get("description", "")
                    rule = ValidationRuleTemplate(
                        name=f"{field_name} Pattern Validation",
                        business_class=business_class,
                        rule_set_id=rule_set_id,
                        rule_type="PATTERN_MATCH",
                        field_name=field_name,
                        pattern=pattern,
                        error_message=f"Invalid format for {field_name}. {description}",
                        source="schema",
                        is_readonly=True,
                        schema_id=schema_id,
                        is_active=True
                    )
                    db.add(rule)
                    rules_created["pattern"] += 1
        
        # 2. Generate ENUM_VALIDATION rules for enum fields
        for field_name, enum_values in enum_fields.items():
            # Check if rule already exists
            existing = db.query(ValidationRuleTemplate).filter(
                ValidationRuleTemplate.business_class == business_class,
                ValidationRuleTemplate.field_name == field_name,
                ValidationRuleTemplate.rule_type == "ENUM_VALIDATION",
                ValidationRuleTemplate.source == "schema"
            ).first()
            
            if not existing:
                rule = ValidationRuleTemplate(
                    name=f"{field_name} Enum Validation",
                    business_class=business_class,
                    rule_set_id=rule_set_id,
                    rule_type="ENUM_VALIDATION",
                    field_name=field_name,
                    enum_values=json.dumps(enum_values),
                    error_message=f"Invalid value for {field_name}. Allowed values: {', '.join(enum_values)}",
                    source="schema",
                    is_readonly=True,
                    schema_id=schema_id,
                    is_active=True
                )
                db.add(rule)
                rules_created["enum"] += 1
        
        # 3. Generate REQUIRED_FIELD rules
        for field_name in required_fields:
            # Check if rule already exists
            existing = db.query(ValidationRuleTemplate).filter(
                ValidationRuleTemplate.business_class == business_class,
                ValidationRuleTemplate.field_name == field_name,
                ValidationRuleTemplate.rule_type == "REQUIRED_FIELD",
                ValidationRuleTemplate.source == "schema"
            ).first()
            
            if not existing:
                rule = ValidationRuleTemplate(
                    name=f"{field_name} Required",
                    business_class=business_class,
                    rule_set_id=rule_set_id,
                    rule_type="REQUIRED_FIELD",
                    field_name=field_name,
                    error_message=f"{field_name} is required",
                    source="schema",
                    is_readonly=True,
                    schema_id=schema_id,
                    is_active=True
                )
                db.add(rule)
                rules_created["required"] += 1
        
        db.commit()
        
        rules_created["total"] = rules_created["pattern"] + rules_created["enum"] + rules_created["required"]
        
        logger.info(f"Generated {rules_created['total']} rules for {business_class} in rule set '{rule_set_name}' (schema {schema_id})")
        
        return rules_created
    
    @staticmethod
    def delete_schema_rules(db: Session, schema_id: int):
        """
        Delete all rules generated from a specific schema.
        
        Args:
            db: Database session
            schema_id: Schema ID
        """
        deleted = db.query(ValidationRuleTemplate).filter(
            ValidationRuleTemplate.schema_id == schema_id,
            ValidationRuleTemplate.source == "schema"
        ).delete()
        
        db.commit()
        
        logger.info(f"Deleted {deleted} schema-generated rules for schema {schema_id}")
        
        return deleted
