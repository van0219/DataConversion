---
inclusion: auto
name: fsm-mcp-server-usage
description: MCP tools (authenticate, convert, validate, load), natural language triggers, auto-detection, file conversion, data transformation, error handling, configuration, troubleshooting. Use when converting files, using MCP tools, or configuring the server.
---

# FSM MCP Server Usage Guide

## Purpose

This guide provides AI assistant instructions for using FSM MCP tools to convert, validate, and load data into FSM systems. Follow these patterns for consistent, reliable FSM integration.

## Critical Rules

1. **ALWAYS authenticate first** - Call `mcp_fsm_dataconversion_fsm_authenticate` before any FSM operations
2. **ALWAYS validate before loading** - Use `validate_only=true` or separate validation step
3. **NEVER load data without user confirmation** - Show validation results and get explicit approval
4. **ALWAYS use auto-detection** - Let `fsm_convert_and_load` detect business class from filename/content
5. **ALWAYS handle errors gracefully** - Provide actionable error messages with next steps

## Tool Selection Decision Tree

```
User Request → Decision Path → Tool to Use

"Convert/Load file" → Auto-detect workflow → fsm_convert_and_load
"Validate file" → Validation only → fsm_convert_file (validate=true)
"What fields needed?" → Schema lookup → fsm_get_schema
"Test connection" → Auth check → fsm_authenticate
"List data types" → Discovery → fsm_list_business_classes
"Query records" → Data retrieval → fsm_query
"Create record" → Single insert → fsm_create
"Create multiple" → Batch insert → fsm_create_batch
```

## Available MCP Tools

### 1. Authentication & Discovery

**`mcp_fsm_dataconversion_fsm_authenticate`**

- **Purpose**: Test FSM connection and authentication status
- **When to use**: First step in any FSM workflow, troubleshooting connection issues
- **Parameters**: None
- **Returns**: Connection status, tenant info, authentication state

**`mcp_fsm_dataconversion_fsm_list_business_classes`**

- **Purpose**: List all available FSM business classes
- **When to use**: User asks "what data types are available", discovery phase
- **Parameters**: `module` (optional) - Filter by GL, AP, AR, PO, IC
- **Returns**: List of business classes with descriptions

### 2. Schema & Validation

**`mcp_fsm_dataconversion_fsm_get_schema`**

- **Purpose**: Get detailed field schema for a business class
- **When to use**: User asks "what fields do I need", mapping phase, troubleshooting validation errors
- **Parameters**: `business_class` (required) - e.g., "GLTransactionInterface"
- **Returns**: Complete field definitions, types, required fields, validation rules

**`mcp_fsm_dataconversion_fsm_validate`**

- **Purpose**: Validate data against FSM rules without loading
- **When to use**: Pre-validation of structured data, testing transformations
- **Parameters**: `business_class` (required), `records` (required array)
- **Returns**: Validation results, error details by field

### 3. File Conversion

**`mcp_fsm_dataconversion_fsm_convert_file`**

- **Purpose**: Convert file to FSM JSON format with validation
- **When to use**: Need conversion without loading, custom field mapping, validation-only mode
- **Parameters**:
  - `business_class` (required) - Target business class
  - `file_content` (required) - File content as string
  - `file_format` (optional) - "auto", "csv", "json"
  - `field_mapping` (optional) - Custom field mappings
  - `validate` (optional) - Default true
- **Returns**: Converted records, validation results, error details

**`mcp_fsm_dataconversion_fsm_convert_and_load`** ⭐ PRIMARY TOOL

- **Purpose**: Auto-detect business class and load in one step
- **When to use**: Most file conversion requests, simplest workflow
- **Parameters**:
  - `file_content` (required) - File content as string
  - `file_name` (optional) - For business class detection
  - `business_class` (optional) - Override auto-detection
  - `field_mapping` (optional) - Custom mappings
  - `validate_only` (optional) - Default false, set true for dry-run
