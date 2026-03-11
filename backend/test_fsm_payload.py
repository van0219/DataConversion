"""
Show what payload would be sent to FSM
"""
import json

# Sample record from CSV
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

# This is what gets sent to FSM
payload = {
    "records": [sample_record],
    "triggerInterface": False
}

print("="*80)
print("PAYLOAD SENT TO FSM API")
print("="*80)
print(f"\nEndpoint: POST /api/classes/GLTransactionInterface/actions/CreateUnreleased/batch")
print(f"\nPayload:")
print(json.dumps(payload, indent=2))
print("\n" + "="*80)
print("\nPOTENTIAL ISSUES:")
print("="*80)
print("""
1. Field names with dots (GLTransactionInterface.RunGroup) might not be valid
   - FSM might expect just "RunGroup" instead of "GLTransactionInterface.RunGroup"
   
2. Empty string values (OrganizationCode: "") might cause issues
   - FSM might expect null instead of empty string
   
3. Numeric fields as strings ("1", "457.66") might need to be actual numbers
   - TransactionAmount should be 457.66 (number) not "457.66" (string)
   - SequenceNumber should be 1 (number) not "1" (string)
   
4. The endpoint might be wrong
   - Might need to be /soap/classes/... instead of /api/classes/...
   - Or might need different action name

5. Business class name might need full path
   - Might need "GLTransactionInterface" or "GL.TransactionInterface"
""")
