from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from typing import List, Optional
from app.models.rule import ValidationRuleTemplate, ValidationRuleAssignment
from app.modules.rules.schemas import (
    RuleTemplateCreate, RuleTemplateUpdate,
    RuleAssignmentCreate, RuleAssignmentUpdate,
    RuleWithAssignment
)

class RuleService:
    
    @staticmethod
    def create_rule_template(db: Session, rule: RuleTemplateCreate) -> ValidationRuleTemplate:
        """Create a new validation rule template"""
        db_rule = ValidationRuleTemplate(**rule.model_dump())
        db.add(db_rule)
        db.commit()
        db.refresh(db_rule)
        return db_rule
    
    @staticmethod
    def get_rule_templates(
        db: Session,
        business_class: Optional[str] = None,
        rule_type: Optional[str] = None,
        is_active: Optional[bool] = None
    ) -> List[ValidationRuleTemplate]:
        """Get all rule templates with optional filters"""
        query = db.query(ValidationRuleTemplate)
        
        if business_class is not None:
            # Include GLOBAL rules (business_class is NULL) and specific business class rules
            query = query.filter(
                or_(
                    ValidationRuleTemplate.business_class == business_class,
                    ValidationRuleTemplate.business_class.is_(None)
                )
            )
        
        if rule_type:
            query = query.filter(ValidationRuleTemplate.rule_type == rule_type)
        
        if is_active is not None:
            query = query.filter(ValidationRuleTemplate.is_active == is_active)
        
        return query.order_by(ValidationRuleTemplate.created_at.desc()).all()
    
    @staticmethod
    def get_rule_template(db: Session, rule_id: int) -> Optional[ValidationRuleTemplate]:
        """Get a specific rule template by ID"""
        return db.query(ValidationRuleTemplate).filter(ValidationRuleTemplate.id == rule_id).first()
    
    @staticmethod
    def update_rule_template(
        db: Session,
        rule_id: int,
        rule_update: RuleTemplateUpdate
    ) -> Optional[ValidationRuleTemplate]:
        """Update a rule template"""
        db_rule = db.query(ValidationRuleTemplate).filter(ValidationRuleTemplate.id == rule_id).first()
        if not db_rule:
            return None
        
        update_data = rule_update.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_rule, field, value)
        
        db.commit()
        db.refresh(db_rule)
        return db_rule
    
    @staticmethod
    def delete_rule_template(db: Session, rule_id: int) -> bool:
        """Delete a rule template (cascades to assignments)"""
        db_rule = db.query(ValidationRuleTemplate).filter(ValidationRuleTemplate.id == rule_id).first()
        if not db_rule:
            return False
        
        db.delete(db_rule)
        db.commit()
        return True
    
    @staticmethod
    def create_rule_assignment(db: Session, assignment: RuleAssignmentCreate) -> ValidationRuleAssignment:
        """Assign a rule to an account"""
        db_assignment = ValidationRuleAssignment(**assignment.model_dump())
        db.add(db_assignment)
        db.commit()
        db.refresh(db_assignment)
        return db_assignment
    
    @staticmethod
    def get_rule_assignments(
        db: Session,
        account_id: Optional[int] = None,
        rule_template_id: Optional[int] = None
    ) -> List[ValidationRuleAssignment]:
        """Get rule assignments with optional filters"""
        query = db.query(ValidationRuleAssignment)
        
        if account_id is not None:
            query = query.filter(ValidationRuleAssignment.account_id == account_id)
        
        if rule_template_id is not None:
            query = query.filter(ValidationRuleAssignment.rule_template_id == rule_template_id)
        
        return query.all()
    
    @staticmethod
    def update_rule_assignment(
        db: Session,
        assignment_id: int,
        assignment_update: RuleAssignmentUpdate
    ) -> Optional[ValidationRuleAssignment]:
        """Update a rule assignment"""
        db_assignment = db.query(ValidationRuleAssignment).filter(
            ValidationRuleAssignment.id == assignment_id
        ).first()
        
        if not db_assignment:
            return None
        
        update_data = assignment_update.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_assignment, field, value)
        
        db.commit()
        db.refresh(db_assignment)
        return db_assignment
    
    @staticmethod
    def delete_rule_assignment(db: Session, assignment_id: int) -> bool:
        """Delete a rule assignment"""
        db_assignment = db.query(ValidationRuleAssignment).filter(
            ValidationRuleAssignment.id == assignment_id
        ).first()
        
        if not db_assignment:
            return False
        
        db.delete(db_assignment)
        db.commit()
        return True
    
    @staticmethod
    def get_rules_with_assignments(
        db: Session,
        account_id: int,
        business_class: Optional[str] = None
    ) -> List[RuleWithAssignment]:
        """Get all rules with their assignment status for a specific account"""
        # Get all applicable rule templates
        rules = RuleService.get_rule_templates(db, business_class=business_class, is_active=True)
        
        # Get all assignments for this account
        assignments = RuleService.get_rule_assignments(db, account_id=account_id)
        assignment_map = {a.rule_template_id: a for a in assignments}
        
        # Combine rules with their assignments
        result = []
        for rule in rules:
            rule_dict = {
                "id": rule.id,
                "name": rule.name,
                "business_class": rule.business_class,
                "rule_type": rule.rule_type,
                "field_name": rule.field_name,
                "reference_business_class": rule.reference_business_class,
                "condition_expression": rule.condition_expression,
                "error_message": rule.error_message,
                "is_active": rule.is_active,
                "version": rule.version,
                "created_at": rule.created_at,
                "updated_at": rule.updated_at,
                "assignment_id": None,
                "is_enabled": True,  # Default to enabled if no assignment
                "override_error_message": None
            }
            
            # Check if there's an assignment for this rule
            if rule.id in assignment_map:
                assignment = assignment_map[rule.id]
                rule_dict["assignment_id"] = assignment.id
                rule_dict["is_enabled"] = assignment.is_enabled
                rule_dict["override_error_message"] = assignment.override_error_message
            
            result.append(RuleWithAssignment(**rule_dict))
        
        return result
