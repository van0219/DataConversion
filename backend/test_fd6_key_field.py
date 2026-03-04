"""
Test script to verify key field extraction for FinanceDimension6
"""
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from app.core.database import SessionLocal
from app.modules.snapshot.service import SnapshotService

def test_key_field():
    db = SessionLocal()
    
    try:
        # Get available swagger files
        print("📁 Scanning FSM_Swagger/Setup/ folder...\n")
        
        available_files = SnapshotService.get_available_swagger_files(db)
        
        # Find FinanceDimension6
        fd6 = next((f for f in available_files if f["name"] == "FinanceDimension6"), None)
        
        if fd6:
            print("✅ Found FinanceDimension6:")
            print(f"   Name: {fd6['name']}")
            print(f"   Endpoint URL: {fd6['endpoint_url']}")
            print(f"   Key Field: {fd6['key_field']}")
            print(f"   Folder: {fd6['folder']}")
            
            # Verify key field is correct
            expected_key = "FinanceDimension6"
            if fd6['key_field'] == expected_key:
                print(f"\n✅ Key field is correct: {expected_key}")
            else:
                print(f"\n❌ Key field mismatch!")
                print(f"   Expected: {expected_key}")
                print(f"   Got: {fd6['key_field']}")
        else:
            print("❌ FinanceDimension6 not found in available files")
        
        # Show all available files
        print(f"\n📋 All available swagger files ({len(available_files)}):")
        print(f"{'='*80}")
        for f in available_files:
            print(f"\n{f['name']}:")
            print(f"   Endpoint: {f['endpoint_url'][:70]}...")
            print(f"   Key Field: {f['key_field']}")
            print(f"   Folder: {f['folder']}")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    test_key_field()
