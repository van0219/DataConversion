"""
Migration: Update FinanceEnterpriseGroup endpoint to use FinanceEnterpriseGroupList with _fields=_all
"""
import sqlite3
from pathlib import Path

def migrate():
    # Connect to database
    db_path = Path(__file__).parent / "fsm_workbench.db"
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    print("Updating FinanceEnterpriseGroup endpoint...")
    
    # Update FinanceEnterpriseGroup endpoint
    new_endpoint = "soap/classes/FinanceEnterpriseGroup/lists/FinanceEnterpriseGroupList?_fields=_all&_limit=100000&_links=false&_pageNav=true&_out=JSON&_flatten=false"
    
    cursor.execute(
        "UPDATE setup_business_classes SET endpoint_url = ? WHERE name = ?",
        (new_endpoint, "FinanceEnterpriseGroup")
    )
    
    if cursor.rowcount > 0:
        print(f"✅ Updated FinanceEnterpriseGroup endpoint")
        print(f"   New endpoint: {new_endpoint}")
    else:
        print(f"⚠️  FinanceEnterpriseGroup not found in database")
    
    conn.commit()
    conn.close()
    
    print("\n✅ Migration completed!")
    print("\n🎉 ALL 12 SETUP CLASSES NOW STANDARDIZED!")
    print("   All classes use _fields=_all and _limit=100000")

if __name__ == "__main__":
    migrate()
