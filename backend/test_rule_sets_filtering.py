#!/usr/bin/env python3
"""
Test rule sets API filtering to debug the business class filtering issue.
"""

import requests

BASE_URL = 'http://localhost:8000'

def test_rule_sets_filtering():
    """Test rule sets API with different business class filters"""
    
    # Create a test account and login
    try:
        # Try to login with existing account
        login_response = requests.post(f'{BASE_URL}/api/accounts/login', json={
            'account_name': 'test_account',
            'password': 'test_password'
        })
        
        if login_response.status_code != 200:
            print(f'Login failed: {login_response.status_code} - {login_response.text}')
            return
        
        token = login_response.json()['access_token']
        headers = {'Authorization': f'Bearer {token}'}
        
        print('=== Rule Sets API Filtering Test ===')
        print()
        
        # Test 1: All rule sets (no filter)
        print('1. All rule sets (no business_class parameter):')
        response = requests.get(f'{BASE_URL}/api/rules/rule-sets', headers=headers)
        if response.status_code == 200:
            rule_sets = response.json()
            print(f'   Found {len(rule_sets)} rule sets:')
            for rs in rule_sets:
                print(f'   - ID: {rs["id"]}, Name: {rs["name"]}, Business Class: {rs["business_class"]}')
        else:
            print(f'   Error: {response.status_code} - {response.text}')
        
        print()
        
        # Test 2: Filter by GLTransactionInterface
        print('2. GLTransactionInterface rule sets:')
        response = requests.get(f'{BASE_URL}/api/rules/rule-sets', 
                              headers=headers, 
                              params={'business_class': 'GLTransactionInterface'})
        if response.status_code == 200:
            rule_sets = response.json()
            print(f'   Found {len(rule_sets)} rule sets:')
            for rs in rule_sets:
                print(f'   - ID: {rs["id"]}, Name: {rs["name"]}, Business Class: {rs["business_class"]}')
        else:
            print(f'   Error: {response.status_code} - {response.text}')
        
        print()
        
        # Test 3: Filter by PurchaseOrderImport
        print('3. PurchaseOrderImport rule sets:')
        response = requests.get(f'{BASE_URL}/api/rules/rule-sets', 
                              headers=headers, 
                              params={'business_class': 'PurchaseOrderImport'})
        if response.status_code == 200:
            rule_sets = response.json()
            print(f'   Found {len(rule_sets)} rule sets:')
            for rs in rule_sets:
                print(f'   - ID: {rs["id"]}, Name: {rs["name"]}, Business Class: {rs["business_class"]}')
        else:
            print(f'   Error: {response.status_code} - {response.text}')
        
    except Exception as e:
        print(f'Test failed: {e}')

if __name__ == "__main__":
    test_rule_sets_filtering()