from typing import Dict, List, Optional
from app.core.logging import logger

class OpenAPIParser:
    """
    Parse FSM OpenAPI JSON to extract field definitions.
    Handles nested objects with dot notation flattening.
    """
    
    @staticmethod
    def parse_schema(openapi_json: Dict, business_class: str) -> Dict:
        """
        Parse OpenAPI JSON to extract structured schema.
        Returns: {
            "business_class": str,
            "fields": List[FieldInfo],
            "raw_schema": Dict
        }
        """
        try:
            # Navigate to createAllFields schema
            create_schema = openapi_json["components"]["schemas"]["createAllFields"]
            properties = create_schema.get("properties", {})
            required = create_schema.get("required", [])
            
            logger.info(f"Parsing schema for {business_class}: {len(properties)} properties found")
            
            fields = []
            for field_name, field_def in properties.items():
                # Handle nested objects - flatten with dot notation
                if field_def.get("type") == "object" and "properties" in field_def:
                    nested_fields = OpenAPIParser._flatten_nested(
                        field_name,
                        field_def["properties"],
                        field_def.get("required", [])
                    )
                    fields.extend(nested_fields)
                else:
                    field_info = OpenAPIParser._extract_field_info(
                        field_name,
                        field_def,
                        field_name in required
                    )
                    fields.append(field_info)
            
            logger.info(f"Parsed {len(fields)} fields (including nested)")
            
            return {
                "business_class": business_class,
                "fields": fields,
                "raw_schema": create_schema
            }
            
        except KeyError as e:
            logger.error(f"Invalid OpenAPI schema structure: missing key {e}")
            raise ValueError(f"Invalid OpenAPI schema structure: missing key {e}")
        except Exception as e:
            logger.error(f"Schema parsing error: {str(e)}")
            raise ValueError(f"Schema parsing error: {str(e)}")
    
    @staticmethod
    def _extract_field_info(field_name: str, field_def: Dict, is_required: bool) -> Dict:
        """Extract field information from OpenAPI field definition"""
        return {
            "name": field_name,
            "type": field_def.get("type", "string"),
            "required": is_required,
            "enum": field_def.get("enum"),
            "pattern": field_def.get("pattern"),
            "format": field_def.get("format"),
            "maxLength": field_def.get("maxLength"),
            "minLength": field_def.get("minLength"),
            "minimum": field_def.get("minimum"),
            "maximum": field_def.get("maximum"),
            "description": field_def.get("description")
        }
    
    @staticmethod
    def _flatten_nested(parent: str, properties: Dict, required: List) -> List[Dict]:
        """
        Flatten nested objects using dot notation.
        Example: Address.City, Address.State
        """
        fields = []
        for field_name, field_def in properties.items():
            full_name = f"{parent}.{field_name}"
            
            # Recursively flatten if nested object
            if field_def.get("type") == "object" and "properties" in field_def:
                nested_fields = OpenAPIParser._flatten_nested(
                    full_name,
                    field_def["properties"],
                    field_def.get("required", [])
                )
                fields.extend(nested_fields)
            else:
                field_info = OpenAPIParser._extract_field_info(
                    full_name,
                    field_def,
                    field_name in required
                )
                fields.append(field_info)
        
        return fields
    
    @staticmethod
    def get_required_fields(parsed_schema: Dict) -> List[str]:
        """Get list of required field names"""
        return [field["name"] for field in parsed_schema["fields"] if field["required"]]
    
    @staticmethod
    def get_field_by_name(parsed_schema: Dict, field_name: str) -> Optional[Dict]:
        """Get field definition by name"""
        for field in parsed_schema["fields"]:
            if field["name"] == field_name:
                return field
        return None
