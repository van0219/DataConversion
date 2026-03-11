"""
Query load_results table to see FSM API response details
"""
import sqlite3
import json
from pathlib import Path

# Connect to database
db_path = Path(__file__).parent / "fsm_workbench.db"
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Get the most recent load result
cursor.execute("""
    SELECT 
        id,
        conversion_job_id,
        chunk_number,
        success_count,
        failure_count,
        fsm_response,
        created_at
    FROM load_results
    ORDER BY created_at DESC
    LIMIT 5
""")

results = cursor.fetchall()

if not results:
    print("No load results found in database")
else:
    print(f"\n{'='*80}")
    print(f"MOST RECENT LOAD RESULTS (Last 5)")
    print(f"{'='*80}\n")
    
    for row in results:
        load_id, job_id, chunk_num, success, failure, fsm_response, created_at = row
        
        print(f"Load Result ID: {load_id}")
        print(f"Job ID: {job_id}")
        print(f"Chunk Number: {chunk_num}")
        print(f"Success Count: {success}")
        print(f"Failure Count: {failure}")
        print(f"Created At: {created_at}")
        print(f"\nFSM API Response:")
        print("-" * 80)
        
        try:
            response_data = json.loads(fsm_response)
            print(json.dumps(response_data, indent=2))
        except:
            print(fsm_response)
        
        print(f"\n{'='*80}\n")

conn.close()
