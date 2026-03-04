"""
Migration: Add category and original values tracking to setup_business_classes table

This migration adds:
1. category field: 'standard' or 'custom'
2. original_endpoint_url: For reset functionality
3. original_key_field: For reset functionality

Run: python migrate_add_setup_class_category.py
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
        # Check if columns already exist
        cursor.execute("PRAGMA table_info(setup_business_classes)")
        columns = [col[1] for col in cursor.fetchall()]
        
        if 'category' in columns:
            print("✅ Migration already applied")
            return
        
        print("🔄 Adding new columns to setup_business_classes table...")
        
        # Add category column (default to 'standard' for existing records)
        cursor.execute("""
            ALTER TABLE setup_business_classes 
            ADD COLUMN category VARCHAR(50) DEFAULT 'standard' NOT NULL
        """)
        
        # Add original_endpoint_url column (copy current values)
        cursor.execute("""
            ALTER TABLE setup_business_classes 
            ADD COLUMN original_endpoint_url VARCHAR(1000)
        """)
        
        # Add original_key_field column (copy current values)
        cursor.execute("""
            ALTER TABLE setup_business_classes 
            ADD COLUMN original_key_field VARCHAR(255)
        """)
        
        # Populate original values from current values
        cursor.execute("""
            UPDATE setup_business_classes 
            SET original_endpoint_url = endpoint_url,
                original_key_field = key_field
        """)
        
        conn.commit()
        
        # Verify changes
        cursor.execute("SELECT COUNT(*) FROM setup_business_classes WHERE category = 'standard'")
        count = cursor.fetchone()[0]
        
        print(f"✅ Migration successful!")
        print(f"   - Added 'category' column (default: 'standard')")
        print(f"   - Added 'original_endpoint_url' column")
        print(f"   - Added 'original_key_field' column")
        print(f"   - Marked {count} existing classes as 'standard'")
        print(f"   - Stored original values for reset functionality")
        
    except sqlite3.Error as e:
        print(f"❌ Migration failed: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
