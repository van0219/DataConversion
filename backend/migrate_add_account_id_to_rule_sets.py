"""Add account_id column to validation_rule_sets table."""
import sqlite3

conn = sqlite3.connect('fsm_workbench.db')
c = conn.cursor()

# Check if column already exists
c.execute("PRAGMA table_info(validation_rule_sets)")
columns = [col[1] for col in c.fetchall()]

if 'account_id' not in columns:
    c.execute("ALTER TABLE validation_rule_sets ADD COLUMN account_id INTEGER")
    conn.commit()
    print("Added account_id column to validation_rule_sets")
else:
    print("account_id column already exists")

conn.close()
