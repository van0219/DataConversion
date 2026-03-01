"""
Quick validation test to verify schema validator and rule executor work correctly
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

from app.services.schema_validator import SchemaValidator, ValidationError
from app.services.rule_executor import RuleExecutor

def test_schema_validator():
    """Test schema validation logic"""
    print("\n" + "="*80)
    print("TESTING SCHEMA VALIDATOR")
    print("="*80 + "\n")
    
    # Mock schema
    schema = {
        "fields": [
            {
                "name": "FinanceEnterpriseGroup",
                "type": "string",
                "required": True,
                "maxLength": 50
            },
            {
                "name": "AccountingEntity",
                "type": "string",
                "required": True,
                "maxLength": 50
            },
            {
                "name": "TransactionAmount",
                "type": "number",
                "required": True
            },
            {
                "name": "PostingDate",
                "type": "string",
                "format": "date",
                "required": True
            },
            {
                "name": "Status",
                "type": "string",
                "enum": ["0", "1", "2"],
                "required": False
            }
        ]
    }
    
    # Test Case 1: Valid record
    print("Test 1: Valid Record")
    print("-" * 40)
    record1 = {
        "FinanceEnterpriseGroup": "1",
        "AccountingEntity": "10",
        "TransactionAmount": "1234.56",
        "PostingDate": "08/25/2025",
        "Status": "0"
    }
    
    normalized, errors = SchemaValidator.validate_record(record1, schema, 1)
    
    if errors:
        print(f"❌ FAILED: Expected no errors, got {len(errors)}")
        for error in errors:
            print(f"   - {error.error_message}")
        return False
    else:
        print(f"✅ PASSED: No validation errors")
        print(f"   Normalized date: {normalized.get('PostingDate')}")
    
    # Test Case 2: Missing required field
    print("\nTest 2: Missing Required Field")
    print("-" * 40)
    record2 = {
        "FinanceEnterpriseGroup": "1",
        "AccountingEntity": "10",
        # Missing TransactionAmount
        "PostingDate": "08/25/2025"
    }
    
    normalized, errors = SchemaValidator.validate_record(record2, schema, 2)
    
    if not errors:
        print(f"❌ FAILED: Expected error for missing required field")
        return False
    
    required_error = next((e for e in errors if e.error_type == "required"), None)
    if required_error:
        print(f"✅ PASSED: Caught missing required field")
        print(f"   Error: {required_error.error_message}")
    else:
        print(f"❌ FAILED: Wrong error type")
        return False
    
    # Test Case 3: Invalid type
    print("\nTest 3: Invalid Type")
    print("-" * 40)
    record3 = {
        "FinanceEnterpriseGroup": "1",
        "AccountingEntity": "10",
        "TransactionAmount": "ABC123",  # Invalid number
        "PostingDate": "08/25/2025"
    }
    
    normalized, errors = SchemaValidator.validate_record(record3, schema, 3)
    
    if not errors:
        print(f"❌ FAILED: Expected error for invalid type")
        return False
    
    type_error = next((e for e in errors if e.error_type == "type"), None)
    if type_error:
        print(f"✅ PASSED: Caught invalid type")
        print(f"   Error: {type_error.error_message}")
    else:
        print(f"❌ FAILED: Wrong error type")
        return False
    
    # Test Case 4: Invalid enum
    print("\nTest 4: Invalid Enum Value")
    print("-" * 40)
    record4 = {
        "FinanceEnterpriseGroup": "1",
        "AccountingEntity": "10",
        "TransactionAmount": "1234.56",
        "PostingDate": "08/25/2025",
        "Status": "9"  # Invalid enum value
    }
    
    normalized, errors = SchemaValidator.validate_record(record4, schema, 4)
    
    if not errors:
        print(f"❌ FAILED: Expected error for invalid enum")
        return False
    
    enum_error = next((e for e in errors if e.error_type == "enum"), None)
    if enum_error:
        print(f"✅ PASSED: Caught invalid enum value")
        print(f"   Error: {enum_error.error_message}")
    else:
        print(f"❌ FAILED: Wrong error type")
        return False
    
    # Test Case 5: Invalid date format
    print("\nTest 5: Invalid Date Format")
    print("-" * 40)
    record5 = {
        "FinanceEnterpriseGroup": "1",
        "AccountingEntity": "10",
        "TransactionAmount": "1234.56",
        "PostingDate": "13/45/2025"  # Invalid date
    }
    
    normalized, errors = SchemaValidator.validate_record(record5, schema, 5)
    
    if not errors:
        print(f"❌ FAILED: Expected error for invalid date")
        return False
    
    format_error = next((e for e in errors if e.error_type == "format"), None)
    if format_error:
        print(f"✅ PASSED: Caught invalid date format")
        print(f"   Error: {format_error.error_message}")
    else:
        print(f"❌ FAILED: Wrong error type")
        return False
    
    # Test Case 6: Length validation
    print("\nTest 6: Length Validation")
    print("-" * 40)
    record6 = {
        "FinanceEnterpriseGroup": "1" * 100,  # Exceeds maxLength
        "AccountingEntity": "10",
        "TransactionAmount": "1234.56",
        "PostingDate": "08/25/2025"
    }
    
    normalized, errors = SchemaValidator.validate_record(record6, schema, 6)
    
    if not errors:
        print(f"❌ FAILED: Expected error for length violation")
        return False
    
    length_error = next((e for e in errors if e.error_type == "length"), None)
    if length_error:
        print(f"✅ PASSED: Caught length violation")
        print(f"   Error: {length_error.error_message}")
    else:
        print(f"❌ FAILED: Wrong error type")
        return False
    
    print("\n" + "="*80)
    print("✅ ALL SCHEMA VALIDATOR TESTS PASSED")
    print("="*80 + "\n")
    
    return True

def test_rule_executor():
    """Test rule executor logic"""
    print("\n" + "="*80)
    print("TESTING RULE EXECUTOR")
    print("="*80 + "\n")
    
    # Note: Rule executor requires database connection for REFERENCE_EXISTS
    # We'll just verify the structure is correct
    
    print("Test 1: Rule Executor Structure")
    print("-" * 40)
    
    # Verify REQUIRED_OVERRIDE works without DB
    from unittest.mock import Mock
    
    db_mock = Mock()
    executor = RuleExecutor(db_mock, account_id=1)
    
    rule = {
        "rule_type": "REQUIRED_OVERRIDE",
        "field_name": "TestField",
        "error_message": "Custom required message"
    }
    
    record = {"TestField": ""}  # Empty value
    
    error = executor._validate_required_override(
        "TestField",
        "",
        "Custom required message",
        1
    )
    
    if error:
        print(f"✅ PASSED: REQUIRED_OVERRIDE works")
        print(f"   Error: {error.error_message}")
    else:
        print(f"❌ FAILED: REQUIRED_OVERRIDE should return error for empty value")
        return False
    
    # Test with valid value
    error = executor._validate_required_override(
        "TestField",
        "ValidValue",
        "Custom required message",
        1
    )
    
    if not error:
        print(f"✅ PASSED: REQUIRED_OVERRIDE passes for valid value")
    else:
        print(f"❌ FAILED: REQUIRED_OVERRIDE should not error for valid value")
        return False
    
    print("\n" + "="*80)
    print("✅ ALL RULE EXECUTOR TESTS PASSED")
    print("="*80 + "\n")
    
    return True

def main():
    """Run all validation tests"""
    try:
        success = True
        
        # Test schema validator
        if not test_schema_validator():
            success = False
        
        # Test rule executor
        if not test_rule_executor():
            success = False
        
        if success:
            print("\n" + "="*80)
            print("🎉 ALL VALIDATION TESTS PASSED!")
            print("="*80 + "\n")
            return 0
        else:
            print("\n" + "="*80)
            print("❌ SOME TESTS FAILED")
            print("="*80 + "\n")
            return 1
            
    except Exception as e:
        print(f"\n❌ TEST SUITE FAILED: {str(e)}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    sys.exit(main())
