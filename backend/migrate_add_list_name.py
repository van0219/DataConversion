"""
Migration: Add list_name field to setup_business_classes table.

This field stores the selected list name (e.g., "FinanceDimension1FlatList")
which is used to construct the endpoint_url dynamically.
"""
import sqlite3
from pathlib import Path

def migrate():
    db_path = Path(__file__).parent / "fsm_workbench.db"
    
    print("=" * 80)
    print("Migration: Add list_name to setup_business_classes")
    print("=" * 80)
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Check if column already exists
        cursor.execute("PRAGMA table_info(setup_business_classes)")
        columns = [row[1] for row in cursor.fetchall()]
        
        if "list_name" in columns:
            print("✓ Column 'list_name' already exists")
        else:
            print("Adding 'list_name' column...")
            cursor.execute("""
                ALTER TABLE setup_business_classes 
                ADD COLUMN list_name VARCHAR(255)
            """)
            print("✓ Column 'list_name' added")
        
        # Extract list names from existing endpoint_urls and populate list_name
        print("\nExtracting list names from existing endpoint URLs...")
        cursor.execute("SELECT id, name, endpoint_url FROM setup_business_classes")
        rows = cursor.fetchall()
        
        updated_count = 0
        for row_id, name, endpoint_url in rows:
            # Extract list name from endpoint_url
            # Format: soap/classes/{Class}/lists/{ListName}?...
            if "/lists/" in endpoint_url:
                parts = endpoint_url.split("/lists/")
                if len(parts) > 1:
                    list_name = parts[1].split("?")[0]  # Get list name before query params
                    
                    cursor.execute("""
                        UPDATE setup_business_classes 
                        SET list_name = ? 
                        WHERE id = ?
                    """, (list_name, row_id))
                    
                    print(f"  {name}: {list_name}")
                    updated_count += 1
        
        conn.commit()
        print(f"\n✓ Updated {updated_count} records with list names")
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
