#!/usr/bin/env python3
"""
Test script to verify rule sets API filtering by business class.
"""

import requests
import json

# Test the API endpoint directly
BASE_URL = 'http://localhost:8000'

def test_rule_sets_filtering():
    # Login first
    login_response = requests.post(f'{BASE_URL}/api/accounts/login', json={
        'account_name': 'Tamics10 AX1',
        'password': 'password123'
    })

    if login_response.status_code != 200:
        print(f'Login failed: {login_response.status_code} - {login_response.text}')
        return

    token = login_response.json()['access_token']
    headers = {'Authorization': f'Bearer {token}'}
    
    # Test rule sets for GLTransactionInterface
    print('Testing rule sets for GLTransactionInterface:')
    response = requests.get(f'{BASE_URL}/api/rules/rule-sets', 
                          headers=headers, 
                          params={'business_class': 'GLTransactionInterface'})
    
    if response.status_code == 200:
        rule_sets = response.json()
        print(f'Found {len(rule_sets)} rule sets:')
        for rs in rule_sets:
            print(f'  - ID: {rs["id"]}, Name: {rs["name"]}, Business Class: {rs["business_class"]}')
    else:
        print(f'Error: {response.status_code} - {response.text}')
    
    print()
    
    # Test rule sets for PurchaseOrderImport
    print('Testing rule sets for PurchaseOrderImport:')
    response = requests.get(f'{BASE_URL}/api/rules/rule-sets', 
                          headers=headers, 
                          params={'business_class': 'PurchaseOrderImport'})
    
    if response.status_code == 200:
        rule_sets = response.json()
        print(f'Found {len(rule_sets)} rule sets:')
        for rs in rule_sets:
            print(f'  - ID: {rs["id"]}, Name: {rs["name"]}, Business Class: {rs["business_class"]}')
    else:
        print(f'Error: {response.status_code} - {response.text}')
    
    print()
    
    # Test rule sets without filter (all)
    print('Testing rule sets without filter (all):')
    response = requests.get(f'{BASE_URL}/api/rules/rule-sets', headers=headers)
    
    if response.status_code == 200:
        rule_sets = response.json()
        print(f'Found {len(rule_sets)} rule sets:')
        for rs in rule_sets:
            print(f'  - ID: {rs["id"]}, Name: {rs["name"]}, Business Class: {rs["business_class"]}')
    else:
        print(f'Error: {response.status_code} - {response.text}')

if __name__ == "__main__":
    test_rule_sets_filtering()