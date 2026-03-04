"""
Test GeneralLedgerChartAccount sync to diagnose the issue
"""
import asyncio
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from app.core.database import SessionLocal
from app.modules.snapshot.service import SnapshotService

async def test_glchartaccount():
    db = SessionLocal()
    
    try:
        print("Testing GeneralLedgerChartAccount sync...")
        print("Endpoint: soap/classes/GeneralLedgerChartAccount/lists/DetailAccountList?_fields=_all&_limit=100000...\n")
        
        result = await SnapshotService.sync_single_setup_class_by_name(db, 1, "GeneralLedgerChartAccount")
        
        print(f"✅ SUCCESS!")
        print(f"   Business Class: {result['business_class']}")
        print(f"   Status: {result['status']}")
        print(f"   Records: {result['record_count']:,}")
        print(f"   Last Sync: {result['last_sync']}")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(test_glchartaccount())
