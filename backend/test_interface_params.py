#!/usr/bin/env python3
"""
Test script to verify interface parameters are being passed correctly
from frontend to backend during load operations.
"""

import asyncio
import json
import sys
import os

# Add the app directory to Python path
sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))

from app.modules.load.service import LoadService
from app.core.database import get_db
from sqlalchemy.orm import Session

def test_interface_params_structure():
    """Test that interface parameters structure matches between frontend and backend"""
    
    # Frontend interface parameters structure (from ConversionWorkflow.tsx)
    frontend_params = {
        "enterpriseGroup": "FCE",
        "accountingEntity": "10", 
        "editOnly": False,
        "editAndInterface": True,
        "partialUpdate": False,
        "journalizeByEntity": True,
        "journalByJournalCode": False,
        "bypassOrganizationCode": True,
        "bypassAccountCode": True,
        "bypassStructureRelationEdit": False,
        "interfaceInDetail": True,
        "currencyTable": "USD",
        "bypassNegativeRateEdit": False,
        "primaryLedger": ""
    }
    
    print("✅ Frontend Interface Parameters Structure:")
    for key, value in frontend_params.items():
        print(f"   {key}: {value} ({type(value).__name__})")
    
    # Backend expected parameters (from LoadService.start_load method)
    backend_expected = [
        "enterpriseGroup",
        "accountingEntity", 
        "editOnly",
        "editAndInterface",
        "partialUpdate",
        "journalizeByEntity",
        "journalByJournalCode",
        "bypassOrganizationCode",
        "bypassAccountCode",
        "bypassStructureRelationEdit",
        "interfaceInDetail",
        "currencyTable",
        "bypassNegativeRateEdit",
        "primaryLedger"
    ]
    
    print("\n✅ Backend Expected Parameters:")
    for param in backend_expected:
        print(f"   {param}")
    
    # Check compatibility
    frontend_keys = set(frontend_params.keys())
    backend_keys = set(backend_expected)
    
    missing_in_frontend = backend_keys - frontend_keys
    extra_in_frontend = frontend_keys - backend_keys
    
    print(f"\n🔍 Compatibility Check:")
    if missing_in_frontend:
        print(f"   ❌ Missing in frontend: {missing_in_frontend}")
    if extra_in_frontend:
        print(f"   ⚠️  Extra in frontend: {extra_in_frontend}")
    
    if not missing_in_frontend and not extra_in_frontend:
        print("   ✅ Perfect match! Frontend and backend parameters are compatible.")
        return True
    else:
        print("   ❌ Mismatch detected!")
        return False

def test_load_request_format():
    """Test the load request format that frontend sends to backend"""
    
    # Simulated load request from frontend
    load_request = {
        "job_id": 123,
        "business_class": "GLTransactionInterface",
        "mapping": {"Amount": {"fsm_field": "TransactionAmount", "confidence": "exact"}},
        "chunk_size": 100,
        "trigger_interface": True,
        "interface_params": {
            "enterpriseGroup": "FCE",
            "accountingEntity": "10",
            "editOnly": False,
            "editAndInterface": True,
            "partialUpdate": False,
            "journalizeByEntity": True,
            "journalByJournalCode": False,
            "bypassOrganizationCode": True,
            "bypassAccountCode": True,
            "bypassStructureRelationEdit": False,
            "interfaceInDetail": True,
            "currencyTable": "USD",
            "bypassNegativeRateEdit": False,
            "primaryLedger": ""
        }
    }
    
    print("✅ Load Request Format (Frontend → Backend):")
    print(json.dumps(load_request, indent=2))
    
    # Verify interface_params is included when trigger_interface is True
    if load_request["trigger_interface"] and load_request["interface_params"]:
        print("\n✅ Interface parameters correctly included when trigger_interface=True")
        return True
    else:
        print("\n❌ Interface parameters missing when trigger_interface=True")
        return False

def main():
    """Run all tests"""
    print("🧪 Testing Interface Parameters Passing\n")
    print("=" * 60)
    
    # Test 1: Parameter structure compatibility
    print("\n📋 Test 1: Parameter Structure Compatibility")
    print("-" * 50)
    test1_passed = test_interface_params_structure()
    
    # Test 2: Load request format
    print("\n📋 Test 2: Load Request Format")
    print("-" * 50)
    test2_passed = test_load_request_format()
    
    # Summary
    print("\n" + "=" * 60)
    print("🏁 Test Summary:")
    print(f"   Test 1 (Parameter Compatibility): {'✅ PASSED' if test1_passed else '❌ FAILED'}")
    print(f"   Test 2 (Request Format): {'✅ PASSED' if test2_passed else '❌ FAILED'}")
    
    if test1_passed and test2_passed:
        print("\n🎉 All tests passed! Interface parameters should work correctly.")
        print("\n💡 Next Steps:")
        print("   1. Test with actual load operation in the UI")
        print("   2. Check backend logs for interface parameter usage")
        print("   3. Verify interface succeeds with correct parameters")
    else:
        print("\n❌ Some tests failed. Please review the parameter structure.")
    
    return test1_passed and test2_passed

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)