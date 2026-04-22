from sqlalchemy.orm import Session
from typing import List, Optional
from app.models.validation_rule_set import ValidationRuleSet
from app.models.rule import ValidationRuleTemplate
from app.core.logging import logger

class RuleSetService:
    """Service for managing validation rule sets"""
    
    @staticmethod
    def get_all_rule_sets(db: Session, business_class: Optional[str] = None, account_id: Optional[int] = None) -> List[ValidationRuleSet]:
        """
        Get all rule sets, optionally filtered by business class.
        Shows global rule sets (account_id IS NULL) + current account's rule sets.
        Returns Common rule set first, then others alphabetically.
        """
        from sqlalchemy import or_
        query = db.query(ValidationRuleSet)
        
        # Filter by business class if provided and not empty
        if business_class is not None and business_class.strip():
            query = query.filter(ValidationRuleSet.business_class == business_class)
        
        # Filter: global (NULL account_id) + current account's rule sets
        if account_id is not None:
            query = query.filter(
                or_(
                    ValidationRuleSet.account_id.is_(None),
                    ValidationRuleSet.account_id == account_id
                )
            )
        
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
                name="System Default",
                business_class=business_class,
                description=f"System default validation rules for {business_class}.",
                is_common=True,
                is_active=True
            )
            db.add(default_set)
            db.commit()
            db.refresh(default_set)
            logger.info(f"Created Default rule set for {business_class}")
        elif not default_set.is_active:
            # Reactivate Default + all custom rule sets for this business class
            # (they were deactivated when the schema was soft-deleted)
            db.query(ValidationRuleSet).filter(
                ValidationRuleSet.business_class == business_class
            ).update({"is_active": True})
            db.commit()
            db.refresh(default_set)
            logger.info(f"Reactivated all rule sets for {business_class}")
        
        return default_set
    
    @staticmethod
    def create_rule_set(
        db: Session,
        name: str,
        business_class: str,
        description: Optional[str] = None,
        is_active: bool = True,
        account_id: Optional[int] = None
    ) -> ValidationRuleSet:
        """
        Create a new rule set.
        Cannot create additional Common rule sets (one per business class).
        account_id: set to tie this rule set to a specific account (NULL = global).
        """
        # Check if name already exists for this business class AND account
        existing = db.query(ValidationRuleSet).filter(
            ValidationRuleSet.business_class == business_class,
            ValidationRuleSet.name == name,
            ValidationRuleSet.account_id == account_id
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
            is_common=False,
            is_active=is_active,
            account_id=account_id
        )
        
        db.add(rule_set)
        db.commit()
        db.refresh(rule_set)
        
        logger.info(f"Created rule set: {name} for {business_class} (account_id={account_id})")
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
        
        # Protect System Default rule sets
        if rule_set.is_common:
            if name is not None and name != "System Default":
                raise ValueError("Cannot rename System Default rule set")
            if is_active is not None and not is_active:
                raise ValueError("Cannot deactivate System Default rule set")
        
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
        
        # Protect System Default rule sets
        if rule_set.is_common:
            raise ValueError("Cannot delete System Default rule set")
        
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

    @staticmethod
    def make_rule_set_default(db: Session, rule_set_id: int):
        """
        Make a custom rule set the default for its business class.
        Only one rule set per business class can be the user default.
        Cannot make the original Default (is_common=True) the user default.
        """
        rule_set = db.query(ValidationRuleSet).filter(ValidationRuleSet.id == rule_set_id).first()
        
        if not rule_set:
            raise ValueError("Rule set not found")
        
        if rule_set.is_common:
            raise ValueError("Cannot make the original System Default rule set a user default (it's already the system default)")
        
        # Clear any existing user default for this business class
        db.query(ValidationRuleSet).filter(
            ValidationRuleSet.business_class == rule_set.business_class,
            ValidationRuleSet.is_user_default == True
        ).update({"is_user_default": False})
        
        # Set this rule set as the user default
        rule_set.is_user_default = True
        db.commit()
        db.refresh(rule_set)
        
        logger.info(f"Rule set '{rule_set.name}' is now the default for {rule_set.business_class}")
        return rule_set
    
    @staticmethod
    def reset_to_original_default(db: Session, rule_set_id: int):
        """
        Reset to the original Default rule set for the business class.
        Clears the is_user_default flag from all custom rule sets for this business class.
        """
        rule_set = db.query(ValidationRuleSet).filter(ValidationRuleSet.id == rule_set_id).first()
        
        if not rule_set:
            raise ValueError("Rule set not found")
        
        # Clear user default for this business class
        db.query(ValidationRuleSet).filter(
            ValidationRuleSet.business_class == rule_set.business_class,
            ValidationRuleSet.is_user_default == True
        ).update({"is_user_default": False})
        
        db.commit()
        
        logger.info(f"Reset to original System Default rule set for {rule_set.business_class}")
