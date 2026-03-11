#!/usr/bin/env python3
"""
Test script to query GLTransactionInterfaceResult API directly
"""

import asyncio
import sys
import os

# Add the app directory to Python path
sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))

from app.services.fsm_client import FSMClient
from app.core.database import get_db
from app.modules.accounts.service import AccountService

async def test_interface_result_query():
    """Test GLTransactionInterfaceResult query with different filter variations"""
    
    # Get database session
    db = next(get_db())
    
    # Get account (assuming account ID 1 exists)
    account = AccountService.get_account_by_id(db, 1)
    if not account:
        print("❌ No account found with ID 1")
        return
    
    print(f"✅ Found account: {account.account_name}")
    
    # Get decrypted credentials
    credentials = AccountService.get_decrypted_credentials(account)
    
    # Initialize FSM client
    fsm_client = FSMClient(
        base_url=credentials["base_url"],
        oauth_url=credentials["oauth_url"],
        tenant_id=credentials["tenant_id"],
        client_id=credentials["client_id"],
        client_secret=credentials["client_secret"],
        saak=credentials["saak"],
        sask=credentials["sask"]
    )
    
    # Authenticate
    print("🔐 Authenticating with FSM...")
    await fsm_client.authenticate()
    print("✅ Authentication successful")
    
    # Test RunGroup
    run_group = "DataConversion_Demo_Correct"
    
    print(f"\n🔍 Testing GLTransactionInterfaceResult query for RunGroup: {run_group}")
    
    # Test 1: Original query with our current method
    print("\n📋 Test 1: Using current method")
    try:
        result = await fsm_client.query_gl_transaction_interface_result(run_group)
        if result:
            print(f"✅ Success: {result}")
        else:
            print("❌ No results returned")
    except Exception as e:
        print(f"❌ Error: {e}")
    
    # Test 2: Direct API call with simple filter
    print("\n📋 Test 2: Direct API call with simple filter")
    try:
        import httpx
        url = f"{credentials['base_url']}/{credentials['tenant_id']}/FSM/fsm/soap/classes/GLTransactionInterfaceResult/lists/_generic"
        
        params = {
            "_fields": "RunGroup,Status,ResultSequence,RecordCount,PassedCount,FailedCount,GLTransactionInterfaceResult",
            "_limit": "5",
            "_lplFilter": f'RunGroup = "{run_group}"',
            "_links": "false",
            "_pageNav": "true",
            "_out": "JSON",
            "_flatten": "false",
            "_omitCountValue": "false"
        }
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.get(
                url,
                headers={"Authorization": f"Bearer {fsm_client.access_token}"},
                params=params
            )
            
            print(f"Status: {response.status_code}")
            if response.status_code == 200:
                result = response.json()
                print(f"✅ Response: {result}")
            else:
                print(f"❌ Error: {response.text}")
                
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_interface_result_query())