"""
Test script to sync FinanceDimension6 data from FSM
"""
import asyncio
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from app.core.database import SessionLocal
from app.services.fsm_client import FSMClient
from app.modules.accounts.service import AccountService

async def test_sync():
    db = SessionLocal()
    
    try:
        # Get account (assuming first account)
        account = AccountService.get_account_by_id(db, 1)
        if not account:
            print("❌ No account found with ID 1")
            return
        
        # Get decrypted credentials
        from app.utils.encryption import encryption
        client_id = encryption.decrypt(account.client_id_encrypted)
        client_secret = encryption.decrypt(account.client_secret_encrypted)
        saak = encryption.decrypt(account.saak_encrypted)
        sask = encryption.decrypt(account.sask_encrypted)
        
        print(f"✅ Using account: {account.account_name}")
        print(f"   Tenant: {account.tenant_id}")
        print(f"   Base URL: {account.base_url}")
        print(f"   OAuth URL: {account.oauth_url}")
        
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
        print("\n🔐 Authenticating...")
        await fsm_client.authenticate()
        print("✅ Authentication successful")
        
        # Fetch FinanceDimension6 data
        endpoint_url = "soap/classes/FinanceDimension6/lists/PrimaryFinanceDimension6List?_fields=FinanceDimension6,Description,Active&_limit=100000&_links=false&_pageNav=false&_out=JSON&_flatten=false"
        print(f"\n📡 Fetching data from: {endpoint_url[:80]}...")
        
        response = await fsm_client.fetch_setup_data(endpoint_url)
        
        print(f"\n✅ Response received!")
        print(f"   Type: {type(response)}")
        print(f"   Length: {len(response) if isinstance(response, list) else 'N/A'}")
        
        if isinstance(response, list) and len(response) > 0:
            print(f"\n📊 First record sample:")
            first_record = response[0]
            
            # Check if it has _fields wrapper
            if isinstance(first_record, dict) and '_fields' in first_record:
                print("   Format: Has _fields wrapper")
                actual_data = first_record['_fields']
                print(f"   Keys: {list(actual_data.keys())[:10]}...")  # First 10 keys
                print(f"\n   Sample data:")
                for key in list(actual_data.keys())[:5]:
                    print(f"      {key}: {actual_data[key]}")
            else:
                print("   Format: Direct object")
                print(f"   Keys: {list(first_record.keys())[:10]}...")
                print(f"\n   Sample data:")
                for key in list(first_record.keys())[:5]:
                    print(f"      {key}: {first_record[key]}")
        else:
            print(f"\n⚠️  Response: {response}")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(test_sync())
