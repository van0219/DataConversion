"""
Fix GLTransactionInterface schema versions.
Delete v1 and v2, renumber v3 to v1.
"""

from app.core.database import SessionLocal
from app.models.schema import Schema
from app.models.rule import ValidationRuleTemplate
from sqlalchemy import desc

def fix_gltransaction_versions():
    db = SessionLocal()
    
    try:
        # Get all GLTransactionInterface schemas
        schemas = db.query(Schema).filter(
            Schema.business_class == 'GLTransactionInterface'
        ).order_by(Schema.version_number).all()
        
        print("Current GLTransactionInterface schemas:")
        print("=" * 80)
        for s in schemas:
            print(f"Version: v{s.version_number}, ID: {s.id}, Active: {s.is_active}, Hash: {s.schema_hash[:16]}...")
        print()
        
        # Find v3 (the one we want to keep)
        v3_schema = db.query(Schema).filter(
            Schema.business_class == 'GLTransactionInterface',
            Schema.version_number == 3
        ).first()
        
        if not v3_schema:
            print("❌ Error: v3 not found!")
            return
        
        print(f"✓ Found v3 (ID: {v3_schema.id})")
        
        # Delete v1 if exists (physically delete since it's old/error)
        v1_schema = db.query(Schema).filter(
            Schema.business_class == 'GLTransactionInterface',
            Schema.version_number == 1
        ).first()
        
        if v1_schema:
            # Delete associated rules first
            rules_deleted = db.query(ValidationRuleTemplate).filter(
                ValidationRuleTemplate.schema_id == v1_schema.id
            ).delete()
            print(f"✓ Deleted {rules_deleted} rules from v1")
            
            # Delete schema
            db.delete(v1_schema)
            print(f"✓ Deleted v1 (ID: {v1_schema.id})")
        else:
            print("ℹ️  v1 not found (already deleted or never existed)")
        
        # Delete v2 (physically delete since it's inactive)
        v2_schema = db.query(Schema).filter(
            Schema.business_class == 'GLTransactionInterface',
            Schema.version_number == 2
        ).first()
        
        if v2_schema:
            # Delete associated rules first
            rules_deleted = db.query(ValidationRuleTemplate).filter(
                ValidationRuleTemplate.schema_id == v2_schema.id
            ).delete()
            print(f"✓ Deleted {rules_deleted} rules from v2")
            
            # Delete schema
            db.delete(v2_schema)
            print(f"✓ Deleted v2 (ID: {v2_schema.id})")
        else:
            print("ℹ️  v2 not found")
        
        # Renumber v3 to v1
        v3_schema.version_number = 1
        print(f"✓ Renumbered v3 to v1 (ID: {v3_schema.id})")
        
        db.commit()
        print()
        print("=" * 80)
        print("✅ SUCCESS: GLTransactionInterface is now v1")
        print()
        
        # Verify
        final_schemas = db.query(Schema).filter(
            Schema.business_class == 'GLTransactionInterface'
        ).order_by(Schema.version_number).all()
        
        print("Final GLTransactionInterface schemas:")
        print("=" * 80)
        for s in final_schemas:
            print(f"Version: v{s.version_number}, ID: {s.id}, Active: {s.is_active}, Hash: {s.schema_hash[:16]}...")
        
    except Exception as e:
        db.rollback()
        print(f"❌ Error: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    fix_gltransaction_versions()
