"""
Migration: Update all FinanceDimension endpoints to use _fields=_all
"""
import sqlite3
from pathlib import Path

def migrate():
    # Connect to database
    db_path = Path(__file__).parent / "fsm_workbench.db"
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    print("Updating FinanceDimension endpoints to use _fields=_all...")
    
    # Update all FinanceDimension classes (1-6)
    for i in range(1, 7):
        dimension_name = f"FinanceDimension{i}"
        new_endpoint = f"soap/classes/{dimension_name}/lists/{dimension_name}FlatList?_fields=_all&_limit=100000&_links=false&_pageNav=true&_out=JSON&_flatten=false"
        
        cursor.execute(
            "UPDATE setup_business_classes SET endpoint_url = ? WHERE name = ?",
            (new_endpoint, dimension_name)
        )
        
        if cursor.rowcount > 0:
            print(f"✅ Updated {dimension_name}")
        else:
            print(f"⚠️  {dimension_name} not found in database")
    
    conn.commit()
    conn.close()
    
    print("\n✅ Migration completed!")
    print("All FinanceDimension endpoints now use _fields=_all")

if __name__ == "__main__":
    migrate()