- **Returns**: Conversion results, validation status, load confirmation

### 4. FSM Data Operations

**`mcp_fsm_dataconversion_fsm_query`**

- **Purpose**: Query existing records from FSM
- **When to use**: Lookup existing data, verify loads, data reconciliation
- **Parameters**: `business_class` (required), `filters` (optional), `limit` (optional, default 100)
- **Returns**: Matching records

**`mcp_fsm_dataconversion_fsm_create`**

- **Purpose**: Create single record in FSM
- **When to use**: One-off record creation, testing
- **Parameters**: `business_class` (required), `fields` (required object)
- **Returns**: Created record details

**`mcp_fsm_dataconversion_fsm_create_batch`**

- **Purpose**: Create multiple records efficiently
- **When to use**: Bulk data loading (25-100 records optimal)
- **Parameters**: `business_class` (required), `records` (required array)
- **Returns**: Batch creation results, success/failure counts

## Natural Language Pattern Matching

Detect user intent and map to appropriate tools:

### File Conversion Intent

**Trigger phrases**: "convert", "load", "import", "upload", "send to FSM"

**Action**: Use `mcp_fsm_dataconversion_fsm_convert_and_load`

**Workflow**:

1. Read file content
2. Call with `validate_only=true` first
3. Show validation results to user
4. Get explicit confirmation
5. Call again with `validate_only=false` to load

### Validation Intent

**Trigger phrases**: "validate", "check", "verify", "is this correct", "test data"

**Action**: Use `mcp_fsm_dataconversion_fsm_convert_file` with `validate=true`

**Workflow**:

1. Read file content
2. Call with validation enabled
3. Report validation rate and errors
4. Suggest corrections for failed records

### Schema Inquiry Intent

**Trigger phrases**: "what fields", "requirements", "schema", "what do I need", "field list"

**Action**: Use `mcp_fsm_dataconversion_fsm_get_schema`

**Workflow**:

1. Identify business class from context
2. Call get_schema
3. Present required fields clearly
4. Highlight validation rules

### Connection Testing Intent

**Trigger phrases**: "test connection", "is FSM working", "check authentication", "can you connect"

**Action**: Use `mcp_fsm_dataconversion_fsm_authenticate`

**Workflow**:

1. Call authenticate
2. Report connection status
3. If failed, provide troubleshooting steps

### Discovery Intent

**Trigger phrases**: "what data types", "available classes", "what can I load", "list business classes"

**Action**: Use `mcp_fsm_dataconversion_fsm_list_business_classes`

**Workflow**:

1. Call list_business_classes
2. Optionally filter by module if specified
3. Present organized list with descriptions

## Auto-Detection Capabilities

The MCP server automatically detects business classes using multiple strategies:

### Filename Pattern Detection

**Pattern**: `{BusinessClass}_{date/identifier}.{extension}`

**Examples**:

- `GLTransactionInterface_20251128.csv` → GLTransactionInterface
- `Vendor_Import_2024.xlsx` → Vendor
- `Customer_Data.csv` → Customer
- `PayablesInvoice_Q4.xlsx` → PayablesInvoice
- `PurchaseOrder_Batch1.csv` → PurchaseOrder

**Rule**: Business class name must be at start of filename before underscore

### Column Header Detection

**Strategy**: Analyze column headers to identify business class

**GL Transaction Indicators**:

- `FinanceEnterpriseGroup`, `AccountCode`, `PostingDate`, `TransactionAmount`
- `DebitAmount`, `CreditAmount`, `JournalNumber`

**Vendor Indicators**:

- `VendorId`, `VendorName`, `VendorType`, `VendorGroup`
- `PaymentTerms`, `TaxId`

**Customer Indicators**:

- `CustomerId`, `CustomerName`, `CustomerType`, `CustomerGroup`
- `CreditLimit`, `PaymentTerms`

**Invoice Indicators**:

- `InvoiceNumber`, `Vendor`, `InvoiceDate`, `Amount`
- `DueDate`, `InvoiceType`

