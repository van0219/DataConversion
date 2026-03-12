"""
Delete incorrect "Account Must Exist" rule that references GeneralLedgerChartAccount.
This is a custom rule (not schema-generated) with wrong field/reference names.
"""

from app.core.database import SessionLocal
from app.models.rule import ValidationRuleTemplate

def delete_incorrect_account_rule():
    db = SessionLocal()
    
    try:
        # Find the incorrect rule
        incorrect_rule = db.query(ValidationRuleTemplate).filter(
            ValidationRuleTemplate.business_class == 'GLTransactionInterface',
            ValidationRuleTemplate.rule_type == 'REFERENCE_EXISTS',
            ValidationRuleTemplate.field_name == 'GeneralLedgerChartAccount',
            ValidationRuleTemplate.reference_business_class == 'GeneralLedgerChartAccount'
        ).first()
        
        if not incorrect_rule:
            print("ℹ️  Rule not found. It may have already been deleted.")
            return
        
        print("Found incorrect rule:")
        print("=" * 80)
        print(f"ID: {incorrect_rule.id}")
        print(f"Name: {incorrect_rule.name}")
        print(f"Business Class: {incorrect_rule.business_class}")
        print(f"Type: {incorrect_rule.rule_type}")
        print(f"Field: {incorrect_rule.field_name}")
        print(f"Reference: {incorrect_rule.reference_business_class}")
        print(f"Error Message: {incorrect_rule.error_message}")
        print(f"Source: {incorrect_rule.source}")
        print(f"Rule Set ID: {incorrect_rule.rule_set_id}")
        print()
        
        # Confirm it's a custom rule (not schema-generated)
        if incorrect_rule.source == 'schema':
            print("⚠️  WARNING: This rule is marked as schema-generated!")
            print("   This should not happen. Proceeding with caution...")
        else:
            print("✓ Confirmed: This is a custom rule (not schema-generated)")
        
        print()
        
        # Delete the rule
        db.delete(incorrect_rule)
        db.commit()
        
        print("=" * 80)
        print("✅ SUCCESS: Incorrect rule deleted")
        print()
        print("The rule with these incorrect values has been removed:")
        print("  - Field: GeneralLedgerChartAccount (should be Account)")
        print("  - Reference: GeneralLedgerChartAccount (should be Account)")
        print()
        print("You can now create a correct rule if needed:")
        print("  - Field: Account")
        print("  - Reference: Account")
        print("  - Error: Account '{value}' does not exist in FSM")
        
    except Exception as e:
        db.rollback()
        print(f"❌ Error: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    delete_incorrect_account_rule()
