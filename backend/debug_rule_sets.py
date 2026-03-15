#!/usr/bin/env python3
"""
Debug script to test rule sets API without authentication.
"""

from app.core.database import get_db
from app.modules.rules.rule_set_service import RuleSetService

def debug_rule_sets():
    """Debug rule sets filtering"""
    
    # Get database session
    db = next(get_db())
    
    print("=== Rule Sets Debug ===")
    print()
    
    # Test 1: Get all rule sets (no filter)
    print("1. All rule sets (no filter):")
    all_rule_sets = RuleSetService.get_all_rule_sets(db, None)
    for rs in all_rule_sets:
        print(f"   ID: {rs.id}, Name: {rs.name}, Business Class: {rs.business_class}, Is Common: {rs.is_common}")
    
    print()
    
    # Test 2: Filter by GLTransactionInterface
    print("2. GLTransactionInterface rule sets:")
    gl_rule_sets = RuleSetService.get_all_rule_sets(db, "GLTransactionInterface")
    for rs in gl_rule_sets:
        print(f"   ID: {rs.id}, Name: {rs.name}, Business Class: {rs.business_class}, Is Common: {rs.is_common}")
    
    print()
    
    # Test 3: Filter by PurchaseOrderImport
    print("3. PurchaseOrderImport rule sets:")
    po_rule_sets = RuleSetService.get_all_rule_sets(db, "PurchaseOrderImport")
    for rs in po_rule_sets:
        print(f"   ID: {rs.id}, Name: {rs.name}, Business Class: {rs.business_class}, Is Common: {rs.is_common}")
    
    print()
    
    # Test 4: Check different empty values
    print("4. Testing different empty values:")
    
    print("   4a. Empty string (''):")
    empty_rule_sets = RuleSetService.get_all_rule_sets(db, "")
    for rs in empty_rule_sets:
        print(f"      ID: {rs.id}, Name: {rs.name}, Business Class: {rs.business_class}")
    if not empty_rule_sets:
        print("      (none)")
    
    print("   4b. None:")
    none_rule_sets = RuleSetService.get_all_rule_sets(db, None)
    for rs in none_rule_sets:
        print(f"      ID: {rs.id}, Name: {rs.name}, Business Class: {rs.business_class}")
    
    print("   4c. Whitespace string ('   '):")
    whitespace_rule_sets = RuleSetService.get_all_rule_sets(db, "   ")
    for rs in whitespace_rule_sets:
        print(f"      ID: {rs.id}, Name: {rs.name}, Business Class: {rs.business_class}")
    if not whitespace_rule_sets:
        print("      (none)")
    
    db.close()

if __name__ == "__main__":
    debug_rule_sets()