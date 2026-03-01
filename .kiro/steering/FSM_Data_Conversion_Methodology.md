---
inclusion: auto
name: fsm-data-conversion
description: Data conversion lifecycle, field mapping, transformation rules, validation, cleansing, test migration, reconciliation, batch loading, performance metrics. Use when planning conversions, implementing transformations, or troubleshooting migration issues.
---

# FSM Data Conversion Methodology

## Overview

Transform legacy system data into FSM-compatible format while maintaining data integrity and compliance.

**Core Phases**: Analysis → Mapping → Extraction → Transformation → Validation → Cleansing → Migration → Reconciliation

**MCP Integration**: Use FSM MCP server tools for automated conversion with natural language interface

## MCP Server Workflow

**Available Tools** (9 total):

1. `fsm_authenticate` - Verify FSM connection
2. `fsm_list_business_classes` - List available business classes
3. `fsm_get_schema` - Get field requirements for a business class
4. `fsm_validate` - Validate data without submitting
5. `fsm_convert_file` - Transform file to FSM format
6. `fsm_query` - Query existing FSM records
7. `fsm_create` - Create single record
8. `fsm_create_batch` - Bulk upload records
9. `fsm_convert_and_load` - Auto-detect and load in one step

**Standard Workflow**:

```text
1. Authenticate → 2. Get Schema → 3. Convert File → 4. Validate → 5. Load Batch
```

**Auto-Detection Features**:

- Filename patterns (e.g., `GLTransactionInterface_*.csv`)
- Column header matching
- Business class inference
- Date format conversion (MM/DD/YYYY → YYYYMMDD)
- Amount formatting (removes commas, ensures decimals)

## Conversion Phases

### Phase 1: Analysis

**Source System Analysis**:

- Document data structure, tables, relationships
- Assess data volume and quality
- Identify business rules and constraints

**Target System Analysis**:

- Review FSM business class requirements
- Document required vs optional fields
- Understand field types, formats, validation rules

**Gap Analysis**:

- Compare source to FSM fields
- Identify missing/extra fields
- Document transformation requirements
- Create remediation plan

### Phase 2: Field Mapping

**Mapping Types**:

1. **Direct**: Source field → FSM field (1:1)
2. **Concatenation**: Multiple source → Single FSM
3. **Splitting**: Single source → Multiple FSM
4. **Transformation**: Source → Transformed FSM
5. **Lookup**: Source value → FSM reference
6. **Calculation**: Computed → FSM field

**Example Mappings**:

```text
legacy_gl.account_number → GLTransactionInterface.account
legacy_gl.debit + credit → GLTransactionInterface.amount
legacy_vendor.vendor_id → Vendor.vendorId (via lookup)
legacy_invoice.invoice_date → PayablesInvoice.invoiceDate (format conversion)
```

### Phase 3: Transformation Rules

**Case Standardization**:

```text
"ACME CORPORATION" → "Acme Corporation"
```

**Date Conversion**:

```text
"01/15/2024" → "2024-01-15"
```

**Amount Formatting**:

```text
"1,000.50" → 1000.50
```

**Null Handling**:

```text
NULL → "N/A" (strings) | 0 (numbers) | SKIP (optional)
```

**Reference Resolution**:

```text
legacy_vendor_id "V001" → fsm_vendor_id "1001" (via lookup table)
```

### Phase 4: Validation

**Pre-Validation Checks**:

1. Completeness - All required fields populated
2. Format - Data matches expected format
3. Type - Correct data types
4. Range - Values within acceptable ranges
5. Uniqueness - No duplicates
6. References - Valid foreign keys
7. Business Rules - Compliance with rules

**Validation by Business Class**:

**GLTransactionInterface**:

```text
Required: account, amount, date, entity, description
Rules: Debits = Credits, Account active, Date in fiscal period
```

**PayablesInvoice**:

```text
Required: invoiceNumber, vendor, amount, invoiceDate
Rules: Unique invoice number, Active vendor, Positive amount
```

**Vendor**:

```text
Required: vendorId, vendorName, vendorType
Rules: Unique vendorId, Non-empty name, Valid type code
```

### Phase 5: Data Cleansing

**Activities**:

- **Duplicate Removal**: Keep first occurrence
- **Standardization**: Normalize case, spacing, formatting
- **Null Handling**: Replace with defaults or skip
- **Outlier Detection**: Flag values outside normal ranges
- **Reference Validation**: Verify foreign keys exist

### Phase 6: Test Migration

**Scope**: 1-5% sample data

**Steps**:

1. Extract sample from source
2. Apply transformations
3. Validate against rules
4. Upload to FSM test environment
5. Verify in FSM
6. Document issues and resolutions
7. Obtain stakeholder sign-off

### Phase 7: Full Migration

**Execution Steps**:

