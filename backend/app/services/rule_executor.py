from typing import Dict, List, Optional
from sqlalchemy.orm import Session
from app.services.schema_validator import ValidationError
from app.modules.snapshot.service import SnapshotService
from app.core.logging import logger
import re
import json
from datetime import datetime, date

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
        
        # RunGroup is always injected from the filename at load time — never validate it
        if field_name and 'rungroup' in field_name.lower():
            return None

        # File-level rules (e.g. BALANCE_CHECK) use sentinel field name — skip in per-row execution
        if field_name == '_file_level_':
            return None
        
        # DEMO SCOPE: Fully implemented rule types
        if rule_type == "REFERENCE_EXISTS":
            # Support optional filter via condition_expression JSON
            # e.g. {"filter_field": "Status", "filter_value": "Active"}
            filter_field = None
            filter_value = None
            cond = rule.get("condition_expression")
            if cond:
                try:
                    cond_cfg = json.loads(cond)
                    filter_field = cond_cfg.get("filter_field")
                    filter_value = cond_cfg.get("filter_value")
                except Exception:
                    pass
            return await self._validate_reference_exists(
                field_name,
                field_value,
                rule["reference_business_class"],
                rule.get("reference_field_name"),
                rule["error_message"],
                row_number,
                filter_field=filter_field,
                filter_value=filter_value
            )
        
        elif rule_type == "REQUIRED_OVERRIDE":
            return self._validate_required_override(
                field_name,
                field_value,
                rule["error_message"],
                row_number
            )
        
        # IMPLEMENTED: Pattern matching validation
        elif rule_type == "PATTERN_MATCH":
            return self._validate_pattern_match(
                field_name,
                field_value,
                rule.get("condition_expression") or rule.get("pattern"),
                rule["error_message"],
                row_number
            )
        
        # IMPLEMENTED: Enum validation
        elif rule_type == "ENUM_VALIDATION":
            return self._validate_enum_validation(
                field_name,
                field_value,
                rule.get("enum_values"),
                rule["error_message"],
                row_number
            )
        
        # IMPLEMENTED: Required field validation
        elif rule_type == "REQUIRED_FIELD":
            return self._validate_required_override(
                field_name,
                field_value,
                rule["error_message"],
                row_number
            )
        
        # IMPLEMENTED: Regex pattern validation
        elif rule_type == "REGEX_OVERRIDE":
            return self._validate_regex_override(rule, record, row_number)
        
        elif rule_type == "FIELD_MUST_BE_EMPTY":
            return self._validate_field_must_be_empty(rule, record, row_number)

        elif rule_type == "DATE_RANGE_FROM_REFERENCE":
            return await self._validate_date_range_from_reference(rule, record, row_number)

        elif rule_type == "OPEN_PERIOD_CHECK":
            return await self._validate_open_period_check(rule, record, row_number)

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
        row_number: int,
        filter_field: str = None,
        filter_value: str = None
    ) -> Optional[ValidationError]:
        """
        Validate that referenced record exists in snapshot.
        Supports optional status filter (e.g. only Active records).
        """
        if not value or str(value).strip() == "":
            return None
        
        value_str = str(value).strip()
        lookup_field = reference_field_name if reference_field_name else reference_business_class
        
        cache_key = f"{reference_business_class}:{lookup_field}:{value_str}:{filter_field}:{filter_value}"
        if cache_key in self.reference_cache:
            exists = self.reference_cache[cache_key]
        else:
            if filter_field and filter_value:
                # Filtered lookup — check raw_json for the filter condition
                exists = self._check_reference_with_filter(
                    reference_business_class, value_str, filter_field, filter_value
                )
            else:
                exists = SnapshotService.check_reference_exists(
                    self.db, self.account_id, reference_business_class, value_str
                )
            self.reference_cache[cache_key] = exists
        
        if not exists:
            return ValidationError(
                row_number, field_name, value, "reference",
                error_message or f"Referenced {reference_business_class} '{value}' does not exist"
            )
        return None

    def _check_reference_with_filter(
        self,
        business_class: str,
        primary_key: str,
        filter_field: str,
        filter_value: str
    ) -> bool:
        """
        Check reference exists AND a specific field in raw_json matches filter_value.
        Used for status-filtered lookups (e.g. Account where Status = Active).
        """
        from app.models.snapshot import SnapshotRecord
        record = self.db.query(SnapshotRecord).filter(
            SnapshotRecord.account_id == self.account_id,
            SnapshotRecord.business_class == business_class,
            SnapshotRecord.primary_key == primary_key
        ).first()
        if not record:
            return False
        try:
            data = json.loads(record.raw_json)
            return str(data.get(filter_field, "")).strip() == str(filter_value).strip()
        except Exception:
            return False
    
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
    
    def _validate_pattern_match(
        self,
        field_name: str,
        field_value: any,
        pattern: str,
        error_message: str,
        row_number: int
    ) -> Optional[ValidationError]:
        """
        Validate field value matches regex pattern.
        FULLY IMPLEMENTED - validates using regex pattern.
        """
        # Skip validation if field is empty (unless required by another rule)
        if not field_value or str(field_value).strip() == "":
            return None
        
        value_str = str(field_value).strip()
        
        if not pattern:
            logger.warning(f"PATTERN_MATCH rule for {field_name} has no pattern")
            return None
        
        try:
            if not re.match(pattern, value_str):
                return ValidationError(
                    row_number,
                    field_name,
                    field_value,
                    "pattern",
                    error_message or f"Field '{field_name}' does not match required pattern"
                )
        except re.error as e:
            logger.error(f"Invalid regex pattern '{pattern}': {e}")
            return None
        
        return None
    
    def _validate_enum_validation(
        self,
        field_name: str,
        field_value: any,
        enum_values: str,
        error_message: str,
        row_number: int
    ) -> Optional[ValidationError]:
        """
        Validate field value is in allowed enum values.
        FULLY IMPLEMENTED - validates against comma-separated enum values.
        """
        # Skip validation if field is empty (unless required by another rule)
        if not field_value or str(field_value).strip() == "":
            return None
        
        value_str = str(field_value).strip()
        
        if not enum_values:
            logger.warning(f"ENUM_VALIDATION rule for {field_name} has no enum values")
            return None
        
        # Parse enum values — stored as JSON array or comma-separated string
        import json
        try:
            allowed_values = [str(v).strip() for v in json.loads(enum_values)]
        except (json.JSONDecodeError, TypeError):
            allowed_values = [v.strip() for v in enum_values.split(',')]
        
        if value_str not in allowed_values:
            return ValidationError(
                row_number,
                field_name,
                field_value,
                "enum",
                error_message or f"Field '{field_name}' must be one of: {', '.join(allowed_values)}"
            )
        
        return None
    
    # ========================================================================
    # NEW RULE TYPES
    # ========================================================================

    def _validate_field_must_be_empty(
        self,
        rule: Dict,
        record: Dict,
        row_number: int
    ) -> Optional[ValidationError]:
        """
        FIELD_MUST_BE_EMPTY: Field must be null/blank.
        If the field is not present in the record at all, it is considered empty — skip.
        Use case: AutoReverse and AutoReverseDate must be blank for GL conversions.
        """
        field_name = rule["field_name"]
        # Field not in the file at all → considered empty, no violation
        if field_name not in record:
            return None
        field_value = record.get(field_name)
        if field_value and str(field_value).strip() != "":
            return ValidationError(
                row_number, field_name, field_value, "rule",
                rule["error_message"] or f"Field '{field_name}' must be empty"
            )
        return None

    async def _validate_date_range_from_reference(
        self,
        rule: Dict,
        record: Dict,
        row_number: int
    ) -> Optional[ValidationError]:
        """
        DATE_RANGE_FROM_REFERENCE: Check that a date field falls within a date range
        stored in a reference business class record.

        condition_expression JSON config:
        {
            "join_field": "Project",           # field on the record that identifies the reference record
            "begin_date_field": "BeginDate",   # field name in the reference record's raw_json
            "end_date_field": "EndDate"        # field name in the reference record's raw_json
        }

        Use case: PostingDate must fall within Project.BeginDate and Project.EndDate.
        """
        field_name = rule["field_name"]
        date_value = record.get(field_name)

        if not date_value or str(date_value).strip() == "":
            return None  # Let REQUIRED rules handle missing dates

        cond = rule.get("condition_expression")
        if not cond:
            logger.warning(f"DATE_RANGE_FROM_REFERENCE rule for {field_name} missing condition_expression config")
            return None

        try:
            cfg = json.loads(cond)
        except Exception:
            logger.error(f"DATE_RANGE_FROM_REFERENCE: invalid JSON in condition_expression: {cond}")
            return None

        join_field = cfg.get("join_field")
        begin_date_field = cfg.get("begin_date_field", "BeginDate")
        end_date_field = cfg.get("end_date_field", "EndDate")
        reference_class = rule.get("reference_business_class")

        if not join_field or not reference_class:
            logger.warning(f"DATE_RANGE_FROM_REFERENCE: missing join_field or reference_business_class")
            return None

        join_value = str(record.get(join_field, "")).strip()
        if not join_value:
            return None  # No reference to check against

        # Look up the reference record from snapshot
        ref_data = self._get_snapshot_record_data(reference_class, join_value)
        if not ref_data:
            return None  # Reference doesn't exist — let REFERENCE_EXISTS rule handle that

        begin_str = str(ref_data.get(begin_date_field, "")).strip()
        end_str = str(ref_data.get(end_date_field, "")).strip()

        if not begin_str and not end_str:
            return None  # No date range defined on the reference record

        try:
            check_date = self._parse_date(str(date_value).strip())
        except ValueError:
            return None  # Let PATTERN_MATCH handle bad date formats

        try:
            if begin_str:
                begin_date = self._parse_date(begin_str)
                if check_date < begin_date:
                    return ValidationError(
                        row_number, field_name, date_value, "rule",
                        rule["error_message"] or
                        f"'{field_name}' ({date_value}) is before {reference_class} '{join_value}' begin date ({begin_str})"
                    )
            if end_str:
                end_date = self._parse_date(end_str)
                if check_date > end_date:
                    return ValidationError(
                        row_number, field_name, date_value, "rule",
                        rule["error_message"] or
                        f"'{field_name}' ({date_value}) is after {reference_class} '{join_value}' end date ({end_str})"
                    )
        except ValueError as e:
            logger.warning(f"DATE_RANGE_FROM_REFERENCE date parse error: {e}")
            return None

        return None

    async def _validate_open_period_check(
        self,
        rule: Dict,
        record: Dict,
        row_number: int
    ) -> Optional[ValidationError]:
        """
        OPEN_PERIOD_CHECK: Check that a date field falls within the current open accounting period.

        Two-step lookup:
        1. Get AccountingEntity.CurrentPeriod from snapshot using the entity field on the record
        2. Look up GeneralLedgerClosePeriod using CurrentPeriod to get DerivedBeginDate / DerivedEndDate

        condition_expression JSON config:
        {
            "entity_field": "AccountingEntity",                    # field on the record
            "current_period_field": "CurrentPeriod",               # field in AccountingEntity snapshot record
            "period_class": "GeneralLedgerClosePeriod",            # snapshot class for period lookup
            "period_key_field": "GeneralLedgerCalendarPeriod",     # key field in period class
            "period_begin_field": "DerivedBeginDate",              # begin date field in period record
            "period_end_field": "DerivedEndDate"                   # end date field in period record
        }

        Use case: PostingDate must fall within the current open GL period.
        """
        field_name = rule["field_name"]
        date_value = record.get(field_name)

        if not date_value or str(date_value).strip() == "":
            return None

        cond = rule.get("condition_expression")
        if not cond:
            logger.warning(f"OPEN_PERIOD_CHECK rule for {field_name} missing condition_expression config")
            return None

        try:
            cfg = json.loads(cond)
        except Exception:
            logger.error(f"OPEN_PERIOD_CHECK: invalid JSON in condition_expression: {cond}")
            return None

        entity_field = cfg.get("entity_field", "AccountingEntity")
        current_period_field = cfg.get("current_period_field", "CurrentPeriod")
        period_class = cfg.get("period_class", "GeneralLedgerClosePeriod")
        period_key_field = cfg.get("period_key_field", "GeneralLedgerCalendarPeriod")
        period_begin_field = cfg.get("period_begin_field", "DerivedBeginDate")
        period_end_field = cfg.get("period_end_field", "DerivedEndDate")

        entity_value = str(record.get(entity_field, "")).strip()
        if not entity_value:
            return None

        # Step 1: Get CurrentPeriod from AccountingEntity snapshot
        cache_key = f"open_period:{entity_value}"
        if cache_key in self.reference_cache:
            period_range = self.reference_cache[cache_key]
        else:
            entity_data = self._get_snapshot_record_data("AccountingEntity", entity_value)
            if not entity_data:
                return None  # Entity doesn't exist — let REFERENCE_EXISTS handle it

            current_period = str(entity_data.get(current_period_field, "")).strip()
            if not current_period:
                logger.warning(f"OPEN_PERIOD_CHECK: AccountingEntity '{entity_value}' has no {current_period_field}")
                return None

            # Step 2: Look up period record to get begin/end dates
            period_data = self._get_snapshot_record_data(period_class, current_period)
            if not period_data:
                logger.warning(f"OPEN_PERIOD_CHECK: Period '{current_period}' not found in {period_class} snapshot")
                return None

            begin_str = str(period_data.get(period_begin_field, "")).strip()
            end_str = str(period_data.get(period_end_field, "")).strip()
            period_range = (begin_str, end_str, current_period)
            self.reference_cache[cache_key] = period_range

        begin_str, end_str, current_period = period_range

        try:
            check_date = self._parse_date(str(date_value).strip())
        except ValueError:
            return None  # Let PATTERN_MATCH handle bad date formats

        try:
            if begin_str:
                begin_date = self._parse_date(begin_str)
                if check_date < begin_date:
                    return ValidationError(
                        row_number, field_name, date_value, "rule",
                        rule["error_message"] or
                        f"'{field_name}' ({date_value}) is before the open period start ({begin_str}) for period {current_period}"
                    )
            if end_str:
                end_date = self._parse_date(end_str)
                if check_date > end_date:
                    return ValidationError(
                        row_number, field_name, date_value, "rule",
                        rule["error_message"] or
                        f"'{field_name}' ({date_value}) is after the open period end ({end_str}) for period {current_period}"
                    )
        except ValueError as e:
            logger.warning(f"OPEN_PERIOD_CHECK date parse error: {e}")
            return None

        return None

    def _get_snapshot_record_data(self, business_class: str, primary_key: str) -> Optional[Dict]:
        """Load a snapshot record's raw_json as a dict. Cached per executor instance."""
        cache_key = f"snap:{business_class}:{primary_key}"
        if cache_key in self.reference_cache:
            return self.reference_cache[cache_key]
        from app.models.snapshot import SnapshotRecord
        record = self.db.query(SnapshotRecord).filter(
            SnapshotRecord.account_id == self.account_id,
            SnapshotRecord.business_class == business_class,
            SnapshotRecord.primary_key == primary_key
        ).first()
        data = json.loads(record.raw_json) if record else None
        self.reference_cache[cache_key] = data
        return data

    @staticmethod
    def _parse_date(value: str) -> date:
        """
        Parse date strings in common FSM formats.
        Supports: YYYYMMDD, YYYY-MM-DD, MM/DD/YYYY, YYYY-MM (period format).
        """
        value = value.strip()
        for fmt in ("%Y%m%d", "%Y-%m-%d", "%m/%d/%Y", "%Y-%m"):
            try:
                return datetime.strptime(value, fmt).date()
            except ValueError:
                continue
        raise ValueError(f"Cannot parse date: '{value}'")

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
                    "pattern",
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
