"""
Test script to verify list name parsing from swagger files.
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

from pathlib import Path
from app.modules.snapshot.service import SnapshotService

def test_list_parsing():
    """Test parsing of list names from swagger files"""
    
    swagger_dir = Path(__file__).parent.parent / "FSM_Swagger" / "Setup"
    
    print("=" * 100)
    print("TESTING LIST NAME PARSING FROM SWAGGER FILES")
    print("=" * 100)
    print()
    
    # Test a few key files
    test_files = [
        "FinanceDimension6.json",
        "Account.json",
        "Currency.json",
        "Project.json"
    ]
    
    for filename in test_files:
        swagger_file = swagger_dir / filename
        business_class = swagger_file.stem
        
        print(f"{'─' * 100}")
        print(f"Testing: {filename}")
        
        result = SnapshotService._parse_swagger_file(swagger_file, business_class)
        
        if result:
            print(f"  ✓ Key Field: {result['key_field']}")
            print(f"  ✓ Available Lists ({len(result['available_lists'])}):")
            for i, list_name in enumerate(result['available_lists'][:10], 1):  # Show first 10
                print(f"      {i}. {list_name}")
            if len(result['available_lists']) > 10:
                print(f"      ... and {len(result['available_lists']) - 10} more")
        else:
            print("  ✗ Parsing failed")
        print()
    
    print("=" * 100)

if __name__ == "__main__":
    test_list_parsing()