1. Backup source and target systems
2. Extract all data
3. Apply transformations
4. Validate all data
5. Cleanse and standardize
6. Submit to FSM via API
7. Verify in FSM
8. Reconcile counts and amounts

**Monitoring**:

- Records processed/passed/failed
- Upload progress
- Error rates
- Performance metrics

### Phase 8: Reconciliation

**Verification Activities**:

1. **Count Reconciliation**: Compare record counts
2. **Amount Reconciliation**: Compare totals
3. **Sample Verification**: Spot-check records
4. **Relationship Verification**: Check data relationships
5. **Balance Verification**: Verify GL balances

**Example**:

```text
Source: 5,000 vendors, 50,000 invoices, $10M GL
FSM:    5,000 vendors ✓, 50,000 invoices ✓, $10M GL ✓
```

## Common Conversion Scenarios

### GL Transaction Conversion

**Source**: Legacy GL system → **Target**: GLTransactionInterface

**Key Challenges**:

- Balancing entries (debits = credits)
- Account mapping
- Date range validation
- Entity assignment

### Vendor Master Conversion

**Source**: Legacy vendor database → **Target**: Vendor business class

**Key Challenges**:

- Duplicate vendor detection
- Address standardization
- Contact information mapping
- Payment term mapping

### Invoice Conversion

**Source**: Legacy AP system → **Target**: PayablesInvoice + MatchInvoiceImport

**Key Challenges**:

- Invoice matching to POs
- Line item mapping
- Amount validation
- Status determination

## Best Practices

### Planning

- Start early with source analysis
- Involve business stakeholders
- Document all requirements
- Plan for contingencies
- Allocate sufficient resources

### Execution

- Test with sample data first
- Validate at each step
- Monitor progress closely
- Document issues and resolutions
- Maintain audit trail

### Quality Assurance

- Validate data completeness
- Verify data accuracy
- Check data consistency
- Reconcile totals
- Spot-check samples

### Communication

- Keep stakeholders informed
- Report progress regularly
- Escalate issues promptly
- Document decisions
- Provide training

## Key Metrics

### Success Metrics

- **Data Completeness**: % records with all required fields
- **Data Accuracy**: % records matching source
- **Validation Pass Rate**: % records passing validation
- **Migration Success Rate**: % records successfully uploaded

### Performance Metrics

- **Extraction Time**: Time to extract data
- **Transformation Time**: Time to transform data
- **Validation Time**: Time to validate data
- **Upload Time**: Time to upload to FSM

### Quality Metrics

- **Error Rate**: % records with errors
- **Duplicate Rate**: % duplicate records
- **Reconciliation Variance**: Difference between source and target

## Troubleshooting Guide

### Data Type Mismatches

**Problem**: Source data type doesn't match FSM field type
**Solution**: Convert data type during transformation
**Prevention**: Document field types during mapping

### Missing Required Fields

**Problem**: Required fields are null or empty
**Solution**: Populate with defaults or skip records
**Prevention**: Validate completeness during extraction

### Invalid References

**Problem**: Foreign key references don't exist
**Solution**: Correct references or remove records
**Prevention**: Validate references during transformation

### Duplicate Records

**Problem**: Duplicate records in source data
**Solution**: Identify and remove duplicates
**Prevention**: Implement duplicate detection

### Data Validation Failures

**Problem**: Data doesn't meet validation rules
**Solution**: Correct data or adjust rules
**Prevention**: Pre-validate data before submission

### Performance Issues

**Problem**: Conversion takes too long
**Solution**: Optimize transformation logic, use chunking
**Prevention**: Test with large datasets early

### API Errors

**Problem**: FSM API rejects data
**Solution**: Review error messages, correct data format
**Prevention**: Validate data format before submission

## Conversion Checklist

### Pre-Conversion

- [ ] Source system analyzed
- [ ] Target system analyzed
- [ ] Gap analysis completed
- [ ] Mapping defined
- [ ] Business rules documented
- [ ] Validation rules defined
- [ ] Test plan created
- [ ] Stakeholders informed

### During Conversion

- [ ] Data extracted
- [ ] Data transformed
- [ ] Data validated
- [ ] Data cleansed
- [ ] Test migration completed
- [ ] Issues resolved
- [ ] Full migration executed
- [ ] Progress monitored

### Post-Conversion

- [ ] Data reconciled
- [ ] Quality verified
- [ ] Documentation completed
- [ ] Users trained
- [ ] Lessons learned documented
- [ ] Sign-off obtained

## Practical Implementation Guide

### Real-World Results (TAMICS10_AX1 Tenant)

**Environment**: Sandbox/Test
**Authentication**: OAuth2 with service account
**Performance**: 20 GL transactions in <5 seconds end-to-end

### MCP Server Configuration

**Working Configuration**:

```json
{
  "mcpServers": {
    "fsm-dataconversion": {
      "command": "C:\\Python314\\python.exe",
      "args": ["run_server.py"],
      "cwd": "C:\\Users\\vsilleza\\OneDrive - Infor\\Desktop\\Kiro\\DataConversion",
      "env": {
        "FSM_IONAPI_FILE": "C:\\Users\\vsilleza\\OneDrive - Infor\\Desktop\\Kiro\\DataConversion\\Van_Test.ionapi"
      }
    }
  }
}
```

**Critical Success Factors**:

- Use absolute paths to avoid resolution issues
- Specify working directory (cwd) for proper file access
- Use full Python executable path
- Unique server names prevent conflicts

### File Import Patterns

**Successful Patterns**:

- Place files in dedicated `Import_Files` folder
- Use descriptive filenames with business class indicators
- Include date information for audit trail
- Maintain consistent column headers

**Examples**:

- `GLTransactionInterface_20251128.csv` - Auto-detected as GL
- `Vendor_Master_Data.xlsx` - Auto-detected as Vendor
- `AP_Invoices_December.csv` - Auto-detected as PayablesInvoice

### Data Format Requirements (Validated)

**Date Formats**:

- Input: MM/DD/YYYY (e.g., "08/25/2025")
- Output: YYYYMMDD (e.g., "20250825")

**Amount Formats**:

- Input: Decimal with optional commas (e.g., "1,000.50")
- Output: Decimal without commas (e.g., "1000.50")
- Negative amounts: Supported with minus sign

**Required Fields for GLTransactionInterface**:

- FinanceEnterpriseGroup
- GLTransactionInterface.RunGroup
- GLTransactionInterface.SequenceNumber
- AccountingEntity
- AccountCode
- PostingDate

### Validation Results

**Success Metrics**:

- 100% validation rate with properly formatted data
- Real-time error detection and reporting
- Field-level error identification
- Business rule validation (e.g., account code validity)

**Common Issues Resolved**:

- Date format mismatches → Automatic conversion
- Missing required fields → Clear error messages
- Invalid data types → Type conversion with error handling

### Batch Loading Performance

**Metrics**:

- 20 records loaded in single batch
- Conversion time: <1 second
- Validation time: <1 second
- FSM upload time: 2-3 seconds
- Total end-to-end: <5 seconds

### Recommended Workflow

**Phase 1: Setup and Testing**

1. Configure MCP Server with proper paths
2. Test Authentication using `fsm_authenticate`
3. Validate Sample Data with small test files
4. Confirm Business Class Detection works

**Phase 2: Data Preparation**

1. Standardize File Formats according to proven patterns
2. Implement Naming Conventions for auto-detection
3. Validate Data Quality before conversion
4. Create Backup Procedures for source data

**Phase 3: Conversion and Loading**

1. Use Auto-Detection for efficiency (`fsm_convert_and_load`)
2. Always Validate First with `validate_only=true`
3. Review Validation Results before proceeding
4. Load in Batches appropriate for data volume

**Phase 4: Verification**

1. Confirm Batch Status in FSM system
2. Verify Record Counts match source
3. Spot-Check Data Accuracy in FSM
4. Document Results for audit trail

### Error Handling Patterns

**Authentication Errors**:

- Symptom: "Authentication failed" messages
- Resolution: Verify .ionapi file exists with valid credentials
- Prevention: Test authentication before bulk operations

**File Format Errors**:

- Symptom: "Error reading file" messages
- Resolution: Check file encoding (UTF-8), delimiter detection
- Prevention: Use standard CSV/Excel formats

**Validation Errors**:

- Symptom: Low validation rates, field-specific errors
- Resolution: Review required fields, fix data format
- Prevention: Use schema information to prepare data

**MCP Server Connection Issues**:

- Symptom: "Connection closed" errors in logs
- Resolution: Check MCP configuration paths, restart server
- Prevention: Use absolute paths, proper working directory

### Success Criteria

**Technical Success**:

- ✅ MCP server connects and authenticates
- ✅ File auto-detection works for all business classes
- ✅ Data validation achieves >95% success rate
- ✅ Batch loading completes without errors
- ✅ FSM confirms successful record creation

**User Experience Success**:

- ✅ Non-technical users operate through natural language
- ✅ Clear error messages guide to solutions
- ✅ Preview functionality prevents accidental loading
- ✅ Audit trail maintains data lineage

**Business Success**:

- ✅ Data integrity maintained throughout conversion
- ✅ Conversion time reduced from hours to minutes
- ✅ Error rates minimized through validation
- ✅ Compliance requirements met with documentation

---

## Authors

**Van Anthony Silleza** - Infor FSM Technical Consultant
FSM methodology expertise, business process knowledge, practical implementation guidance

**Kiro AI Assistant** - Documentation & Automation
Methodology documentation, MCP integration patterns, lessons learned capture

*Collaborative development - January 2026*
