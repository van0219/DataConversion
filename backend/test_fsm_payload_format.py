"""
Test FSM batch API payload format
"""
import json

# Sample record from CSV
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

print("=" * 80)
print("CURRENT PAYLOAD FORMAT (What we're sending)")
print("=" * 80)

# Current format (what the fixed code sends)
current_payload = {
    "_records": [
        {"_fields": sample_record}
    ]
}

print(json.dumps(current_payload, indent=2))

print("\n" + "=" * 80)
print("EXPECTED FORMAT (From swagger file)")
print("=" * 80)
print("""
According to swagger:
- Endpoint: POST /api/classes/GLTransactionInterface/actions/CreateUnreleased/batch
- Schema: Raw_JSONBatchRequest
  {
    "_records": [
      {
        "_fields": {
          "field1": "value1",
          "field2": "value2"
        }
      }
    ]
  }

This matches what we're sending!
""")

print("\n" + "=" * 80)
print("ALTERNATIVE: Single record endpoint (non-batch)")
print("=" * 80)
print("""
Endpoint: POST /api/classes/GLTransactionInterface/actions/CreateUnreleased
Schema: createMinimumFieldsJSON or allFields

Payload (direct fields, no wrapper):
""")

single_payload = sample_record
print(json.dumps(single_payload, indent=2))

print("\n" + "=" * 80)
print("RECOMMENDATION")
print("=" * 80)
print("""
The batch endpoint format looks correct. The 400 error might be due to:
1. Missing required fields
2. Invalid field values
3. Field name format issues

Let's check the required fields from swagger:
- FinanceEnterpriseGroup ✓
- GLTransactionInterface.RunGroup ✓
- GLTransactionInterface.SequenceNumber ✓
- AccountingEntity ✓
- AccountCode ✓
- PostingDate ✓

All required fields are present!

Possible issues:
1. Empty OrganizationCode field (should we remove empty fields?)
2. Field value format (Status="0" vs Status=0)
3. FSM might not accept batch endpoint for CreateUnreleased

Let's try removing empty fields and see if that helps.
""")
