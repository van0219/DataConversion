"""
Migration: Add from_field column to validation_rule_templates table

This allows validation rules to specify which source field triggered the rule,
making error messages more informative.

Run: python migrate_add_from_field_to_rules.py
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
        cursor.execute("PRAGMA table_info(validation_rule_templates)")
        columns = [col[1] for col in cursor.fetchall()]
        
        if 'from_field' in columns:
            print("✅ Column 'from_field' already exists")
            return
        
        # Add from_field column
        print("Adding 'from_field' column to validation_rule_templates...")
        cursor.execute("""
            ALTER TABLE validation_rule_templates
            ADD COLUMN from_field TEXT
        """)
        
        conn.commit()
        print("✅ Migration complete: Added from_field column")
        
    except Exception as e:
        conn.rollback()
        print(f"❌ Migration failed: {e}")
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
