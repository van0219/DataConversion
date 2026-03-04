"""
Detailed test script showing all parsed swagger file details.
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

from pathlib import Path
from app.modules.snapshot.service import SnapshotService

def test_parse_swagger_detailed():
    """Test parsing with detailed output"""
    
    swagger_dir = Path(__file__).parent.parent / "FSM_Swagger" / "Setup"
    json_files = sorted(swagger_dir.glob("*.json"))
    
    print("=" * 100)
    print("SWAGGER PARSING RESULTS - ALL 13 SETUP CLASSES")
    print("=" * 100)
    print()
    
    results = []
    
    for swagger_file in json_files:
        business_class = swagger_file.stem
        result = SnapshotService._parse_swagger_file(swagger_file, business_class)
        
        if result:
            results.append({
                "class": business_class,
                "key_field": result['key_field'],
                "endpoint": result['endpoint_url']
            })
    
    # Print table
    print(f"{'Business Class':<30} {'Key Field':<30} {'Endpoint Pattern':<40}")
    print("─" * 100)
    
    for r in results:
        # Extract list name from endpoint
        endpoint_parts = r['endpoint'].split('/lists/')
        if len(endpoint_parts) > 1:
            list_name = endpoint_parts[1].split('?')[0]
        else:
            list_name = "N/A"
        
        print(f"{r['class']:<30} {r['key_field']:<30} {list_name:<40}")
    
    print()
    print("=" * 100)
    print(f"Total: {len(results)} setup classes successfully parsed")
    print("=" * 100)
    print()
    
    # Group by endpoint pattern
    print("ENDPOINT PATTERNS:")
    print("─" * 100)
    
    flatlist_classes = [r for r in results if 'FlatList' in r['endpoint']]
    primary_classes = [r for r in results if 'Primary' in r['endpoint'] and 'FlatList' not in r['endpoint']]
    
    print(f"\nFlatList Pattern ({len(flatlist_classes)} classes):")
    for r in flatlist_classes:
        print(f"  • {r['class']}")
    
    print(f"\nPrimary*List Pattern ({len(primary_classes)} classes):")
    for r in primary_classes:
        print(f"  • {r['class']}")
    
    print()
    print("=" * 100)

if __name__ == "__main__":
    test_parse_swagger_detailed()
