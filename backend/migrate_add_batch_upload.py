"""
Migration: Add batch_upload_jobs table for multiple file upload support

Run: python migrate_add_batch_upload.py
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
        # Check if table already exists
        cursor.execute("""
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='batch_upload_jobs'
        """)
        
        if cursor.fetchone():
            print("✅ Table 'batch_upload_jobs' already exists")
            return
        
        # Create batch_upload_jobs table
        print("Creating 'batch_upload_jobs' table...")
        cursor.execute("""
            CREATE TABLE batch_upload_jobs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                account_id INTEGER NOT NULL,
                batch_name TEXT NOT NULL,
                business_class TEXT NOT NULL,
                total_files INTEGER NOT NULL DEFAULT 0,
                completed_files INTEGER NOT NULL DEFAULT 0,
                failed_files INTEGER NOT NULL DEFAULT 0,
                status TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                completed_at TIMESTAMP,
                FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
            )
        """)
        
        # Create indexes
        cursor.execute("CREATE INDEX idx_batch_upload_account ON batch_upload_jobs(account_id)")
        cursor.execute("CREATE INDEX idx_batch_upload_status ON batch_upload_jobs(status)")
        
        # Add batch_upload_id to conversion_jobs
        cursor.execute("""
            ALTER TABLE conversion_jobs
            ADD COLUMN batch_upload_id INTEGER
        """)
        
        cursor.execute("""
            CREATE INDEX idx_conversion_job_batch ON conversion_jobs(batch_upload_id)
        """)
        
        conn.commit()
        print("✅ Migration complete: Added batch_upload_jobs table")
        
    except Exception as e:
        conn.rollback()
        print(f"❌ Migration failed: {e}")
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
