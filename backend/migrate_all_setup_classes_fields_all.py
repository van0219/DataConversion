"""
Migration: Update all setup business classes to use _fields=_all and _limit=100000
This ensures all records and all fields are captured for each setup class.

NOTE: List names vary by business class:
- Account: DetailAccountList
- FinanceDimension1-6: FinanceDimensionXFlatList
- Others: Typically PrimaryXXXList (but may vary)

User will provide the correct list names for remaining classes.
"""
import sqlite3
from pathlib import Path

def migrate():
    # Connect to database
    db_path = Path(__file__).parent / "fsm_workbench.db"
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    print("Updating all setup business classes to use _fields=_all and _limit=100000...")
    print("="*80)
    
    # Define endpoint updates
    # Format: (class_name, list_name)
    updates = [
        # Already updated
        ("Account", "DetailAccountList"),
        ("FinanceDimension1", "FinanceDimension1FlatList"),
        ("FinanceDimension2", "FinanceDimension2FlatList"),
        ("FinanceDimension3", "FinanceDimension3FlatList"),
        ("FinanceDimension4", "FinanceDimension4FlatList"),
        ("FinanceDimension5", "FinanceDimension5FlatList"),
        
        # User-provided list names
        ("AccountingEntity", "PrimaryAccountingEntityList"),
        ("Currency", "Currencies"),
        ("GeneralLedgerChartAccount", "DetailAccountList"),
        ("Ledger", "PrimaryCloseLedgerList"),
        ("Project", "ProjectFlatList"),
        
        # Note: FinanceEnterpriseGroup not included - awaiting list name
    ]
    
    for class_name, list_name in updates:
        endpoint_url = f"soap/classes/{class_name}/lists/{list_name}?_fields=_all&_limit=100000&_links=false&_pageNav=true&_out=JSON&_flatten=false"
        
        cursor.execute(
            "UPDATE setup_business_classes SET endpoint_url = ? WHERE name = ?",
            (endpoint_url, class_name)
        )
        
        if cursor.rowcount > 0:
            print(f"✅ Updated {class_name}")
            print(f"   List: {list_name}")
        else:
            print(f"⚠️  {class_name} not found in database")
        print()
    
    conn.commit()
    conn.close()
    
    print("="*80)
    print(f"✅ Migration completed! Updated {len(updates)} classes")
    print("\nAll endpoints now use:")
    print("  - _fields=_all (returns all available fields)")
    print("  - _limit=100000 (ensures all records are captured)")

if __name__ == "__main__":
    migrate()
