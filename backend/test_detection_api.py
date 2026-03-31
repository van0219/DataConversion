"""
Test Business Class Detection API

Tests the detection endpoint with various filenames.
"""

import requests
import json

BASE_URL = "http://localhost:8000"

def test_detection(filename: str):
    """Test detection for a filename"""
    print(f"\n🔍 Testing: {filename}")
    print("=" * 60)
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/upload/detect",
            params={"filename": filename}
        )
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Detection successful!")
            print(f"   Business Class: {result['business_class']}")
            print(f"   Structure Type: {result['structure_type']}")
            print(f"   Family Root: {result['family_root']}")
            print(f"   Member Count: {result['member_count']}")
            print(f"   Confidence: {result['confidence']}")
            
            if result['related_tables']:
                print(f"   Related Tables:")
                for table in result['related_tables'][:5]:  # Show first 5
                    role = result['table_roles'].get(table, 'unknown')
                    print(f"      - {table} ({role})")
                if len(result['related_tables']) > 5:
                    print(f"      ... and {len(result['related_tables']) - 5} more")
        else:
            print(f"❌ Error: {response.status_code}")
            print(f"   {response.text}")
    
    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to backend. Is the server running?")
        print("   Start with: cd backend && python -m uvicorn app.main:app --reload")
    except Exception as e:
        print(f"❌ Error: {e}")


def main():
    """Run detection tests"""
    print("\n" + "=" * 60)
    print("Business Class Detection API Test")
    print("=" * 60)
    
    # Test cases
    test_cases = [
        "GLTransactionInterface_20251128.csv",
        "PayablesInvoice_20250101.csv",
        "Vendor_Import_Data.csv",
        "PurchaseOrder_20250315.csv",
        "Customer_data.csv",
        "UnknownClass_test.csv"
    ]
    
    for filename in test_cases:
        test_detection(filename)
    
    print("\n" + "=" * 60)
    print("✅ Test complete!")
    print("=" * 60)


if __name__ == "__main__":
    main()
