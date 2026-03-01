"""
Migration script to add username field to accounts table.
Run this after updating the Account model.
"""
import sqlite3
import os

def migrate():
    db_path = os.path.join(os.path.dirname(__file__), 'fsm_workbench.db')
    
    if not os.path.exists(db_path):
        print("Database not found. Run init_db.py first.")
        return
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Check if username column already exists
        cursor.execute("PRAGMA table_info(accounts)")
        columns = [col[1] for col in cursor.fetchall()]
        
        if 'username' in columns:
            print("✓ Username column already exists")
        else:
            # Add username column
            cursor.execute("ALTER TABLE accounts ADD COLUMN username VARCHAR(255)")
            print("✓ Added username column")
        
        # Make project_name nullable (SQLite doesn't support ALTER COLUMN, so we'll skip this)
        # Users can set it to empty string or NULL manually if needed
        
        conn.commit()
        print("\n✓ Migration completed successfully")
        print("\nNote: Existing accounts will need to have username set manually.")
        print("You may want to reinitialize the database with: python init_db.py")
        
    except Exception as e:
        conn.rollback()
        print(f"✗ Migration failed: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
