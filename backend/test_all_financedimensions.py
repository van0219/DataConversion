"""
Test script to sync all FinanceDimension classes (1-6) from FSM
"""
import asyncio
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from app.core.database import SessionLocal
from app.services.fsm_client import FSMClient
from app.modules.accounts.service import AccountService
from app.utils.encryption import encryption

async def test_all_dimensions():
    db = SessionLocal()
    
    try:
        # Get account
        account = AccountService.get_account_by_id(db, 1)
        if not account:
            print("❌ No account found with ID 1")
            return
        
        # Get decrypted credentials
        client_id = encryption.decrypt(account.client_id_encrypted)
        client_secret = encryption.decrypt(account.client_secret_encrypted)
        saak = encryption.decrypt(account.saak_encrypted)
        sask = encryption.decrypt(account.sask_encrypted)
        
        print(f"✅ Using account: {account.account_name}")
        print(f"   Tenant: {account.tenant_id}\n")
        
        # Create FSM client
        fsm_client = FSMClient(
            base_url=account.base_url,
            oauth_url=account.oauth_url,
            tenant_id=account.tenant_id,
            client_id=client_id,
            client_secret=client_secret,
            saak=saak,
            sask=sask
        )
        
        # Authenticate
        print("🔐 Authenticating...")
        await fsm_client.authenticate()
        print("✅ Authentication successful\n")
        
        # Test all FinanceDimension classes (1-6)
        results = []
        
        for i in range(1, 7):
            dimension_name = f"FinanceDimension{i}"
            endpoint_url = f"soap/classes/{dimension_name}/lists/{dimension_name}FlatList?_fields=_all&_limit=100000&_links=false&_pageNav=true&_out=JSON&_flatten=false"
            
            print(f"{'='*60}")
            print(f"Testing: {dimension_name}")
            print(f"{'='*60}")
            print(f"Endpoint: {endpoint_url[:80]}...")
            
            try:
                response = await fsm_client.fetch_setup_data(endpoint_url)
                
                record_count = len(response) if isinstance(response, list) else 0
                
                print(f"✅ SUCCESS")
                print(f"   Records: {record_count:,}")
                
                if isinstance(response, list) and len(response) > 0:
                    first_record = response[0]
                    print(f"   Keys: {list(first_record.keys())}")
                    print(f"   Sample: {first_record}")
                
                results.append({
                    "name": dimension_name,
                    "status": "✅ SUCCESS",
                    "records": record_count
                })
                
            except Exception as e:
                print(f"❌ FAILED: {e}")
                results.append({
                    "name": dimension_name,
                    "status": "❌ FAILED",
                    "error": str(e)
                })
            
            print()
        
        # Summary
        print(f"\n{'='*60}")
        print("SUMMARY")
        print(f"{'='*60}")
        
        for result in results:
            if "error" in result:
                print(f"{result['name']}: {result['status']}")
                print(f"  Error: {result['error']}")
            else:
                print(f"{result['name']}: {result['status']} - {result['records']:,} records")
        
        success_count = sum(1 for r in results if "error" not in r)
        print(f"\n✅ {success_count}/6 FinanceDimension classes synced successfully")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(test_all_dimensions())
