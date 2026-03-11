# Steering File Update: Data Transformation Policy

## Update Summary

**Date:** March 11, 2026  
**Type:** Critical Policy Addition  
**Files Updated:** 2 files

## Changes Made

### 1. FSM_Conversion_Workbench_Architecture.md

**Added:** Pattern #9 - "No Data Transformation - Client Responsibility (CRITICAL POLICY)"

**Location:** After Pattern #8 (Local Swagger Files for Schema), before Pattern #10 (Setup Business Classes Configuration)

**Content:** Comprehensive policy documentation covering:
- What the platform DOES (trim whitespace, validate, report errors, allow mapping)
- What the platform DOES NOT DO (transform dates, convert types, fix values, apply business logic)
- Code examples showing correct vs. incorrect approaches
- Rationale for the policy
- User workflow expectations
- Example scenario (date format validation)

**Renumbered:** Pattern "Mapping Format Consistency" from #10 to #11

### 2. VALIDATION_ERROR_ANALYSIS.md

**Updated:** Three sections to emphasize client responsibility

**Section 1: Added Critical Policy Header**
- Clearly states platform does NOT transform data
- Lists what platform does and doesn't do
- Emphasizes client responsibility

**Section 2: Updated Date Format Solution**
- Removed "Option B: Add date format transformation to the platform"
- Emphasized "Platform Policy: The platform does NOT transform date formats"
- Added manual Excel instructions as alternative to Python script
- Made it clear: "You must fix your source data"

**Section 3: Updated Conclusion**
- Added "Platform Policy: We do NOT transform your data. You own data quality."
- Emphasized client must fix their CSV file
- Removed any suggestion that platform might transform data

## Policy Rationale

### Why No Data Transformation?

1. **Data Quality Visibility**: Transformations hide data quality issues from clients
2. **Client Ownership**: Clients must see and fix their source data problems
3. **Validation Integrity**: Platform validates "as-is" to expose real problems
4. **Error Prevention**: Transformations can introduce errors or data loss
5. **Clear Responsibility**: Client owns data quality, platform validates it

### What This Means for Users

**User Workflow:**
1. Upload CSV file
2. Map fields (CSV columns → FSM fields)
3. Run validation
4. Review validation errors
5. **Fix source data** (client responsibility)
6. Re-upload and validate
7. Load clean data to FSM

**User Expectations:**
- Platform will report ALL data quality issues
- User must fix their source data or source system
- Platform will NOT auto-fix or transform data
- Validation errors are actionable feedback, not platform failures

## Implementation Status

### Current Implementation

**Already Implemented:**
- ✅ Whitespace trimming (`.strip()` on string values)
- ✅ Schema validation (type, format, required, enum, pattern)
- ✅ Business rule validation (REFERENCE_EXISTS, REQUIRED_OVERRIDE)
- ✅ Clear error messages with field names and expected formats
- ✅ Error export with original data + error messages

**NOT Implemented (By Design):**
- ❌ Date format conversion
- ❌ Data type conversion
- ❌ Value transformation
- ❌ Business logic transformations
- ❌ Data cleansing beyond whitespace

### Code Verification

**Normalization Service** (`backend/app/utils/normalization.py`):
```python
def normalize_value(value: str) -> str:
    """Only trim whitespace - no other transformations"""
    if isinstance(value, str):
        return value.strip()
    return value
```

**Schema Validator** (`backend/app/services/schema_validator.py`):
- Validates data as-is (after whitespace trimming)
- Reports format errors without attempting to fix them
- Returns validation errors for client to address

## Documentation Cross-References

### Related Steering Files

**FSM_Data_Conversion_Methodology.md:**
- Should emphasize data cleansing happens BEFORE upload
- Client responsibility to prepare clean data
- Platform validates, doesn't transform

**FSM_Business_Classes_Reference.md:**
- Field format requirements are strict
- No automatic format conversion
- Client must match exact formats

### Related Documentation

**USER_GUIDE.md:**
- Should explain validation error workflow
- Emphasize client must fix source data
- Provide examples of common format issues

**DEMO_SCRIPT.md:**
- Should demonstrate validation error handling
- Show how to fix source data
- Explain platform policy

## Testing Validation

### Test Scenarios

**Scenario 1: Date Format Mismatch**
- Upload CSV with MM/DD/YYYY dates
- FSM expects YYYYMMDD
- ✅ Platform reports format error
- ❌ Platform does NOT convert format
- ✅ User fixes CSV and re-uploads

**Scenario 2: Unmapped Required Field**
- Upload CSV with "JoseRizal" column
- FSM expects "AccountingEntity"
- ✅ Platform reports missing field
- ✅ User maps "JoseRizal" → "AccountingEntity"
- ✅ Validation passes after mapping

**Scenario 3: Invalid Reference**
- Upload CSV with AccountCode = "999999"
- Reference doesn't exist in FSM
- ✅ Platform reports reference error
- ❌ Platform does NOT create reference
- ✅ User fixes CSV with valid code

## Future Considerations

### Potential Enhancements (NOT Planned)

**Data Transformation Layer:**
- Could add optional transformation rules
- User-defined transformations (date formats, value mappings)
- Would require careful design to maintain data quality visibility
- **Decision:** NOT implementing - violates core policy

**Format Auto-Detection:**
- Could detect date formats and suggest transformations
- Would still require user approval
- **Decision:** NOT implementing - adds complexity

**Data Cleansing Rules:**
- Could add configurable cleansing rules
- User-defined transformations
- **Decision:** NOT implementing - client responsibility

### Policy Review Schedule

**Quarterly Review:**
- Assess if policy is working for users
- Collect feedback on data quality issues
- Evaluate if any exceptions are needed
- Document any policy refinements

**Annual Review:**
- Comprehensive policy assessment
- User satisfaction with validation approach
- Industry best practices review
- Decision on any policy changes

## Success Metrics

### Policy Effectiveness

**Positive Indicators:**
- Users understand validation errors
- Users fix source data successfully
- Reduced support requests about "why isn't platform fixing this"
- High data quality in loaded records

**Negative Indicators:**
- Users frustrated with validation errors
- Requests for automatic transformations
- Users abandoning platform due to strict validation
- High error rates after loading

### Monitoring

**Track:**
- Validation error types and frequencies
- User feedback on validation process
- Support requests related to data quality
- Success rate of data loads after validation

## Version History

### March 11, 2026 - Initial Policy Documentation

**Added:**
- Pattern #9: No Data Transformation policy
- Critical policy header in VALIDATION_ERROR_ANALYSIS.md
- Clear client responsibility statements
- Code examples and rationale

**Rationale:**
- User asked to clarify platform does NOT transform data
- Only whitespace trimming is performed
- Client must fix source data to match FSM requirements
- Policy needed to be explicitly documented

**Impact:**
- Clear expectations for users
- Reduced confusion about validation errors
- Explicit guidance for AI assistants
- Foundation for user documentation updates

---

**Authors:**  
Van Anthony Silleza - Policy Definition  
Kiro AI Assistant - Documentation Implementation

**Status:** Complete - Policy documented and steering files updated
