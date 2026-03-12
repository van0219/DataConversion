import sqlite3

conn = sqlite3.connect('fsm_workbench.db')
cursor = conn.cursor()

# Get recent jobs
print("\n=== Recent Conversion Jobs ===")
cursor.execute('''
    SELECT id, status, business_class, filename, valid_records, invalid_records, total_records, created_at
    FROM conversion_jobs 
    ORDER BY id DESC 
    LIMIT 5
''')

for row in cursor.fetchall():
    job_id, status, business_class, filename, valid, invalid, total, created = row
    print(f"\nJob ID: {job_id}")
    print(f"  Status: {status}")
    print(f"  Business Class: {business_class}")
    print(f"  Filename: {filename}")
    print(f"  Records: {valid} valid, {invalid} invalid, {total} total")
    print(f"  Created: {created}")
    
    # Get error count for this job
    cursor.execute('SELECT COUNT(*) FROM validation_errors WHERE conversion_job_id = ?', (job_id,))
    error_count = cursor.fetchone()[0]
    print(f"  Validation Errors: {error_count}")
    
    # Get sample errors if any
    if error_count > 0:
        cursor.execute('''
            SELECT row_number, field_name, error_type, error_message 
            FROM validation_errors 
            WHERE conversion_job_id = ? 
            LIMIT 3
        ''', (job_id,))
        print(f"  Sample Errors:")
        for err in cursor.fetchall():
            print(f"    Row {err[0]}: {err[1]} - {err[2]} - {err[3]}")

# Check if schema exists for GLTransactionInterface
print("\n=== Schema Check ===")
cursor.execute('''
    SELECT id, business_class, version_number, is_active, created_at
    FROM schemas
    WHERE business_class = 'GLTransactionInterface'
    ORDER BY version_number DESC
    LIMIT 3
''')

schemas = cursor.fetchall()
if schemas:
    print("GLTransactionInterface schemas found:")
    for schema in schemas:
        print(f"  Schema ID {schema[0]}: v{schema[2]}, active={schema[3]}, created={schema[4]}")
else:
    print("NO SCHEMA FOUND for GLTransactionInterface!")

conn.close()
