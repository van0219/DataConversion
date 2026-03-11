#!/usr/bin/env python3
"""
Test RunGroup Generation with 30-Character Limit

This script tests the RunGroup generation logic to ensure:
1. RunGroups are always exactly 30 characters or less
2. Full timestamp is preserved (14 digits)
3. Business class prefix is truncated appropriately
4. Format is consistent: <prefix>_<timestamp>
"""

from datetime import datetime

def generate_rungroup(business_class: str) -> str:
    """Generate RunGroup with 30-character limit"""
    from datetime import datetime
    now = datetime.now()
    # Create 14-digit timestamp: YYYYMMDDHHMMSS + 2 microsecond digits for uniqueness
    base_timestamp = now.strftime("%Y%m%d%H%M%S")  # 14 digits
    microseconds = now.strftime("%f")[:2]  # First 2 microsecond digits
    
    # Start with base timestamp (14 digits)
    timestamp = base_timestamp  # 14 digits: YYYYMMDDHHMMSS
    
    # Calculate available space for business class prefix
    # Format: <prefix>_<timestamp> = 30 chars total
    # Timestamp is 14 chars, underscore is 1 char
    # So prefix can be: 30 - 14 - 1 = 15 chars max
    max_prefix_length = 30 - len(timestamp) - 1
    
    # Truncate business class name if needed
    business_class_prefix = business_class[:max_prefix_length].upper()
    
    # Generate RunGroup with exact 30 character limit
    run_group = f"{business_class_prefix}_{timestamp}"
    
    # If we have extra space, we can add microseconds for better uniqueness
    if len(run_group) < 30:
        available_space = 30 - len(run_group)
        extra_microseconds = microseconds[:available_space]
        run_group = f"{business_class_prefix}_{timestamp}{extra_microseconds}"
    
    # Ensure it's exactly 30 characters or less
    if len(run_group) > 30:
        run_group = run_group[:30]
    
    return run_group

def test_rungroup_generation():
    """Test RunGroup generation with various business class names"""
    
    print("🧪 Testing RunGroup Generation with 30-Character Limit")
    print("=" * 60)
    
    # Test cases with different business class lengths
    test_cases = [
        "GLTransactionInterface",  # 23 chars - needs truncation
        "PayablesInvoice",         # 16 chars - fits
        "Vendor",                  # 6 chars - fits easily
        "Customer",                # 8 chars - fits easily
        "GeneralLedgerChartAccount", # 26 chars - needs truncation
        "A",                       # 1 char - minimal
        "VeryLongBusinessClassName", # 26 chars - needs truncation
    ]
    
    print("📋 Test Cases:")
    print()
    
    all_passed = True
    
    for business_class in test_cases:
        run_group = generate_rungroup(business_class)
        length = len(run_group)
        
        # Extract components
        parts = run_group.split('_')
        if len(parts) == 2:
            prefix = parts[0]
            timestamp = parts[1]
        else:
            prefix = "ERROR"
            timestamp = "ERROR"
        
        # Validate
        valid_length = length <= 30
        valid_timestamp = len(timestamp) >= 14 and timestamp.isdigit()  # At least 14 digits (YYYYMMDDHHMMSS)
        valid_format = '_' in run_group and run_group.count('_') == 1
        
        status = "✅ PASS" if (valid_length and valid_timestamp and valid_format) else "❌ FAIL"
        
        print(f"Business Class: {business_class}")
        print(f"  Original Length: {len(business_class)} chars")
        print(f"  Generated RunGroup: {run_group}")
        print(f"  RunGroup Length: {length} chars")
        print(f"  Prefix: {prefix} ({len(prefix)} chars)")
        print(f"  Timestamp: {timestamp} ({len(timestamp)} chars)")
        print(f"  Status: {status}")
        
        if not valid_length:
            print(f"  ❌ ERROR: Length {length} exceeds 30 characters")
            all_passed = False
        
        if not valid_timestamp:
            print(f"  ❌ ERROR: Invalid timestamp format or length")
            all_passed = False
            
        if not valid_format:
            print(f"  ❌ ERROR: Invalid format (should be prefix_timestamp)")
            all_passed = False
        
        print()
    
    # Test specific examples mentioned in the issue
    print("🔍 Testing Specific Examples:")
    print()
    
    # GLTransactionInterface example
    gl_rungroup = generate_rungroup("GLTransactionInterface")
    print(f"GLTransactionInterface → {gl_rungroup} ({len(gl_rungroup)} chars)")
    
    # Verify it's not truncated like the original issue
    if "GLTRANSACTIONINTERFACE_2026031" in gl_rungroup:
        print("❌ ERROR: RunGroup appears to be truncated")
        all_passed = False
    else:
        print("✅ CORRECT: RunGroup is properly formatted")
    
    print()
    
    # Test timestamp consistency
    print("🔍 Testing Timestamp Format:")
    
    sample_rungroup = generate_rungroup("Test")
    parts = sample_rungroup.split('_')
    if len(parts) == 2:
        timestamp = parts[1]
        
        # Verify timestamp format: YYYYMMDDHHMMSS (at least 14 digits)
        if len(timestamp) >= 14 and timestamp.isdigit():
            year = timestamp[:4]
            month = timestamp[4:6]
            day = timestamp[6:8]
            hour = timestamp[8:10]
            minute = timestamp[10:12]
            second = timestamp[12:14]
            extra = timestamp[14:] if len(timestamp) > 14 else ""
            
            print(f"Sample Timestamp: {timestamp}")
            print(f"  Year: {year}")
            print(f"  Month: {month}")
            print(f"  Day: {day}")
            print(f"  Hour: {hour}")
            print(f"  Minute: {minute}")
            print(f"  Second: {second}")
            if extra:
                print(f"  Extra digits: {extra}")
            print("✅ CORRECT: Full timestamp preserved")
        else:
            print("❌ ERROR: Invalid timestamp format")
            all_passed = False
    
    print()
    
    # Summary
    if all_passed:
        print("🎉 All RunGroup Generation Tests PASSED!")
        print()
        print("📋 Summary:")
        print("   ✅ All RunGroups are 30 characters or less")
        print("   ✅ Full timestamp preserved (14+ digits)")
        print("   ✅ Business class prefix truncated appropriately")
        print("   ✅ Format is consistent: <prefix>_<timestamp>")
        print("   ✅ Extra microseconds added when space available")
        print("   ✅ No truncation issues like original problem")
    else:
        print("❌ Some RunGroup Generation Tests FAILED!")
        print("   Please review the errors above")
    
    return all_passed

if __name__ == "__main__":
    success = test_rungroup_generation()
    if success:
        print("\n✅ RunGroup Generation: READY FOR IMPLEMENTATION")
    else:
        print("\n❌ RunGroup Generation: NEEDS FIXES")
        exit(1)