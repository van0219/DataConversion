"""
Test Currency sync with new endpoint (Currencies list with _fields=_all)
"""
import asyncio
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from app.core.database import SessionLocal
from app.modules.snapshot.service import SnapshotService

async def test_currency():
    db = SessionLocal()
    
    try:
        print("Testing Currency sync with new endpoint...")
        print("Endpoint: soap/classes/Currency/lists/Currencies?_fields=_all&_limit=100000...\n")
        
        result = await SnapshotService.sync_single_setup_class_by_name(db, 1, "Currency")
        
        print(f"✅ SUCCESS!")
        print(f"   Business Class: {result['business_class']}")
        print(f"   Status: {result['status']}")
        print(f"   Records: {result['record_count']:,}")
        print(f"   Last Sync: {result['last_sync']}")
        
        # Check a sample record to see how many fields we got
        from app.models.snapshot import SnapshotRecord
        import json
        
        sample = db.query(SnapshotRecord).filter(
            SnapshotRecord.account_id == 1,
            SnapshotRecord.business_class == "Currency"
        ).first()
        
        if sample:
            record_data = json.loads(sample.raw_json)
            print(f"\n📊 Sample record has {len(record_data)} fields:")
            print(f"   Fields: {list(record_data.keys())[:10]}...")
            
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(test_currency())
