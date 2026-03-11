"""
Show the exact API request being made to FSM
"""
import json

# Sample record
sample_record = {
    "FinanceEnterpriseGroup": "1",
    "GLTransactionInterface.RunGroup": "DataConversion_Demo_Correct",
    "GLTransactionInterface.SequenceNumber": "1",
    "Status": "0",
    "AccountingEntity": "10",
    "OrganizationCode": "",
    "ToAccountingEntity": "10",
    "AccountCode": "100008",
    "PostingDate": "20250825",
    "TransactionAmount": "457.66",
    "Description": "Valid record"
}

# Remove empty fields (as the code does)
cleaned_record = {k: v for k, v in sample_record.items() if v != ""}

print("=" * 80)
print("EXACT API REQUEST TO FSM")
print("=" * 80)
print()
print("URL:")
print("  POST https://tamics10-ax1.inforcloudsuite.com/TAMICS10_AX1/api/classes/GLTransactionInterface/actions/CreateUnreleased")
print()
print("Headers:")
print("  Authorization: Bearer <token>")
print("  Content-Type: application/json")
print()
print("Body (JSON):")
print(json.dumps(cleaned_record, indent=2))
print()
print("=" * 80)
print("CLEANED RECORD (empty fields removed):")
print("=" * 80)
print(json.dumps(cleaned_record, indent=2))
print()
print("Fields removed: OrganizationCode (was empty string)")
