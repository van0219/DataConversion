"""
Test script to see raw response from FinanceDimension6 FlatList endpoint
"""
import asyncio
import sys
import json
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from app.core.database import SessionLocal
from app.modules.accounts.service import AccountService
from app.utils.encryption import encryption
import httpx

async def test_raw_response():
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
        
        # Authenticate
        oauth_base = account.oauth_url.rstrip('/')
        token_endpoint = f"{oauth_base}/token.oauth2"
        
        print(f"🔐 Authenticating at: {token_endpoint}")
        
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
        
        # Test FlatList endpoint
        endpoint_url = "soap/classes/FinanceDimension6/lists/FinanceDimension6FlatList?_limit=100000&_links=false&_pageNav=true&_out=JSON&_flatten=false"
        base = account.base_url.rstrip('/')
        full_url = f"{base}/{account.tenant_id}/FSM/fsm/{endpoint_url}"
        
        print(f"📡 Fetching from FlatList endpoint:")
        print(f"   {full_url}\n")
        
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.get(
                full_url,
                headers={"Authorization": f"Bearer {access_token}"}
            )
            response.raise_for_status()
            data = response.json()
        
        print(f"✅ Response received!")
        print(f"   Type: {type(data)}")
        
        if isinstance(data, dict):
            print(f"   Keys: {list(data.keys())}")
            print(f"\n📊 Full response structure:")
            print(json.dumps(data, indent=2)[:2000])  # First 2000 chars
            
            # Check for _records
            if "_records" in data:
                print(f"\n✅ Found _records array with {len(data['_records'])} records")
                if len(data["_records"]) > 0:
                    print(f"\n   First record sample:")
                    print(json.dumps(data["_records"][0], indent=2)[:500])
            else:
                print(f"\n⚠️  No _records key found in response")
        
        elif isinstance(data, list):
            print(f"   Length: {len(data)}")
            if len(data) > 0:
                print(f"\n   First item (index 0):")
                print(json.dumps(data[0], indent=2)[:500])
                
                if len(data) > 1:
                    print(f"\n   Second item (index 1):")
                    print(json.dumps(data[1], indent=2)[:1000])
                
                if len(data) > 2:
                    print(f"\n   Third item (index 2):")
                    print(json.dumps(data[2], indent=2)[:1000])
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(test_raw_response())
