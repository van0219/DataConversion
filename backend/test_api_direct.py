#!/usr/bin/env python3
"""
Test the API endpoint directly using FastAPI test client.
"""

from fastapi.testclient import TestClient
from app.main import app
from app.core.database import get_db
from app.modules.accounts.service import AccountService

client = TestClient(app)

def test_rule_sets_api():
    """Test rule sets API filtering"""
    
    # Create a test account first
    db = next(get_db())
    
    # Check if test account exists
    test_account = AccountService.get_account_by_name(db, "test_account")
    if not test_account:
        print("Creating test account...")
        test_account = AccountService.create_account(
            db=db,
            account_name="test_account",
            project_name="Test Project",
            tenant_id="TEST",
            base_url="https://test.com",
            oauth_url="https://test.com/oauth",
            client_id="test_client",
            client_secret="test_secret",
            saak="test_saak",
            sask="test_sask",
            username="test_user",
            password="test_password"
        )
    
    # Login to get token
    login_response = client.post("/api/accounts/login", json={
        "account_name": "test_account",
        "password": "test_password"
    })
    
    if login_response.status_code != 200:
        print(f"Login failed: {login_response.status_code} - {login_response.text}")
        return
    
    token = login_response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    print("=== API Rule Sets Test ===")
    print()
    
    # Test 1: All rule sets (no filter)
    print("1. All rule sets (no filter):")
    response = client.get("/api/rules/rule-sets", headers=headers)
    if response.status_code == 200:
        rule_sets = response.json()
        print(f"   Found {len(rule_sets)} rule sets:")
        for rs in rule_sets:
            print(f"   - ID: {rs['id']}, Name: {rs['name']}, Business Class: {rs['business_class']}")
    else:
        print(f"   Error: {response.status_code} - {response.text}")
    
    print()
    
    # Test 2: GLTransactionInterface
    print("2. GLTransactionInterface rule sets:")
    response = client.get("/api/rules/rule-sets", headers=headers, params={"business_class": "GLTransactionInterface"})
    if response.status_code == 200:
        rule_sets = response.json()
        print(f"   Found {len(rule_sets)} rule sets:")
        for rs in rule_sets:
            print(f"   - ID: {rs['id']}, Name: {rs['name']}, Business Class: {rs['business_class']}")
    else:
        print(f"   Error: {response.status_code} - {response.text}")
    
    print()
    
    # Test 3: PurchaseOrderImport
    print("3. PurchaseOrderImport rule sets:")
    response = client.get("/api/rules/rule-sets", headers=headers, params={"business_class": "PurchaseOrderImport"})
    if response.status_code == 200:
        rule_sets = response.json()
        print(f"   Found {len(rule_sets)} rule sets:")
        for rs in rule_sets:
            print(f"   - ID: {rs['id']}, Name: {rs['name']}, Business Class: {rs['business_class']}")
    else:
        print(f"   Error: {response.status_code} - {response.text}")
    
    print()
    
    # Test 4: No business_class parameter (simulating frontend fix)
    print("4. No business_class parameter:")
    response = client.get("/api/rules/rule-sets", headers=headers)
    if response.status_code == 200:
        rule_sets = response.json()
        print(f"   Found {len(rule_sets)} rule sets:")
        for rs in rule_sets:
            print(f"   - ID: {rs['id']}, Name: {rs['name']}, Business Class: {rs['business_class']}")
    else:
        print(f"   Error: {response.status_code} - {response.text}")
    
    db.close()

if __name__ == "__main__":
    test_rule_sets_api()