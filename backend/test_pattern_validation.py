#!/usr/bin/env python3
"""
Test PATTERN_MATCH validation rule directly.
"""

import asyncio
from app.services.rule_executor import RuleExecutor
from app.core.database import get_db

async def test_pattern_match_rule():
    """Test the PATTERN_MATCH rule with TransactionAmount"""
    
    db = next(get_db())
    executor = RuleExecutor(db, account_id=1)
    
    # Create a mock rule (like the one in your database)
    rule = {
        "rule_type": "PATTERN_MATCH",
        "field_name": "TransactionAmount",
        "condition_expression": r"^\d+\.\d{2}$",
        "pattern": r"^\d+\.\d{2}$",
        "error_message": "Transaction Amount must match the required format."
    }
    
    # Test cases
    test_cases = [
        {"value": "4200.0012", "should_fail": True, "description": "4 decimal places"},
        {"value": "4200.00", "should_fail": False, "description": "2 decimal places"},
        {"value": "123.45", "should_fail": False, "description": "normal amount"},
        {"value": "0.99", "should_fail": False, "description": "small amount"},
        {"value": "123.4", "should_fail": True, "description": "1 decimal place"},
        {"value": "123", "should_fail": True, "description": "no decimal places"},
    ]
    
    print("=== PATTERN_MATCH Rule Test ===")
    print(f"Pattern: {rule['condition_expression']}")
    print()
    
    for i, test_case in enumerate(test_cases):
        # Create a mock record
        record = {"TransactionAmount": test_case["value"]}
        
        # Execute the rule
        result = await executor.execute_rule(rule, record, row_number=i+1)
        
        # Check result
        failed = result is not None
        expected_to_fail = test_case["should_fail"]
        
        status = "✅ PASS" if failed == expected_to_fail else "❌ FAIL"
        
        print(f"{test_case['value']:12} ({test_case['description']:20}) → {status}")
        if failed:
            print(f"             Error: {result.error_message}")
        print()
    
    db.close()

if __name__ == "__main__":
    asyncio.run(test_pattern_match_rule())