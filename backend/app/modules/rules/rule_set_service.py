from sqlalchemy.orm import Session
from typing import List, Optional
from app.models.validation_rule_set import ValidationRuleSet
from app.models.rule import ValidationRuleTemplate
from app.core.logging import logger

class RuleSetService:
    """Service for managing validation rule sets"""
    
    @staticmethod
    def get_all_rule_sets(db: Session, business_class: Optional[str] = None) -> List[ValidationRuleSet]:
        """
        Get all rule sets, optionally filtered by business class.
        Returns Common rule set first, then others alphabetically.
        """
        query = db.query(ValidationRuleSet)
        
        # Filter by business class if provided and not empty
        if business_class is not None and business_class.strip():
            query = query.filter(ValidationRuleSet.business_class == business_class)
        
        # Order: Common first, then by name
        rule_sets = query.order_by(
            ValidationRuleSet.is_common.desc(),
            ValidationRuleSet.name
        ).all()
        
        return rule_sets
    
    @staticmethod
    def get_rule_set_by_id(db: Session, rule_set_id: int) -> Optional[ValidationRuleSet]:
        """Get rule set by ID"""
        return db.query(ValidationRuleSet).filter(ValidationRuleSet.id == rule_set_id).first()
    
    @staticmethod
    def get_rule_set_by_name(db: Session, business_class: str, name: str) -> Optional[ValidationRuleSet]:
        """Get rule set by business class and name"""
        return db.query(ValidationRuleSet).filter(
            ValidationRuleSet.business_class == business_class,
            ValidationRuleSet.name == name
        ).first()
    
    @staticmethod
    def get_common_rule_set(db: Session, business_class: str) -> Optional[ValidationRuleSet]:
        """Get the Common rule set for a business class"""
        return db.query(ValidationRuleSet).filter(
            ValidationRuleSet.business_class == business_class,
            ValidationRuleSet.is_common == True
        ).first()
    
    @staticmethod
    def get_or_create_common_rule_set(db: Session, business_class: str) -> ValidationRuleSet:
        """
        Get or create the Default rule set for a business class.
        Default rule sets are created automatically when needed.
        """
        default_set = RuleSetService.get_common_rule_set(db, business_class)
        
        if not default_set:
            default_set = ValidationRuleSet(
                name="Default",
                business_class=business_class,
                description=f"Default validation rules for {business_class}. These rules always apply to all conversions.",
                is_common=True,
                is_active=True
            )
            db.add(default_set)
            db.commit()
            db.refresh(default_set)
            logger.info(f"Created Default rule set for {business_class}")
        
        return default_set
    
    @staticmethod
    def create_rule_set(
        db: Session,
        name: str,
        business_class: str,
        description: Optional[str] = None,
        is_active: bool = True
    ) -> ValidationRuleSet:
        """
        Create a new rule set.
        Cannot create additional Common rule sets (one per business class).
        """
        # Check if name already exists for this business class
        existing = db.query(ValidationRuleSet).filter(
            ValidationRuleSet.business_class == business_class,
            ValidationRuleSet.name == name
        ).first()
        
        if existing:
            raise ValueError(f"Rule set '{name}' already exists for {business_class}")
        
        # Prevent creating Common rule sets manually
        if name.lower() == "common":
            raise ValueError("Cannot create 'Common' rule set manually. It is created automatically.")
        
        rule_set = ValidationRuleSet(
            name=name,
            business_class=business_class,
            description=description,
            is_common=False,  # User-created sets are never Common
            is_active=is_active
        )
        
        db.add(rule_set)
        db.commit()
        db.refresh(rule_set)
        
        logger.info(f"Created rule set: {name} for {business_class}")
        return rule_set
    
    @staticmethod
    def update_rule_set(
        db: Session,
        rule_set_id: int,
        name: Optional[str] = None,
        description: Optional[str] = None,
        is_active: Optional[bool] = None
    ) -> ValidationRuleSet:
        """
        Update rule set.
        Cannot rename Common rule sets or deactivate them.
        """
        rule_set = RuleSetService.get_rule_set_by_id(db, rule_set_id)
        
        if not rule_set:
            raise ValueError(f"Rule set with ID {rule_set_id} not found")
        
        # Protect Default rule sets
        if rule_set.is_common:
            if name is not None and name != "Default":
                raise ValueError("Cannot rename Default rule set")
            if is_active is not None and not is_active:
                raise ValueError("Cannot deactivate Default rule set")
        
        # Update fields
        if name is not None:
            # Check for name conflicts
            existing = db.query(ValidationRuleSet).filter(
                ValidationRuleSet.business_class == rule_set.business_class,
                ValidationRuleSet.name == name,
                ValidationRuleSet.id != rule_set_id
            ).first()
            
            if existing:
                raise ValueError(f"Rule set '{name}' already exists for {rule_set.business_class}")
            
            rule_set.name = name
        
        if description is not None:
            rule_set.description = description
        
        if is_active is not None:
            rule_set.is_active = is_active
        
        db.commit()
        db.refresh(rule_set)
        
        logger.info(f"Updated rule set: {rule_set.name}")
        return rule_set
    
    @staticmethod
    def delete_rule_set(db: Session, rule_set_id: int):
        """
        Delete rule set.
        Cannot delete Common rule sets.
        Deletes all associated rules (CASCADE).
        """
        rule_set = RuleSetService.get_rule_set_by_id(db, rule_set_id)
        
        if not rule_set:
            raise ValueError(f"Rule set with ID {rule_set_id} not found")
        
        # Protect Default rule sets
        if rule_set.is_common:
            raise ValueError("Cannot delete Default rule set")
        
        name = rule_set.name
        business_class = rule_set.business_class
        
        db.delete(rule_set)
        db.commit()
        
        logger.info(f"Deleted rule set: {name} for {business_class}")
    
    @staticmethod
    def get_rules_for_set(db: Session, rule_set_id: int) -> List[ValidationRuleTemplate]:
        """Get all rules in a rule set"""
        return db.query(ValidationRuleTemplate).filter(
            ValidationRuleTemplate.rule_set_id == rule_set_id,
            ValidationRuleTemplate.is_active == True
        ).all()
    
    @staticmethod
    def get_rule_count(db: Session, rule_set_id: int) -> int:
        """Get count of rules in a rule set"""
        return db.query(ValidationRuleTemplate).filter(
            ValidationRuleTemplate.rule_set_id == rule_set_id,
            ValidationRuleTemplate.is_active == True
        ).count()
    
    @staticmethod
    def get_applicable_rules(
        db: Session,
        business_class: str,
        selected_rule_set_id: Optional[int] = None
    ) -> List[ValidationRuleTemplate]:
        """
        Get all applicable rules for validation.
        Returns: Common rules + Selected rule set rules
        """
        # Get Common rule set
        common_set = RuleSetService.get_common_rule_set(db, business_class)
        
        rules = []
        
        # Add Common rules
        if common_set:
            common_rules = RuleSetService.get_rules_for_set(db, common_set.id)
            rules.extend(common_rules)
            logger.debug(f"Loaded {len(common_rules)} Common rules for {business_class}")
        
        # Add Selected rule set rules
        if selected_rule_set_id:
            selected_rules = RuleSetService.get_rules_for_set(db, selected_rule_set_id)
            rules.extend(selected_rules)
            logger.debug(f"Loaded {len(selected_rules)} rules from selected rule set")
        
        logger.info(f"Total applicable rules: {len(rules)} (Common + Selected)")
        return rules
