"""
Delete broken GLTransactionInterface v2 schema
"""
from sqlalchemy import text
from app.core.database import SessionLocal

def delete_broken_schema():
    db = SessionLocal()
    try:
        # Find the broken v2 schema using raw SQL
        result = db.execute(text("""
            SELECT id, business_class, version_number, fetched_timestamp
            FROM schemas
            WHERE business_class = 'GLTransactionInterface'
            AND version_number = 2
        """))
        
        broken_schema = result.fetchone()
        
        if broken_schema:
            print(f"Found broken schema: v{broken_schema.version_number}")
            print(f"  ID: {broken_schema.id}")
            print(f"  Created: {broken_schema.fetched_timestamp}")
            
            # Delete using raw SQL
            db.execute(text("""
                DELETE FROM schemas
                WHERE business_class = 'GLTransactionInterface'
                AND version_number = 2
            """))
            db.commit()
            print("✓ Deleted broken schema v2")
        else:
            print("No broken schema found")
            
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    delete_broken_schema()
