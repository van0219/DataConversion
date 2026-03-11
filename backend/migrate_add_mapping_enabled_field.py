"""
Migration: Add enabled field to mapping_templates table

This allows users to disable specific field mappings without deleting them.

Run: python migrate_add_mapping_enabled_field.py
"""

import sqlite3
from pathlib import Path

def migrate():
    db_path = Path(__file__).parent / "fsm_workbench.db"
    
    if not db_path.exists():
        print(f"❌ Database not found: {db_path}")
        return
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Check if column already exists
        cursor.execute("PRAGMA table_info(mapping_templates)")
        columns = [col[1] for col in cursor.fetchall()]
        
        if 'enabled_fields_json' in columns:
            print("✅ Column 'enabled_fields_json' already exists")
            return
        
        # Add enabled_fields_json column (stores which fields are enabled)
        print("Adding 'enabled_fields_json' column to mapping_templates...")
        cursor.execute("""
            ALTER TABLE mapping_templates
            ADD COLUMN enabled_fields_json TEXT
        """)
        
        conn.commit()
        print("✅ Migration complete: Added enabled_fields_json column")
        
    except Exception as e:
        conn.rollback()
        print(f"❌ Migration failed: {e}")
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
