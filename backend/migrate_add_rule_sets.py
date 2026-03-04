"""
Migration: Add validation rule sets feature.

This migration:
1. Creates validation_rule_sets table
2. Adds rule_set_id column to validation_rule_templates
3. Creates "Common" rule set for each business class
4. Assigns existing rules to "Common" rule set
"""
import sqlite3
from pathlib import Path
from datetime import datetime

def migrate():
    db_path = Path(__file__).parent / "fsm_workbench.db"
    
    print("=" * 80)
    print("Migration: Add Validation Rule Sets")
    print("=" * 80)
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Step 1: Create validation_rule_sets table
        print("\n1. Creating validation_rule_sets table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS validation_rule_sets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name VARCHAR(255) NOT NULL,
                business_class VARCHAR(255) NOT NULL,
                description TEXT,
                is_common BOOLEAN DEFAULT 0 NOT NULL,
                is_active BOOLEAN DEFAULT 1 NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        print("   ✓ Table created")
        
        # Step 2: Add rule_set_id to validation_rule_templates
        print("\n2. Adding rule_set_id column to validation_rule_templates...")
        
        # Check if column already exists
        cursor.execute("PRAGMA table_info(validation_rule_templates)")
        columns = [row[1] for row in cursor.fetchall()]
        
        if "rule_set_id" in columns:
            print("   ✓ Column already exists")
        else:
            cursor.execute("""
                ALTER TABLE validation_rule_templates 
                ADD COLUMN rule_set_id INTEGER
            """)
            print("   ✓ Column added")
        
        # Step 3: Get distinct business classes from existing rules
        print("\n3. Finding existing business classes with rules...")
        cursor.execute("""
            SELECT DISTINCT business_class 
            FROM validation_rule_templates
        """)
        business_classes = [row[0] for row in cursor.fetchall()]
        
        if business_classes:
            print(f"   Found {len(business_classes)} business class(es): {', '.join(business_classes)}")
        else:
            print("   No existing rules found")
        
        # Step 4: Create "Common" rule set for each business class
        print("\n4. Creating 'Common' rule sets...")
        common_rule_sets = {}
        
        for business_class in business_classes:
            # Check if Common already exists
            cursor.execute("""
                SELECT id FROM validation_rule_sets 
                WHERE business_class = ? AND is_common = 1
            """, (business_class,))
            
            existing = cursor.fetchone()
            
            if existing:
                common_rule_sets[business_class] = existing[0]
                print(f"   ✓ Common rule set already exists for {business_class} (ID: {existing[0]})")
            else:
                cursor.execute("""
                    INSERT INTO validation_rule_sets 
                    (name, business_class, description, is_common, is_active)
                    VALUES (?, ?, ?, 1, 1)
                """, (
                    "Common",
                    business_class,
                    f"Common validation rules for {business_class}. These rules always apply to all conversions."
                ))
                
                rule_set_id = cursor.lastrowid
                common_rule_sets[business_class] = rule_set_id
                print(f"   ✓ Created Common rule set for {business_class} (ID: {rule_set_id})")
        
        # Step 5: Assign existing rules to Common rule sets
        print("\n5. Assigning existing rules to Common rule sets...")
        
        for business_class, rule_set_id in common_rule_sets.items():
            cursor.execute("""
                UPDATE validation_rule_templates 
                SET rule_set_id = ? 
                WHERE business_class = ? AND rule_set_id IS NULL
            """, (rule_set_id, business_class))
            
            updated_count = cursor.rowcount
            print(f"   ✓ Assigned {updated_count} rule(s) to Common set for {business_class}")
        
        conn.commit()
        
        # Step 6: Verify migration
        print("\n6. Verifying migration...")
        cursor.execute("""
            SELECT COUNT(*) FROM validation_rule_sets
        """)
        rule_set_count = cursor.fetchone()[0]
        
        cursor.execute("""
            SELECT COUNT(*) FROM validation_rule_templates WHERE rule_set_id IS NOT NULL
        """)
        assigned_rules = cursor.fetchone()[0]
        
        cursor.execute("""
            SELECT COUNT(*) FROM validation_rule_templates WHERE rule_set_id IS NULL
        """)
        unassigned_rules = cursor.fetchone()[0]
        
        print(f"   Rule Sets: {rule_set_count}")
        print(f"   Assigned Rules: {assigned_rules}")
        print(f"   Unassigned Rules: {unassigned_rules}")
        
        if unassigned_rules > 0:
            print(f"   ⚠ Warning: {unassigned_rules} rules not assigned to any rule set")
        
        print("\n" + "=" * 80)
        print("Migration completed successfully!")
        print("=" * 80)
        
    except Exception as e:
        conn.rollback()
        print(f"\n✗ Migration failed: {e}")
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
