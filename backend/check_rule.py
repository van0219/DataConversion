import sqlite3, json

conn = sqlite3.connect('fsm_workbench.db')
conn.row_factory = sqlite3.Row
cur = conn.cursor()

cur.execute("""
    SELECT id, name, rule_type, field_name, reference_business_class,
           reference_field_name, condition_expression, error_message
    FROM validation_rule_templates
    WHERE id = 224
""")
row = cur.fetchone()
if row:
    rule = dict(row)
    print('Rule 224 from database:')
    print(json.dumps(rule, indent=2))
    
    if rule['condition_expression']:
        print('\nParsed condition_expression:')
        print(json.dumps(json.loads(rule['condition_expression']), indent=2))
else:
    print('Rule 224 not found')

conn.close()
