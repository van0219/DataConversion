from typing import Dict, List, Optional
from sqlalchemy.orm import Session
from app.services.schema_validator import ValidationError
from app.modules.snapshot.service import SnapshotService
from app.core.logging import logger
import re

class RuleExecutor:
    """
    Execute validation rules against records.
    DEMO SCOPE: REFERENCE_EXISTS and REQUIRED_OVERRIDE only.
    Other rule types are stubbed for future implementation.
    """
    
    def __init__(self, db: Session, account_id: int):
        self.db = db
        self.account_id = account_id
        self.reference_cache = {}
    
    async def execute_rule(
        self,
        rule: Dict,
        record: Dict,
        row_number: int
    ) -> Optional[ValidationError]:
        """
        Execute a single validation rule against a record.
        Returns ValidationError if validation fails, None if passes.
        """
        rule_type = rule["rule_type"]
        field_name = rule["field_name"]
        field_value = record.get(field_name)
        
        # DEMO SCOPE: Fully implemented rule types
        if rule_type == "REFERENCE_EXISTS":
            return await self._validate_reference_exists(
                field_name,
                field_value,
                rule["reference_business_class"],
                rule.get("reference_field_name"),
                rule["error_message"],
                row_number
            )
        
        elif rule_type == "REQUIRED_OVERRIDE":
            return self._validate_required_override(
                field_name,
                field_value,
                rule["error_message"],
                row_number
            )
        
        # IMPLEMENTED: Regex pattern validation
        elif rule_type == "REGEX_OVERRIDE":
            return self._validate_regex_override(rule, record, row_number)
        
        elif rule_type == "NUMERIC_COMPARISON":
            return self._validate_numeric_comparison_stub(rule, record, row_number)
        
        elif rule_type == "DATE_COMPARISON":
            return self._validate_date_comparison_stub(rule, record, row_number)
        
        elif rule_type == "CONDITIONAL_REQUIRED":
            return self._validate_conditional_required_stub(rule, record, row_number)
        
        elif rule_type == "CROSS_FIELD":
            return self._validate_cross_field_stub(rule, record, row_number)
        
        elif rule_type == "CUSTOM_EXPRESSION":
            return self._validate_custom_expression_stub(rule, record, row_number)
        
        else:
            logger.warning(f"Unknown rule type: {rule_type}")
            return None
    
    # ========================================================================
    # FULLY IMPLEMENTED RULES (DEMO SCOPE)
    # ========================================================================
    
    async def _validate_reference_exists(
        self,
        field_name: str,
        value: any,
        reference_business_class: str,
        reference_field_name: str,
        error_message: str,
        row_number: int
    ) -> Optional[ValidationError]:
        """
        Validate that referenced record exists in snapshot.
        FULLY IMPLEMENTED for demo.
        """
        if not value or str(value).strip() == "":
            return None
        
        value_str = str(value).strip()
        
        # Use reference_field_name if provided, otherwise use business class name as default
        lookup_field = reference_field_name if reference_field_name else reference_business_class
        
        # Check cache first
        cache_key = f"{reference_business_class}:{lookup_field}:{value_str}"
        if cache_key in self.reference_cache:
            exists = self.reference_cache[cache_key]
        else:
            # Query snapshot using the reference field name
            exists = SnapshotService.check_reference_exists(
                self.db,
                self.account_id,
                reference_business_class,
                value_str
            )
            self.reference_cache[cache_key] = exists
        
        if not exists:
            return ValidationError(
                row_number,
                field_name,
                value,
                "reference",
                error_message or f"Referenced {reference_business_class} '{value}' does not exist"
            )
        
        return None
    
    def _validate_required_override(
        self,
        field_name: str,
        value: any,
        error_message: str,
        row_number: int
    ) -> Optional[ValidationError]:
        """
        Override required field validation with custom message.
        FULLY IMPLEMENTED for demo.
        """
        if not value or str(value).strip() == "":
            return ValidationError(
                row_number,
                field_name,
                value,
                "rule",
                error_message or f"Field '{field_name}' is required"
            )
        
        return None
    
    # ========================================================================
    # STUBBED RULES (FUTURE IMPLEMENTATION)
    # ========================================================================
    
    def _validate_regex_override(
        self,
        rule: Dict,
        record: Dict,
        row_number: int
    ) -> Optional[ValidationError]:
        """
        Validate field value matches regex pattern.
        FULLY IMPLEMENTED - validates using regex pattern from rule.
        """
        field_name = rule["field_name"]
        field_value = record.get(field_name)
        
        # Skip validation if field is empty (unless required by another rule)
        if not field_value or str(field_value).strip() == "":
            return None
        
        value_str = str(field_value).strip()
        pattern = rule.get("condition_expression")
        
        if not pattern:
            logger.warning(f"REGEX_OVERRIDE rule for {field_name} has no pattern")
            return None
        
        try:
            if not re.match(pattern, value_str):
                error_message = rule.get("error_message") or f"Field '{field_name}' does not match required pattern"
                return ValidationError(
                    row_number,
                    field_name,
                    field_value,
                    "rule",
                    error_message
                )
        except re.error as e:
            logger.error(f"Invalid regex pattern '{pattern}': {e}")
            return None
        
        return None
    
    def _validate_numeric_comparison_stub(
        self,
        rule: Dict,
        record: Dict,
        row_number: int
    ) -> Optional[ValidationError]:
        """
        STUB: Numeric comparison validation.
        CORRECTED: Must use explicit operator parsing, NO eval().
        """
        # TODO: Implement with explicit operator handling
        # Supported operators: >, >=, <, <=, ==, !=
        # Example: parse "amount > 0" into operator and value, then compare
        logger.debug(f"STUB: NUMERIC_COMPARISON rule not yet implemented")
        return None
    
    def _validate_date_comparison_stub(
        self,
        rule: Dict,
        record: Dict,
        row_number: int
    ) -> Optional[ValidationError]:
        """STUB: Date comparison validation"""
        logger.debug(f"STUB: DATE_COMPARISON rule not yet implemented")
        return None
    
    def _validate_conditional_required_stub(
        self,
        rule: Dict,
        record: Dict,
        row_number: int
    ) -> Optional[ValidationError]:
        """STUB: Conditional required field validation"""
        logger.debug(f"STUB: CONDITIONAL_REQUIRED rule not yet implemented")
        return None
    
    def _validate_cross_field_stub(
        self,
        rule: Dict,
        record: Dict,
        row_number: int
    ) -> Optional[ValidationError]:
        """STUB: Cross-field validation"""
        logger.debug(f"STUB: CROSS_FIELD rule not yet implemented")
        return None
    
    def _validate_custom_expression_stub(
        self,
        rule: Dict,
        record: Dict,
        row_number: int
    ) -> Optional[ValidationError]:
        """STUB: Custom expression validation"""
        logger.debug(f"STUB: CUSTOM_EXPRESSION rule not yet implemented")
        return None
