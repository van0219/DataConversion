import csv
import random

HEADERS = [
    "FinanceEnterpriseGroup",
    "GLTransactionInterface.RunGroup",
    "GLTransactionInterface.SequenceNumber",
    "Status",
    "AccountingEntity",
    "OrganizationCode",
    "ToAccountingEntity",
    "AccountCode",
    "PostingDate",
    "TransactionAmount",
    "Description"
]

TOTAL_ROWS = 100_000
ERROR_ROWS = sorted(random.sample(range(1, TOTAL_ROWS + 1), 20))

# Error types to inject — spread across different fields
ERROR_TYPES = [
    ("AccountCode",       "101v03"),          # invalid reference
    ("TransactionAmount", "325xfg0.00"),       # invalid pattern
    ("TransactionAmount", "ABC"),              # invalid pattern
    ("PostingDate",       "08/25/2025"),       # wrong date format
    ("AccountCode",       "BADCODE"),          # invalid reference
    ("TransactionAmount", "-999xyz"),          # invalid pattern
    ("PostingDate",       "2025-01-15"),       # wrong date format
    ("AccountCode",       "???"),              # invalid reference
    ("TransactionAmount", "1,500.00"),         # comma in amount
    ("PostingDate",       "99999999"),         # invalid date
    ("AccountCode",       ""),                 # empty required field
    ("TransactionAmount", "0.00x"),            # invalid pattern
    ("PostingDate",       "20260230"),         # invalid date (Feb 30)
    ("AccountCode",       "10103!"),           # special char
    ("TransactionAmount", "1e5"),              # scientific notation
    ("PostingDate",       "01-01-2026"),       # wrong format
    ("AccountCode",       "NULL"),             # literal NULL
    ("TransactionAmount", ""),                 # empty required field
    ("PostingDate",       "20261301"),         # invalid month 13
    ("AccountCode",       "10103 "),           # trailing space (subtle)
]

error_map = {row: ERROR_TYPES[i] for i, row in enumerate(ERROR_ROWS)}

ACCOUNT_CODES = ["10103", "10200", "20100", "30050", "40010", "50200"]
AMOUNTS = ["457.66", "797.93", "1250.00", "88.50", "3400.75", "99.99", "2000.00"]
DATES = ["20260101", "20260201", "20260301", "20260312", "20260401"]
ENTITIES = ["10", "20", "30"]

output_path = "Import_Files/GLTransactionInterface_100K.csv"

with open(output_path, "w", newline="", encoding="utf-8-sig") as f:
    writer = csv.DictWriter(f, fieldnames=HEADERS)
    writer.writeheader()
    for seq in range(1, TOTAL_ROWS + 1):
        row = {
            "FinanceEnterpriseGroup": "1",
            "GLTransactionInterface.RunGroup": "LOAD_100K_TEST",
            "GLTransactionInterface.SequenceNumber": str(seq),
            "Status": "0",
            "AccountingEntity": random.choice(ENTITIES),
            "OrganizationCode": "",
            "ToAccountingEntity": random.choice(ENTITIES),
            "AccountCode": random.choice(ACCOUNT_CODES),
            "PostingDate": random.choice(DATES),
            "TransactionAmount": random.choice(AMOUNTS),
            "Description": f"Test record {seq}"
        }
        if seq in error_map:
            field, bad_value = error_map[seq]
            row[field] = bad_value
        writer.writerow(row)

print(f"Generated {TOTAL_ROWS} rows with 20 errors at rows: {ERROR_ROWS}")
print(f"Saved to: {output_path}")
