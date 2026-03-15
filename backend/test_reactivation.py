#!/usr/bin/env python3
"""
Test script for schema reactivation functionality.
Tests that uploading a schema with the same hash as a deactivated schema will reactivate it.
"""

import requests
import json
from pathlib import Path

# Configuration
BASE_URL = "http://localhost:8000"
SWAGGER_FILE = "../FSM_Swagger/Conversion/PurchaseOrderImport.json"
BUSINESS_CLASS = "PurchaseOrderImport"

# Test credentials (using account ID 1)
LOGIN_DATA = {
    "account_name": "Tamics10 AX1",
    "password": "password123"
}

def test_schema_reactivation():
    """Test the schema reactivation functionality"""
    
    print("🧪 Testing Schema Reactivation Functionality")
    print("=" * 50)
    
    # Step 1: Login to get JWT token
    print("1. Logging in...")
    login_response = requests.post(f"{BASE_URL}/api/accounts/login", json=LOGIN_DATA)
    
    if login_response.status_code != 200:
        print(f"❌ Login failed: {login_response.status_code}")
        print(login_response.text)
        return False
    
    token = login_response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("✅ Login successful")
    
    # Step 2: Check current schema state
    print("\n2. Checking current schema state...")
    list_response = requests.get(f"{BASE_URL}/api/schema/list", headers=headers)
    
    if list_response.status_code != 200:
        print(f"❌ Failed to list schemas: {list_response.status_code}")
        return False
    
    schemas = list_response.json().get("schemas", [])
    purchase_order_schemas = [s for s in schemas if s["business_class"] == BUSINESS_CLASS]
    
    print(f"Found {len(purchase_order_schemas)} PurchaseOrderImport schemas:")
    for schema in purchase_order_schemas:
        print(f"  - ID: {schema['id']}, Version: {schema['version']}, Active: {schema.get('is_active', 'unknown')}")
    
    # Step 3: Read swagger file
    print(f"\n3. Reading swagger file: {SWAGGER_FILE}")
    swagger_path = Path(__file__).parent / SWAGGER_FILE
    
    if not swagger_path.exists():
        print(f"❌ Swagger file not found: {swagger_path}")
        return False
    
    with open(swagger_path, 'r') as f:
        swagger_content = f.read()
    
    print(f"✅ Swagger file loaded ({len(swagger_content)} characters)")
    
    # Step 4: Upload swagger file (should trigger reactivation)
    print(f"\n4. Uploading swagger file for {BUSINESS_CLASS}...")
    
    files = {
        'swagger_file': ('PurchaseOrderImport.json', swagger_content, 'application/json')
    }
    data = {
        'business_class': BUSINESS_CLASS
    }
    
    upload_response = requests.post(
        f"{BASE_URL}/api/schema/import-swagger",
        headers=headers,
        files=files,
        data=data
    )
    
    print(f"Upload response status: {upload_response.status_code}")
    
    if upload_response.status_code != 200:
        print(f"❌ Upload failed: {upload_response.text}")
        return False
    
    result = upload_response.json()
    print("✅ Upload successful!")
    print(f"Response: {json.dumps(result, indent=2)}")
    
    # Step 5: Verify reactivation behavior
    print("\n5. Verifying reactivation behavior...")
    
    # Check if the response indicates reactivation
    if result.get("reactivated"):
        print("✅ Schema was reactivated (reactivated flag = True)")
    elif result.get("new_schema"):
        print("⚠️  Response indicates new schema, but should be reactivation")
    else:
        print("⚠️  Response indicates existing schema")
    
    # Check the message interpretation
    if result.get("reactivated"):
        expected_message = "Schema Reactivated"
    elif result.get("new_schema"):
        expected_message = "New Schema Version Created"
    else:
        expected_message = "Schema Already Exists"
    
    print(f"Expected UI message: '{expected_message}'")
    
    # Step 6: Verify database state
    print("\n6. Checking final schema state...")
    final_list_response = requests.get(f"{BASE_URL}/api/schema/list", headers=headers)
    
    if final_list_response.status_code == 200:
        final_schemas = final_list_response.json().get("schemas", [])
        final_purchase_order_schemas = [s for s in final_schemas if s["business_class"] == BUSINESS_CLASS]
        
        print(f"Final state - {len(final_purchase_order_schemas)} PurchaseOrderImport schemas:")
        for schema in final_purchase_order_schemas:
            active_status = "ACTIVE" if schema.get('is_active', True) else "INACTIVE"
            print(f"  - ID: {schema['id']}, Version: {schema['version']}, Status: {active_status}")
        
        # Check if we have exactly one active schema
        active_schemas = [s for s in final_purchase_order_schemas if s.get('is_active', True)]
        if len(active_schemas) == 1:
            print("✅ Exactly one active schema found")
        else:
            print(f"⚠️  Expected 1 active schema, found {len(active_schemas)}")
    
    print("\n" + "=" * 50)
    print("🎯 Test Summary:")
    print(f"   - Business Class: {BUSINESS_CLASS}")
    print(f"   - Reactivated Flag: {result.get('reactivated', False)}")
    print(f"   - New Schema Flag: {result.get('new_schema', False)}")
    print(f"   - Expected UI Message: {expected_message}")
    
    return True

if __name__ == "__main__":
    try:
        test_schema_reactivation()
    except Exception as e:
        print(f"❌ Test failed with exception: {e}")
        import traceback
        traceback.print_exc()