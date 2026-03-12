"""
Fix Schema Data Issues

This script fixes two issues in the schemas table:
1. NULL created_at values (displays as 1/1/1970)
2. Missing operations_json and required_fields_json for old schemas

Run this script once to fix existing data.
"""

import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.schema import Schema
from datetime import datetime
import json

def fix_schema_data():
    """Fix schema data issues"""
    db: Session = SessionLocal()
    
    try:
        # Get all schemas
        schemas = db.query(Schema).all()
        
        print(f"Found {len(schemas)} schemas to check")
        
        fixed_count = 0
        for schema in schemas:
            needs_update = False
            
            # Fix 1: Set created_at to fetched_timestamp if NULL
            if schema.created_at is None:
                schema.created_at = schema.fetched_timestamp
                needs_update = True
                print(f"  Fixed created_at for {schema.business_class} v{schema.version_number}")
            
            # Fix 2: Extract operations and required fields from schema_json if missing
            if not schema.operations_json or not schema.required_fields_json:
                try:
                    schema_data = json.loads(schema.schema_json)
                    
                    # Extract operations (empty for old schemas)
                    if not schema.operations_json:
                        schema.operations_json = json.dumps([])
                        needs_update = True
                    
                    # Extract required fields
                    if not schema.required_fields_json:
                        required_fields = []
                        
                        # New format: {"properties": {...}, "required": [...]}
                        if 'required' in schema_data:
                            required_fields = schema_data['required']
                        # Old format: {"business_class": "...", "fields": [...]}
                        elif 'fields' in schema_data and isinstance(schema_data['fields'], list):
                            required_fields = [
                                field['name'] for field in schema_data['fields']
                                if field.get('required', False)
                            ]
                        
                        schema.required_fields_json = json.dumps(required_fields)
                        needs_update = True
                        print(f"  Fixed required_fields for {schema.business_class} v{schema.version_number} ({len(required_fields)} fields)")
                
                except Exception as e:
                    print(f"  Error processing {schema.business_class} v{schema.version_number}: {e}")
            
            if needs_update:
                fixed_count += 1
        
        # Commit all changes
        db.commit()
        print(f"\nFixed {fixed_count} schemas")
        print("Done!")
        
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    fix_schema_data()
