"""
Check what data was sent to FSM and what mapping was used
"""
import sqlite3
import json
from pathlib import Path

# Connect to database
db_path = Path(__file__).parent / "fsm_workbench.db"
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Get the most recent job
cursor.execute("""
    SELECT 
        id,
        business_class,
        filename,
        status,
        total_records,
        valid_records,
        invalid_records
    FROM conversion_jobs
    ORDER BY created_at DESC
    LIMIT 1
""")

job = cursor.fetchone()

if job:
    job_id, business_class, filename, status, total, valid, invalid = job
    
    print(f"\n{'='*80}")
    print(f"MOST RECENT JOB DETAILS")
    print(f"{'='*80}\n")
    print(f"Job ID: {job_id}")
    print(f"Business Class: {business_class}")
    print(f"Filename: {filename}")
    print(f"Status: {status}")
    print(f"Total Records: {total}")
    print(f"Valid Records: {valid}")
    print(f"Invalid Records: {invalid}")
    
    # Check if there's a mapping template used
    cursor.execute("""
        SELECT 
            template_name,
            mapping_json,
            enabled_fields_json
        FROM mapping_templates
        WHERE business_class = ?
        ORDER BY created_at DESC
        LIMIT 1
    """, (business_class,))
    
    template = cursor.fetchone()
    if template:
        template_name, mapping_json, enabled_fields_json = template
        print(f"\n{'='*80}")
        print(f"MAPPING TEMPLATE: {template_name}")
        print(f"{'='*80}\n")
        print("Mapping (FSM Field → CSV Column):")
        print(json.dumps(json.loads(mapping_json), indent=2))
        
        if enabled_fields_json:
            print("\nEnabled Fields:")
            print(json.dumps(json.loads(enabled_fields_json), indent=2))
    
    # Get sample of uploaded data
    print(f"\n{'='*80}")
    print(f"SAMPLE CSV DATA (First 3 rows)")
    print(f"{'='*80}\n")
    
    import csv
    csv_path = Path(__file__).parent / "uploads" / f"{job_id}.csv"
    if csv_path.exists():
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            headers = reader.fieldnames
            print(f"CSV Headers: {headers}\n")
            
            for i, row in enumerate(reader):
                if i >= 3:
                    break
                print(f"Row {i+1}:")
                print(json.dumps(row, indent=2))
                print()
    else:
        print(f"CSV file not found: {csv_path}")

conn.close()
