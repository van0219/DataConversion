"""
Migration script to make project_name required (NOT NULL) in accounts table.
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
        # Create new table with project_name NOT NULL
        cursor.execute("""
            CREATE TABLE accounts_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                account_name VARCHAR(255) UNIQUE NOT NULL,
                project_name VARCHAR(255) NOT NULL,
                tenant_id VARCHAR(255) NOT NULL,
                base_url VARCHAR(500) NOT NULL,
                client_id_encrypted BLOB NOT NULL,
                client_secret_encrypted BLOB NOT NULL,
                username VARCHAR(255) NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Copy data from old table (only rows with non-null project_name)
        cursor.execute("""
            INSERT INTO accounts_new 
            SELECT * FROM accounts WHERE project_name IS NOT NULL
        """)
        
        # Drop old table
        cursor.execute("DROP TABLE accounts")
        
        # Rename new table
        cursor.execute("ALTER TABLE accounts_new RENAME TO accounts")
        
        # Recreate indexes
        cursor.execute("CREATE INDEX idx_accounts_account_name ON accounts(account_name)")
        
        conn.commit()
        print("\n✓ Migration completed successfully")
        print("✓ project_name is now required (NOT NULL)")
        
    except Exception as e:
        conn.rollback()
        print(f"\n✗ Migration failed: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
