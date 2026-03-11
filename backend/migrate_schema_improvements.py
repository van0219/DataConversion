"""
Database Migration: Schema Improvements

Adds schema versioning, field metadata, and operation tracking.

Changes:
1. Extend schemas table with new columns
2. Create schema_fields table
3. Create schema_operations table
4. Add schema_version to conversion_jobs table
"""

import sqlite3
from pathlib import Path

# Database path
DB_PATH = Path(__file__).parent / "fsm_workbench.db"


def migrate():
    """Run migration"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    print("Starting schema improvements migration...")
    
    try:
        # 1. Extend schemas table
        print("1. Extending schemas table...")
        
        # Check if columns already exist
        cursor.execute("PRAGMA table_info(schemas)")
        existing_columns = [row[1] for row in cursor.fetchall()]
        
        if "source" not in existing_columns:
            cursor.execute("ALTER TABLE schemas ADD COLUMN source VARCHAR(50) DEFAULT 'local_swagger'")
            print("   - Added source column")
        
        if "created_at" not in existing_columns:
            cursor.execute("ALTER TABLE schemas ADD COLUMN created_at TIMESTAMP")
            print("   - Added created_at column")
        
        if "operations_json" not in existing_columns:
            cursor.execute("ALTER TABLE schemas ADD COLUMN operations_json TEXT")
            print("   - Added operations_json column")
        
        if "required_fields_json" not in existing_columns:
            cursor.execute("ALTER TABLE schemas ADD COLUMN required_fields_json TEXT")
            print("   - Added required_fields_json column")
        
        if "enum_fields_json" not in existing_columns:
            cursor.execute("ALTER TABLE schemas ADD COLUMN enum_fields_json TEXT")
            print("   - Added enum_fields_json column")
        
        if "date_fields_json" not in existing_columns:
            cursor.execute("ALTER TABLE schemas ADD COLUMN date_fields_json TEXT")
            print("   - Added date_fields_json column")
        
        # 2. Create schema_fields table
        print("2. Creating schema_fields table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS schema_fields (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                schema_id INTEGER NOT NULL,
                business_class VARCHAR(255) NOT NULL,
                field_name VARCHAR(255) NOT NULL,
                field_type VARCHAR(100) NOT NULL,
                required BOOLEAN DEFAULT 0,
                enum_values_json TEXT,
                pattern VARCHAR(500),
                description TEXT,
                example TEXT,
                FOREIGN KEY (schema_id) REFERENCES schemas(id) ON DELETE CASCADE
            )
        """)
        print("   - Created schema_fields table")
        
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_schema_fields_lookup 
            ON schema_fields(schema_id, field_name)
        """)
        print("   - Created index on schema_fields")
        
        # 3. Create schema_operations table
        print("3. Creating schema_operations table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS schema_operations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                schema_id INTEGER NOT NULL,
                business_class VARCHAR(255) NOT NULL,
                operation_name VARCHAR(100) NOT NULL,
                FOREIGN KEY (schema_id) REFERENCES schemas(id) ON DELETE CASCADE
            )
        """)
        print("   - Created schema_operations table")
        
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_schema_operations_lookup 
            ON schema_operations(schema_id, business_class)
        """)
        print("   - Created index on schema_operations")
        
        # 4. Add schema_version to conversion_jobs
        print("4. Extending conversion_jobs table...")
        cursor.execute("PRAGMA table_info(conversion_jobs)")
        job_columns = [row[1] for row in cursor.fetchall()]
        
        if "schema_version" not in job_columns:
            cursor.execute("ALTER TABLE conversion_jobs ADD COLUMN schema_version INTEGER")
            print("   - Added schema_version column to conversion_jobs")
        
        # Commit changes
        conn.commit()
        print("\n✅ Migration completed successfully!")
        
    except Exception as e:
        conn.rollback()
        print(f"\n❌ Migration failed: {e}")
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    migrate()