### File Format Detection

**Supported formats** (auto-detected from content):

- **CSV**: Comma, tab, pipe, semicolon delimited
- **Excel**: .xlsx files (first sheet used by default)
- **JSON**: Structured data format

**Detection logic**:

1. Check file extension
2. Analyze content structure
3. Identify delimiter for text files
4. Parse accordingly

### Detection Confidence

**High confidence**: Filename pattern + matching column headers
**Medium confidence**: Filename pattern OR matching column headers
**Low confidence**: Neither pattern matches (requires manual specification)

**AI Action**: If low confidence, ask user to specify business class explicitly

## Data Transformation Rules

The MCP server applies automatic transformations to ensure FSM compatibility:

### Date Transformations

**Input formats accepted**:

- `MM/DD/YYYY` → `YYYYMMDD`
- `DD-MM-YYYY` → `YYYYMMDD`
- `YYYY-MM-DD` → `YYYYMMDD`
- `MM-DD-YY` → `YYYYMMDD` (assumes 20xx)

**FSM required format**: `YYYYMMDD` (8-digit string)

**AI Action**: Inform user if date format is ambiguous

### Amount Transformations

**Input formats accepted**:

- `1,234.56` → `1234.56` (remove commas)
- `$1,234.56` → `1234.56` (remove currency symbols)
- `(1234.56)` → `-1234.56` (parentheses = negative)

**FSM required format**: Decimal number with 2 decimal places

**Validation**: Ensures numeric precision, rejects invalid amounts

### Text Transformations

**Case standardization**:

- Names: Proper case (e.g., "john doe" → "John Doe")
- Codes: Upper case (e.g., "gl001" → "GL001")
- Descriptions: Sentence case

**Whitespace handling**:

- Trim leading/trailing spaces
- Collapse multiple spaces to single space
- Remove non-printable characters

### Null Handling

**Strategy**: Replace nulls with FSM-appropriate defaults

**Defaults by field type**:

- Numeric: `0` or `0.00`
- Text: Empty string `""`
- Date: Current date or empty based on field requirement
- Boolean: `false`

**AI Action**: Warn user if critical fields have null values

### Field Mapping Strategies

**Direct mapping** (1:1):

- Source field name matches FSM field name exactly
- No transformation needed

**Concatenation** (many:1):

- Multiple source fields → Single FSM field
- Example: `FirstName` + `LastName` → `FullName`

**Splitting** (1:many):

- Single source field → Multiple FSM fields
- Example: `Address` → `Street`, `City`, `State`, `Zip`

**Lookup** (value translation):

- Legacy values → FSM reference values
- Example: `"A"` → `"Active"`, `"I"` → `"Inactive"`

**AI Action**: Suggest field mappings when column names don't match FSM schema

## Standard Workflows

### Workflow 1: File Conversion with Validation (Recommended)

**Use case**: User wants to convert and load a file

**Steps**:

1. **Authenticate**

   ```python
   mcp_fsm_dataconversion_fsm_authenticate()
   ```

2. **Read file content** (use readFile tool)

3. **Validate first** (dry-run)

   ```python
   mcp_fsm_dataconversion_fsm_convert_and_load(
       file_content=content,
       file_name="GLTransactionInterface_20251128.csv",
       validate_only=true
   )
   ```

4. **Present results to user**
   - Show validation rate
   - List any errors by field
   - Show sample of converted data

5. **Get user confirmation**
   - "Validation passed at 98%. Ready to load 150 records. Proceed?"

6. **Load data** (if confirmed)

   ```python
   mcp_fsm_dataconversion_fsm_convert_and_load(
       file_content=content,
       file_name="GLTransactionInterface_20251128.csv",
       validate_only=false
   )
   ```

7. **Confirm completion**
   - Report success count
   - Note any failures
   - Provide next steps

### Workflow 2: Schema Inquiry Before Conversion

**Use case**: User asks "what fields do I need?"

