"""
Show the corrected API request format with message: BatchImport
"""
import json

# Sample record
sample_record = {
    "FinanceEnterpriseGroup": "1",
    "GLTransactionInterface.RunGroup": "DataConversion_Demo_Correct",
    "GLTransactionInterface.SequenceNumber": "1",
    "Status": "0",
    "AccountingEntity": "10",
    "ToAccountingEntity": "10",
    "AccountCode": "100008",
    "PostingDate": "20250825",
    "TransactionAmount": "457.66",
    "Description": "Valid record"
}

# Format with message: BatchImport
formatted_payload = {
    "_records": [
        {
            "_fields": sample_record,
            "message": "BatchImport"
        }
    ]
}

print("=" * 80)
print("CORRECTED PAYLOAD FORMAT")
print("=" * 80)
print()
print(json.dumps(formatted_payload, indent=2))
print()
print("=" * 80)
print("KEY DIFFERENCE:")
print("=" * 80)
print('Each record now has BOTH "_fields" AND "message": "BatchImport"')
