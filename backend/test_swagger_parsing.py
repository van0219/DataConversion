"""
Test script to verify single-file swagger parsing for setup classes.
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

from pathlib import Path
import json
from app.modules.snapshot.service import SnapshotService

def test_parse_swagger():
    """Test parsing of single JSON swagger files"""
    
    swagger_dir = Path(__file__).parent.parent / "FSM_Swagger" / "Setup"
    
    print("=" * 80)
    print("Testing Single-File Swagger Parsing - ALL SETUP CLASSES")
    print("=" * 80)
    
    # Get all .json files
    json_files = sorted(swagger_dir.glob("*.json"))
    
    print(f"\nFound {len(json_files)} swagger files\n")
    
    success_count = 0
    fail_count = 0
    
    for swagger_file in json_files:
        business_class = swagger_file.stem
        print(f"{'─' * 80}")
        print(f"Testing: {swagger_file.name}")
        
        result = SnapshotService._parse_swagger_file(swagger_file, business_class)
        
        if result:
            print(f"  ✓ SUCCESS")
            print(f"  Key Field: {result['key_field']}")
            print(f"  Endpoint: {result['endpoint_url'][:80]}...")
            success_count += 1
        else:
            print(f"  ✗ FAILED - Parsing returned None")
            fail_count += 1
    
    print(f"\n{'=' * 80}")
    print(f"Test Complete: {success_count} passed, {fail_count} failed")
    print("=" * 80)
    
    return fail_count == 0

if __name__ == "__main__":
    success = test_parse_swagger()
    sys.exit(0 if success else 1)