**Steps**:

1. **Identify business class** from user request

2. **Get schema**

   ```python
   mcp_fsm_dataconversion_fsm_get_schema(
       business_class="GLTransactionInterface"
   )
   ```

3. **Present required fields**
   - List required fields clearly
   - Show field types and formats
   - Highlight validation rules

4. **Offer to help with file preparation**
   - "Would you like me to validate your file against these requirements?"

### Workflow 3: Validation Only (No Load)

**Use case**: User wants to test data without loading

**Steps**:

1. **Authenticate**

2. **Read file content**

3. **Convert with validation**

   ```python
   mcp_fsm_dataconversion_fsm_convert_file(
       business_class="GLTransactionInterface",
       file_content=content,
       validate=true
   )
   ```

4. **Report validation results**
   - Validation rate
   - Error details by field
   - Suggested corrections

5. **Offer next steps**
   - "Fix errors and validate again?"
   - "Load valid records only?"

### Workflow 4: Batch Record Creation

**Use case**: Create multiple records from structured data

**Steps**:

1. **Authenticate**

2. **Prepare records** (ensure proper format)

3. **Validate first**

   ```python
   mcp_fsm_dataconversion_fsm_validate(
       business_class="Vendor",
       records=[{...}, {...}]
   )
   ```

4. **Create batch** (if validation passes)

   ```python
   mcp_fsm_dataconversion_fsm_create_batch(
       business_class="Vendor",
       records=[{...}, {...}]
   )
   ```

5. **Report results**
   - Success count
   - Failure count with details

## Error Handling Patterns

### Authentication Errors

**Error response**:

```json
{
  "status": "error",
  "message": "Authentication failed: Invalid credentials"
}
```

**AI Actions**:

1. Inform user of authentication failure
2. Check if `.ionapi` file exists at expected path
3. Verify FSM_IONAPI_FILE environment variable
4. Suggest: "Check your FSM credentials and .ionapi file configuration"
5. Offer to test connection again after user fixes issue

### Validation Errors

**Error response**:

```json
{
  "validation_rate": "85.0%",
  "valid_records": 85,
  "invalid_records": 15,
  "errors_by_field": {
    "PostingDate": ["Invalid date format in row 5", "Missing date in row 12"],
    "TransactionAmount": ["Invalid amount in row 23"]
  }
}
```

**AI Actions**:

1. Report validation rate clearly
2. List errors grouped by field
3. Explain what's wrong and how to fix
4. Offer options:
   - "Fix errors and re-validate?"
   - "Load only valid records?"
   - "Show me the schema requirements?"

### File Format Errors

**Error response**:

```json
{
  "success": false,
  "errors": ["Error reading file: Invalid CSV format - inconsistent column count"]
}
```

**AI Actions**:

1. Explain the format issue in plain language
2. Suggest correct format
3. Offer to help identify the problem
4. Ask user to verify file encoding (UTF-8 recommended)

### Business Rule Violations

**Error response**:

```json
{
  "validation_errors": [
    {
      "record": 5,
      "field": "AccountCode",
      "error": "Account code 'GL999' does not exist in FSM"
    }
  ]
}
```

**AI Actions**:

1. Explain the business rule that was violated
2. Suggest: "Would you like me to query valid account codes?"
3. Offer to help correct the data
4. Reference FSM_Business_Classes_Reference.md for field rules

### Network/Timeout Errors

**Error indicators**: Connection timeout, network unreachable

**AI Actions**:

1. Inform user of connectivity issue
2. Suggest checking network connection
3. Verify FSM API endpoint is accessible
4. Offer to retry with exponential backoff
5. Check if FSM system is under maintenance

## User Communication Guidelines

### Response Principles

**Always**:

- Use clear, jargon-free language
- Show validation results before loading
- Get explicit confirmation before data loads
- Provide actionable error messages with next steps
- Offer multiple options when errors occur

**Never**:

