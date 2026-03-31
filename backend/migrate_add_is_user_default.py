"""
Migration: Add is_user_default column to validation_rule_sets table

This allows users to set a custom rule set as the default for a business class.
Only one rule set per business class can have is_user_default=True.
"""

import sqlite3

def migrate():
    conn = sqlite3.connect('fsm_workbench.db')
    cursor = conn.cursor()
    
    try:
        # Add is_user_default column (defaults to False)
        cursor.execute("""
            ALTER TABLE validation_rule_sets 
            ADD COLUMN is_user_default BOOLEAN DEFAULT 0 NOT NULL
        """)
        
        conn.commit()
        print("✅ Successfully added is_user_default column to validation_rule_sets table")
        
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e).lower():
            print("⚠️  Column is_user_default already exists, skipping migration")
        else:
            raise
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
