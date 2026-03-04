"""
Update FinanceDimension endpoints to use FlatList format
"""
import sqlite3

def update_endpoints():
    conn = sqlite3.connect('fsm_workbench.db')
    cursor = conn.cursor()
    
    # Update FinanceDimension1-5 to use FlatList format
    for i in range(1, 7):  # 1 through 6
        dimension_name = f"FinanceDimension{i}"
        new_endpoint = f"soap/classes/{dimension_name}/lists/{dimension_name}FlatList?_limit=100000&_links=false&_pageNav=true&_out=JSON&_flatten=false"
        
        cursor.execute(
            "UPDATE setup_business_classes SET endpoint_url = ? WHERE name = ?",
            (new_endpoint, dimension_name)
        )
        
        if cursor.rowcount > 0:
            print(f"✅ Updated {dimension_name}")
            print(f"   New endpoint: {new_endpoint}")
        else:
            print(f"⚠️  {dimension_name} not found in database")
    
    conn.commit()
    conn.close()
    print("\n✅ All FinanceDimension endpoints updated!")

if __name__ == "__main__":
    update_endpoints()
