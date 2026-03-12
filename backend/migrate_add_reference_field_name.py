#!/usr/bin/env python3
"""
Migration: Add reference_field_name to validation_rule_templates table

This field stores the field name in the reference business class to check against.
Example: For AccountCode field checking against Account class, 
         reference_field_name would be "Account" (the key field in Account class)
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import engine
import sqlite3

def migrate():
    """Add reference_field_name column to validation_rule_templates"""
    
    print("=" * 80)
    print("Migration: Add reference_field_name to validation_rule_templates")
    print("=" * 80)
    
    conn = sqlite3.connect('fsm_workbench.db')
    cursor = conn.cursor()
    
    try:
        # Check if column already exists
        cursor.execute("PRAGMA table_info(validation_rule_templates)")
        columns = [row[1] for row in cursor.fetchall()]
        
        if 'reference_field_name' in columns:
            print("\n✓ Column 'reference_field_name' already exists")
            return
        
        # Add reference_field_name column
        print("\n🔄 Adding 'reference_field_name' column...")
        cursor.execute("""
            ALTER TABLE validation_rule_templates 
            ADD COLUMN reference_field_name VARCHAR(255)
        """)
        
        conn.commit()
        print("✅ Column added successfully")
        
        # Show current schema
        print("\n📋 Updated table schema:")
        cursor.execute("PRAGMA table_info(validation_rule_templates)")
        for row in cursor.fetchall():
            print(f"   {row[1]} ({row[2]})")
        
    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()
    
    print("\n" + "=" * 80)
    print("Migration completed successfully!")
    print("=" * 80)

if __name__ == "__main__":
    migrate()
