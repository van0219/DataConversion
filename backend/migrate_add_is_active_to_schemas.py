"""
Add is_active column to schemas table and set only latest versions as active
"""
from sqlalchemy import text
from app.core.database import engine, SessionLocal
from app.models.schema import Schema

def migrate():
    db = SessionLocal()
    try:
        # Add is_active column
        with engine.connect() as conn:
            try:
                conn.execute(text("ALTER TABLE schemas ADD COLUMN is_active BOOLEAN DEFAULT 1 NOT NULL"))
                conn.commit()
                print("✓ Added is_active column to schemas table")
            except Exception as e:
                if "duplicate column name" in str(e).lower() or "already exists" in str(e).lower():
                    print("✓ is_active column already exists")
                else:
                    raise
        
        # Set all schemas to inactive first
        db.execute(text("UPDATE schemas SET is_active = 0"))
        db.commit()
        print("✓ Set all schemas to inactive")
        
        # Get all unique (account_id, business_class) combinations
        result = db.execute(text("""
            SELECT DISTINCT account_id, business_class 
            FROM schemas
        """))
        
        combinations = result.fetchall()
        print(f"Found {len(combinations)} unique account/business_class combinations")
        
        # For each combination, activate only the latest version
        for account_id, business_class in combinations:
            latest = db.query(Schema).filter(
                Schema.account_id == account_id,
                Schema.business_class == business_class
            ).order_by(Schema.version_number.desc()).first()
            
            if latest:
                latest.is_active = True
                print(f"  ✓ Activated {business_class} v{latest.version_number} for account {account_id}")
        
        db.commit()
        print("✓ Migration complete - only latest versions are active")
        
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    migrate()
