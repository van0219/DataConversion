"""
Migration: Update Account endpoint to use DetailAccountList with _fields=_all
"""
import sqlite3
from pathlib import Path

def migrate():
    # Connect to database
    db_path = Path(__file__).parent / "fsm_workbench.db"
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    print("Updating Account endpoint to use DetailAccountList...")
    
    # Update Account endpoint
    new_endpoint = "soap/classes/Account/lists/DetailAccountList?_fields=_all&_limit=100000&_links=false&_pageNav=true&_out=JSON&_flatten=false"
    
    cursor.execute(
        "UPDATE setup_business_classes SET endpoint_url = ? WHERE name = ?",
        (new_endpoint, "Account")
    )
    
    if cursor.rowcount > 0:
        print(f"✅ Updated Account endpoint")
        print(f"   New endpoint: {new_endpoint}")
    else:
        print(f"⚠️  Account not found in database")
    
    conn.commit()
    conn.close()
    
    print("\n✅ Migration completed!")

if __name__ == "__main__":
    migrate()
