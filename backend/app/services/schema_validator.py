from typing import Dict, List, Optional
import re
from datetime import datetime
from app.utils.normalization import normalize_date
from app.core.logging import logger

class ValidationError:
    """Structured validation error"""
    def __init__(
        self,
        row_number: int,
        field_name: str,
        invalid_value: any,
        error_type: str,
        error_message: str
    ):
        self.row_number = row_number
        self.field_name = field_name
        self.invalid_value = str(invalid_value) if invalid_value is not None else None
        self.error_type = error_type
        self.error_message = error_message

class SchemaValidator:
    """
    Schema structural validation layer.
    Validates records against FSM schema definitions.
    """
    
    @staticmethod
    def validate_record(
        record: Dict,
        schema: Dict,
        row_number: int
    ) -> tuple[Dict, List[ValidationError]]:
        """
        Validate a single record against schema.
        Returns: (normalized_record, errors)
        """
        errors = []
        normalized_record = record.copy()
        
        # Get schema fields
        fields = {field["name"]: field for field in schema["fields"]}
        
        # Validate each field in schema
        for field_name, field_def in fields.items():
            value = record.get(field_name)
            
            # 1. Required field validation
            if field_def["required"]:
                error = SchemaValidator._validate_required(
                    field_name,
                    value,
                    row_number
                )
                if error:
                    errors.append(error)
                    continue
            
            # Skip further validation if field is empty and not required
            if value is None or str(value).strip() == "":
                continue
            
            # 2. Type validation
            error = SchemaValidator._validate_type(
                field_name,
                value,
                field_def["type"],
                row_number
            )
            if error:
                errors.append(error)
                continue
            
            # 3. Enum validation
            if field_def.get("enum"):
                error = SchemaValidator._validate_enum(
                    field_name,
                    value,
                    field_def["enum"],
                    row_number
                )
                if error:
                    errors.append(error)
                    continue
            
            # 4. Pattern validation
            if field_def.get("pattern"):
                error = SchemaValidator._validate_pattern(
                    field_name,
                    value,
                    field_def["pattern"],
                    row_number,
                    field_def  # Pass field definition for description/example
                )
                if error:
                    errors.append(error)
                    continue
            
            # 5. Length validation
            if field_def.get("maxLength"):
                error = SchemaValidator._validate_length(
                    field_name,
                    value,
                    field_def["maxLength"],
                    row_number
                )
                if error:
                    errors.append(error)
                    continue
            
            # 6. Date normalization
            if field_def["type"] == "string" and field_def.get("format") == "date":
                normalized_value = normalize_date(str(value))
                if normalized_value:
                    normalized_record[field_name] = normalized_value
                else:
                    errors.append(ValidationError(
                        row_number,
                        field_name,
                        value,
                        "format",
                        f"Invalid date format: {value}"
                    ))
        
        return normalized_record, errors
    
    @staticmethod
    def _validate_required(
        field_name: str,
        value: any,
        row_number: int
    ) -> Optional[ValidationError]:
        """Validate required field is present and non-empty"""
        if value is None or str(value).strip() == "":
            return ValidationError(
                row_number,
                field_name,
                value,
                "required",
                f"Required field '{field_name}' is missing or empty"
            )
        return None
    
    @staticmethod
    def _validate_type(
        field_name: str,
        value: any,
        expected_type: str,
        row_number: int
    ) -> Optional[ValidationError]:
        """Validate field type matches schema"""
        value_str = str(value).strip()
        
        if expected_type == "integer":
            try:
                int(value_str)
            except ValueError:
                return ValidationError(
                    row_number,
                    field_name,
                    value,
                    "type",
                    f"Field '{field_name}' must be an integer, got: {value}"
                )
        
        elif expected_type == "number":
            try:
                float(value_str)
            except ValueError:
                return ValidationError(
                    row_number,
                    field_name,
                    value,
                    "type",
                    f"Field '{field_name}' must be a number, got: {value}"
                )
        
        elif expected_type == "boolean":
            if value_str.lower() not in ["true", "false", "1", "0", "yes", "no"]:
                return ValidationError(
                    row_number,
                    field_name,
                    value,
                    "type",
                    f"Field '{field_name}' must be a boolean, got: {value}"
                )
        
        return None
    
    @staticmethod
    def _validate_enum(
        field_name: str,
        value: any,
        allowed_values: List,
        row_number: int
    ) -> Optional[ValidationError]:
        """Validate field value is in allowed enum list"""
        value_str = str(value).strip()
        
        if value_str not in allowed_values:
            return ValidationError(
                row_number,
                field_name,
                value,
                "enum",
                f"Field '{field_name}' must be one of {allowed_values}, got: {value}"
            )
        
        return None
    
    @staticmethod
    def _validate_pattern(
        field_name: str,
        value: any,
        pattern: str,
        row_number: int,
        field_def: Dict = None
    ) -> Optional[ValidationError]:
        """Validate field value matches regex pattern"""
        value_str = str(value).strip()
        
        try:
            if not re.match(pattern, value_str):
                # Use user-friendly description if available, otherwise show pattern
                if field_def:
                    description = field_def.get("description", "")
                    example = field_def.get("example", "")
                    
                    logger.info(f"Pattern validation - field_def provided: description='{description}', example='{example}'")
                    
                    if description and example:
                        message = f"Field '{field_name}' has invalid format. Expected: {description} (e.g., {example})"
                    elif description:
                        message = f"Field '{field_name}' has invalid format. Expected: {description}"
                    elif example:
                        message = f"Field '{field_name}' has invalid format. Example: {example}"
                    else:
                        message = f"Field '{field_name}' does not match required pattern: {pattern}"
                else:
                    logger.warning(f"Pattern validation - NO field_def provided for {field_name}")
                    message = f"Field '{field_name}' does not match required pattern: {pattern}"
                
                logger.info(f"Pattern error message: {message}")
                
                return ValidationError(
                    row_number,
                    field_name,
                    value,
                    "pattern",
                    message
                )
        except re.error as e:
            logger.error(f"Invalid regex pattern '{pattern}': {e}")
            return None
        
        return None
    
    @staticmethod
    def _validate_length(
        field_name: str,
        value: any,
        max_length: int,
        row_number: int
    ) -> Optional[ValidationError]:
        """Validate field length does not exceed maximum"""
        value_str = str(value).strip()
        
        if len(value_str) > max_length:
            return ValidationError(
                row_number,
                field_name,
                value,
                "length",
                f"Field '{field_name}' exceeds maximum length of {max_length} (got {len(value_str)})"
            )
        
        return None
