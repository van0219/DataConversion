"""
Migration script to add oauth_url, saak_encrypted, and sask_encrypted fields to accounts table.
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
        # Check current schema
        cursor.execute("PRAGMA table_info(accounts)")
        columns = [col[1] for col in cursor.fetchall()]
        print("Current columns:", columns)
        
        # Create new table with additional fields
        cursor.execute("""
            CREATE TABLE accounts_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                account_name VARCHAR(255) UNIQUE NOT NULL,
                project_name VARCHAR(255) NOT NULL,
                tenant_id VARCHAR(255) NOT NULL,
                base_url VARCHAR(500) NOT NULL,
                oauth_url VARCHAR(500) NOT NULL,
                client_id_encrypted BLOB NOT NULL,
                client_secret_encrypted BLOB NOT NULL,
                saak_encrypted BLOB NOT NULL,
                sask_encrypted BLOB NOT NULL,
                username VARCHAR(255) NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        print("\n✓ Created new table structure")
        print("✗ Cannot migrate existing data - new fields (oauth_url, saak, sask) are required")
        print("\nPlease:")
        print("1. Drop old table: DROP TABLE accounts;")
        print("2. Rename new table: ALTER TABLE accounts_new RENAME TO accounts;")
        print("3. Recreate index: CREATE INDEX idx_accounts_account_name ON accounts(account_name);")
        print("4. Create new accounts with .ionapi file upload")
        
        # Don't commit - let user decide
        conn.rollback()
        
    except Exception as e:
        conn.rollback()
        print(f"\n✗ Migration failed: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
