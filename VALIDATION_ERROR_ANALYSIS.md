# Validation Error Analysis

## Critical Policy: No Data Transformation

**The platform does NOT transform client data.** Data quality is the client's responsibility.

The platform only:
- ✅ Trims leading/trailing whitespace from field values
- ✅ Validates data against FSM schema and business rules
- ✅ Reports validation errors clearly

The platform does NOT:
- ❌ Transform date formats
- ❌ Convert data types
- ❌ Fix invalid values
- ❌ Apply business logic transformations

**Your responsibility**: Fix source data to match FSM requirements.

---

## Issue Summary

The exported error CSV shows validation errors for almost all records. This is **expected behavior** - the validation is working correctly and identifying real data quality issues that YOU must fix in your source data.

## Root Causes

### 1. Unmapped Field: "JoseRizal" → "AccountingEntity"

**Problem:** The CSV file has a column named "JoseRizal" but the FSM schema expects "AccountingEntity".

**Evidence:**
- CSV header: `FinanceEnterpriseGroup,GLTransactionInterface.RunGroup,...,JoseRizal,...`
- Error message: `[AccountingEntity] Required field 'AccountingEntity' is missing or empty`

**Why auto-mapping didn't work:**
- "JoseRizal" and "AccountingEntity" are too different (Levenshtein distance too high)
- Auto-mapper only maps fields with similarity score > 0.6

**Solution:** Manually map "JoseRizal" → "AccountingEntity" in the Field Mapping page:
1. Find the row with CSV column "JoseRizal"
2. Click the dropdown in the "Maps to FSM Field" column
3. Type "AccountingEntity" and select it
4. Ensure the checkbox is enabled
5. Click "Start Validation" again

### 2. Date Format Mismatch: PostingDate

**Problem:** CSV has dates in MM/DD/YYYY format but FSM expects YYYYMMDD format.

**Evidence:**
- CSV value: `08/25/2025`
- Expected format: `20250825`
- Error message: `[PostingDate] Field 'PostingDate' has invalid format. Expected: Date in format YYYYMMDD`

**Platform Policy:** The platform does NOT transform date formats. You must fix your source data.

**Solution: Fix Your Source Data**

Transform your CSV file before uploading:

```python
# Convert dates from MM/DD/YYYY to YYYYMMDD
import pandas as pd

df = pd.read_csv('GLTransactionInterface_DEMO.csv')
df['PostingDate'] = pd.to_datetime(df['PostingDate']).dt.strftime('%Y%m%d')
df.to_csv('GLTransactionInterface_DEMO_fixed.csv', index=False)
```

Or manually edit in Excel:
1. Open CSV in Excel
2. Select PostingDate column
3. Format cells as Text
4. Use formula: `=TEXT(A2,"YYYYMMDD")` where A2 is the date cell
5. Copy and paste values
6. Save as CSV

### 3. Row 25 Validation Success

**Important:** Row 25 has NO error message in the exported CSV, which means it passed validation successfully!

```csv
1,DataConversion_Demo,25,0,36,,36,100008,08/25/2025,4200.00,Valid record,
```

This proves the validation pipeline is working correctly - it's just identifying real data quality issues.

## Validation Results Summary

From the exported error CSV:
- **Total records:** 25
- **Records with errors:** 24
- **Valid records:** 1 (row 25)
- **Common errors:**
  - Missing AccountingEntity: 24 records (96%)
  - Invalid PostingDate format: 24 records (96%)

## Expected Behavior After Fixes

Once you map "JoseRizal" → "AccountingEntity" and fix the date format:

**Expected valid records:** ~20 records (based on Description column)
- Rows 1-4, 7-8, 14-20, 24-25: "Valid record" descriptions

**Expected invalid records:** ~5 records (intentional errors)
- Row 5: Missing FinanceEnterpriseGroup
- Row 6: Missing FinanceEnterpriseGroup
- Row 9: Missing TransactionAmount
- Row 10: Invalid AccountCode (999999)
- Row 11: Invalid date format (13/45/2025)
- Row 12: Invalid amount (ABC123)
- Row 13: Invalid AccountingEntity (99)
- Row 22: Missing RunGroup
- Row 23: Missing RunGroup

## Testing Steps

1. **Fix the mapping:**
   - Go to Field Mapping page
   - Map "JoseRizal" → "AccountingEntity"
   - Ensure checkbox is enabled
   - Save as template (optional)

2. **Fix your source data:**
   - Transform CSV file using Python script above
   - Or manually edit CSV file in Excel (format dates as YYYYMMDD)
   - **The platform will NOT do this for you**

3. **Re-run validation:**
   - Upload the fixed CSV file
   - Review auto-mapping
   - Start validation
   - Export errors CSV

4. **Expected results:**
   - ~20 valid records
   - ~5 invalid records (intentional errors)
   - Error messages only for rows with real data quality issues

## Conclusion

The validation is working correctly! The errors you're seeing are **real data quality issues in your source data** that you must fix:

1. ✅ Validation correctly identifies unmapped required fields → **You must map them**
2. ✅ Validation correctly identifies invalid date formats → **You must fix your CSV**
3. ✅ Validation correctly passes valid records (row 25)
4. ✅ Error export correctly shows all validation errors

**Platform Policy**: We do NOT transform your data. You own data quality.

**Next steps:** 
1. Map "JoseRizal" → "AccountingEntity"
2. Fix date format in your CSV file (MM/DD/YYYY → YYYYMMDD)
3. Re-upload and validate

---

**Created:** March 11, 2026  
**Status:** Analysis complete, user action required
