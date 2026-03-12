"""
Direct test of validation to see the actual error
"""
import sys
import traceback
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.modules.validation.service import ValidationService

# Test with job ID 152 (most recent failed job)
job_id = 152
account_id = 1  # Assuming account ID 1
business_class = "GLTransactionInterface"

# Sample mapping (you'll need to adjust this based on your actual mapping)
mapping = {
    "Sequence": {"fsm_field": "SequenceNumber", "confidence": "exact", "score": 0.0},
    "Amount": {"fsm_field": "TransactionAmount", "confidence": "exact", "score": 0.0}
}

print(f"Testing validation for job {job_id}...")
print(f"Business class: {business_class}")
print(f"Account ID: {account_id}")

db = SessionLocal()
try:
    print("\nStarting validation...")
    ValidationService.start_validation(
        db=db,
        account_id=account_id,
        job_id=job_id,
        business_class=business_class,
        mapping=mapping,
        enable_rules=True,
        selected_rule_set_id=None
    )
    print("\n✅ Validation completed successfully!")
    
except Exception as e:
    print(f"\n❌ Validation failed with error:")
    print(f"Error type: {type(e).__name__}")
    print(f"Error message: {str(e)}")
    print(f"\nFull traceback:")
    traceback.print_exc()
    
finally:
    db.close()