- Load data without user confirmation
- Skip validation steps
- Proceed after authentication failures
- Use technical jargon without explanation

### Response Templates

**Successful validation**:

> "Validation complete! ✓
>
> - 150 records validated
> - 98% validation rate
> - 3 records have minor date formatting issues
>
> Ready to load to FSM? I can fix the date issues automatically."

**Validation with errors**:

> "Validation found some issues:
>
> - 85 records are valid (85%)
> - 15 records have errors:
>   - 10 records: Invalid PostingDate format (need YYYYMMDD)
>   - 5 records: Missing required AccountCode
>
> Would you like me to:
>
> 1. Show you the schema requirements?
> 2. Load only the valid records?
> 3. Help fix the errors?"

**Authentication failure**:

> "Unable to connect to FSM. This usually means:
>
> - The .ionapi file is missing or invalid
> - Network connectivity issue
> - FSM system is under maintenance
>
> Can you verify your .ionapi file is at: `Van_Test.ionapi`?"

**Successful load**:

> "Data loaded successfully! ✓
>
> - 150 records created in FSM
> - Business class: GLTransactionInterface
> - Tenant: TAMICS10_AX1
>
> You can verify the records in FSM or query them using the MCP tools."

## Configuration Details

### MCP Server Configuration

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

### FSM Connection Details

- **Tenant**: TAMICS10_AX1
- **Environment**: Sandbox/Test
- **Authentication**: OAuth2 with service account
- **API Endpoint**: <https://mingle-ionapi.inforcloudsuite.com/>

## Performance Considerations

### Batch Processing

- Use `fsm_create_batch` for multiple records
- Optimal batch size: 25-100 records
- Monitor for timeout issues with large datasets

### File Size Limits

- CSV files: Up to 10MB recommended
- Excel files: Up to 5MB recommended
- JSON files: Up to 2MB recommended

### Rate Limiting

- FSM API has rate limits
- Implement retry logic for failed requests
- Use exponential backoff for retries

## Troubleshooting Guide

### Common Issues

#### MCP Server Won't Start

- Check Python path in configuration
- Verify working directory is correct
- Ensure all dependencies are installed

#### Authentication Failures

- Verify .ionapi file exists and is valid
- Check network connectivity to FSM
- Confirm service account credentials

#### File Conversion Errors

- Check file format and encoding
- Verify column headers match expected fields
- Ensure data types are compatible

#### Validation Failures

- Review required fields for business class
- Check data format requirements
- Validate foreign key references

### Debug Commands

```bash
# Test MCP server
python test_mcp.py

# Check authentication
mcp_fsm_dataconversion_fsm_authenticate

# Validate file
mcp_fsm_dataconversion_fsm_convert_file (validate=true)
```

## Success Metrics

### Conversion Success

- Validation rate > 95%
- Successful batch loading
- No data corruption
- Proper audit trail

### User Experience

- Natural language understanding
- Clear error messages
- Efficient workflows
- Minimal technical exposure

## Future Enhancements

### Planned Features

- Additional business class support
- Enhanced field mapping capabilities
- Real-time validation feedback
- Bulk operation optimization

### Integration Opportunities

- Direct Excel plugin integration
- Automated file monitoring
- Scheduled data imports
- Advanced error recovery

---

## Version History

### March 1, 2026

- **Refined**: Restructured for AI assistant consumption
- **Added**: Critical rules, decision trees, and workflow patterns
- **Enhanced**: Error handling patterns with specific AI actions
- **Improved**: Natural language pattern matching
- **Fixed**: Markdown formatting issues

### January 2026

- **Created**: Initial MCP server usage guide
- **Documented**: 9 MCP tools with parameters and examples

---

## Authors

**Van Anthony Silleza** - *Infor FSM Technical Consultant*  
FSM domain expertise, API integration guidance, and production requirements

**Kiro AI Assistant** - *Technical Implementation*  
MCP server development, tool documentation, and integration patterns

*Collaborative development - January-March 2026*
