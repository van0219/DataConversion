"""
Check all setup business classes in database
"""
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from app.core.database import SessionLocal
from app.models.setup_business_class import SetupBusinessClass

def check_classes():
    db = SessionLocal()
    
    try:
        # Get all setup classes
        classes = db.query(SetupBusinessClass).order_by(SetupBusinessClass.name).all()
        
        print(f"📋 Setup Business Classes in Database ({len(classes)}):")
        print(f"{'='*100}\n")
        
        for cls in classes:
            print(f"{cls.name}:")
            print(f"   ID: {cls.id}")
            print(f"   Category: {cls.category}")
            print(f"   Active: {cls.is_active}")
            print(f"   Endpoint: {cls.endpoint_url[:80]}...")
            print(f"   Key Field: {cls.key_field}")
            
            # Check if it's a FinanceDimension class
            if cls.name.startswith("FinanceDimension"):
                # Verify it uses FlatList format
                if "FlatList" in cls.endpoint_url:
                    print(f"   ✅ Uses FlatList format")
                else:
                    print(f"   ⚠️  Does NOT use FlatList format")
            
            print()
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    check_classes()
