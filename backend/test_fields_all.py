"""
Test that _fields=_all works correctly for FinanceDimension6
"""
import asyncio
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from app.core.database import SessionLocal
from app.modules.accounts.service import AccountService
from app.utils.encryption import encryption
import httpx

async def test_fields_all():
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
        
        print(f"✅ Using account: {account.account_name}\n")
        
        # Authenticate
        oauth_base = account.oauth_url.rstrip('/')
        token_endpoint = f"{oauth_base}/token.oauth2"
        
        print(f"🔐 Authenticating...")
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                token_endpoint,
                data={
                    "grant_type": "password",
                    "username": saak,
                    "password": sask,
                    "client_id": client_id,
                    "client_secret": client_secret
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"}
            )
            response.raise_for_status()
            access_token = response.json()["access_token"]
            print("✅ Authentication successful\n")
        
        # Test with _fields=_all
        endpoint_url = "soap/classes/FinanceDimension6/lists/FinanceDimension6FlatList?_fields=_all&_limit=100000&_links=false&_pageNav=true&_out=JSON&_flatten=false"
        base = account.base_url.rstrip('/')
        full_url = f"{base}/{account.tenant_id}/FSM/fsm/{endpoint_url}"
        
        print(f"📡 Testing endpoint with _fields=_all:")
        print(f"   {endpoint_url[:80]}...\n")
        
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.get(
                full_url,
                headers={"Authorization": f"Bearer {access_token}"}
            )
            response.raise_for_status()
            data = response.json()
        
        print(f"✅ Response received!")
        print(f"   Type: {type(data)}")
        print(f"   Length: {len(data)}")
        
        if isinstance(data, list) and len(data) > 1:
            # Skip metadata item (index 0)
            first_record = data[1]
            if "_fields" in first_record:
                fields = first_record["_fields"]
                print(f"\n📊 First record has {len(fields)} fields:")
                print(f"   Fields: {list(fields.keys())[:10]}...")
                print(f"\n   Sample data:")
                for key in list(fields.keys())[:5]:
                    print(f"      {key}: {fields[key]}")
                
                print(f"\n✅ SUCCESS: _fields=_all returns all available fields")
            else:
                print(f"\n⚠️  No _fields wrapper found")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(test_fields_all())
