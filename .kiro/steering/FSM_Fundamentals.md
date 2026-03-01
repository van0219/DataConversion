---
inclusion: auto
name: fsm-fundamentals
description: FSM architecture, modules (GL, AP, AR, PO, IC), business classes, multi-tenant systems, OAuth2 authentication, API integration, data validation, troubleshooting. Use when learning FSM concepts, understanding modules, or troubleshooting authentication.
---

# FSM Fundamentals for Kiro MCP Server

## FSM Definition

**FSM = Financials and Supply Management** - Infor's comprehensive ERP system covering financial and supply chain management operations through 450-550 business classes across multiple modules.

## Core FSM Architecture

### Module Structure

- **GL (General Ledger)**: Financial accounting and reporting
- **AP (Accounts Payable)**: Vendor management and invoice processing
- **AR (Accounts Receivable)**: Customer management and billing
- **PO (Purchase Orders)**: Procurement and vendor ordering
- **IC (Inventory Control)**: Stock management and warehousing
- **AM (Asset Management)**: Fixed asset tracking
- **CB (Cash Management)**: Bank reconciliation and cash flow
- **TR (Treasury)**: Financial instruments and hedging

### Multi-Tenant Architecture

- **Tenant ID Format**: TAMICS10_AX1 (example: White Plains Hospital sandbox)
- **Environment Types**: Production, Test, Development, Training, Sandbox, Demo, Preprod, Pristine, UAT, Staging, QA, Integration
- **Entity Management**: Multiple legal entities per tenant (e.g., 2600, 2602, 2604, 2606, 2608, 2610, 2612, 2614, 2616, 2618, 2620, 2622, 2624, 2632)

## FSM Business Classes (450-550 Total)

### Core GL Business Classes

- **GLTransactionInterface**: Primary interface for GL transaction entry
- **GeneralLedgerTransaction**: GL transaction master record
- **GLTransactionDetail**: Individual GL transaction line items
- **FinanceEnterpriseGroup**: Enterprise group configuration
- **GeneralLedgerTotal**: GL account totals and balances

### AP Business Classes

- **PayablesInvoice**: Vendor invoice master record
- **MatchInvoiceImport**: Invoice matching and import functionality
- **Vendor**: Vendor master data
- **VendorLocation**: Vendor location details
- **SupplierContract**: Supplier contract terms

### AR Business Classes

- **Customer**: Customer master data
- **CustomerLocation**: Customer location details
- **SalesOrder**: Sales order management
- **Invoice**: Customer invoice records

### PO Business Classes

- **PurchaseOrder**: Purchase order master
- **PurchaseOrderLine**: Individual PO line items
- **PurchaseOrderReceipt**: Receipt tracking

### IC Business Classes

- **InventoryItem**: Inventory master
- **InventoryLocation**: Warehouse locations
- **InventoryTransaction**: Stock movements

### Common Fields Across Classes

- **_fields**: JSON structure containing field values
- **_links**: Relationship links to related records
- **_metadata**: Record metadata (created date, modified date, etc.)
- **_keys**: Unique identifiers for records

## FSM API Integration

### Primary Endpoints

- **SOAP Endpoint**: `https://mingle-ionapi.inforcloudsuite.com/TENANT_ID/FSM/fsm/soap`
- **Portal Endpoint**: `https://mingle-portal.inforcloudsuite.com/TENANT_ID`
- **SSO Endpoint**: `https://mingle-sso.inforcloudsuite.com:443/TENANT/as/token.oauth2`

### Authentication

- **OAuth2 Flow**: Client credentials grant type
- **Token URL Format**: `https://mingle-sso.inforcloudsuite.com:443/TENANT/as/token.oauth2?username=USER&password=PASS&client_id=ID&client_secret=SECRET&grant_type=password`
- **Token Usage**: Include in Authorization header for all API calls
- **Service Account Credentials**:
  - `ti`: Tenant ID
  - `ci`: Client ID
  - `cs`: Client Secret
  - `pu`: Portal URL
  - `ot`: OAuth Token endpoint
  - `iu`: ION API URL
  - `saak`: Service Account API Key
  - `sask`: Service Account Secret Key

### API Request Structure

```json
{
  "_records": [
    {
      "message": "string",
      "_fields": {
        "fieldName": "value",
        "fieldName2": "value2"
      }
    }
  ]
}
```

### API Response Structure

```json
{
  "_records": [
    {
      "_id": "unique_id",
      "_fields": {
        "fieldName": "value",
        "fieldName2": "value2"
      },
      "_links": {
        "self": "link_to_record"
      }
    }
  ],
  "_metadata": {
    "totalRecords": 100,
    "pageSize": 50,
    "currentPage": 1
  }
}
```

## FSM Data Validation Requirements

### Field-Level Validation

- **Required Fields**: Must be present and non-null
- **Field Types**: String, Integer, Decimal, Date, Boolean, Reference
- **Format Validation**: Email, phone, date formats
- **Range Validation**: Min/max values for numeric fields
- **Reference Validation**: Foreign key relationships to other business classes

### Business Logic Validation

- **Entity Validation**: Records must belong to valid legal entities
- **Status Validation**: Records must have valid status values
- **Date Validation**: Dates must be within acceptable ranges
- **Amount Validation**: Amounts must be positive/negative as appropriate
- **Balance Validation**: Debits must equal credits in GL transactions

### Data Quality Standards

- **Completeness**: All required fields populated
- **Accuracy**: Data matches source systems
- **Consistency**: Data consistent across related records
- **Timeliness**: Data current and up-to-date
- **Uniqueness**: No duplicate records

## FSM Data Conversion Patterns

### Pre-Conversion Checklist

1. **Source System Analysis**: Understand source data structure
2. **Mapping Definition**: Map source fields to FSM business classes
3. **Validation Rules**: Define validation requirements
4. **Data Cleansing**: Clean and standardize data
5. **Test Migration**: Run test migration with sample data
6. **Full Migration**: Execute full data conversion
7. **Reconciliation**: Verify converted data accuracy
8. **Post-Conversion**: Monitor and support post-migration

### Common Conversion Scenarios

#### GL Transaction Conversion

- Source: Legacy GL system
- Target: GLTransactionInterface
- Key Fields: Account, Amount, Date, Description, Entity
- Validation: Balanced entries, valid accounts, date ranges

#### Vendor Master Conversion

- Source: Legacy vendor database
- Target: Vendor business class
- Key Fields: Vendor ID, Name, Address, Contact, Payment Terms
- Validation: Unique vendors, valid addresses, required fields

#### Customer Master Conversion

- Source: Legacy CRM system
- Target: Customer business class
- Key Fields: Customer ID, Name, Address, Contact, Credit Limit
- Validation: Unique customers, valid addresses, credit limits

#### Invoice Conversion

- Source: Legacy AP system
- Target: PayablesInvoice + MatchInvoiceImport
- Key Fields: Invoice Number, Vendor, Amount, Date, Line Items
- Validation: Balanced invoices, valid vendors, date ranges

### Data Transformation Rules

- **Case Standardization**: Convert to appropriate case (UPPER, lower, Title)
- **Null Handling**: Replace nulls with defaults or skip
- **Date Formatting**: Convert to FSM date format (YYYY-MM-DD)
- **Amount Formatting**: Convert to decimal with proper precision
- **Reference Resolution**: Map legacy IDs to FSM IDs
- **Concatenation**: Combine fields when needed
- **Splitting**: Break fields into components

## FSM File Format Support

### Supported Input Formats

1. **CSV**: Comma-separated values
2. **Excel**: .xlsx files with multiple sheets
3. **Tab-Delimited**: Tab-separated values
4. **Pipe-Delimited**: Pipe (|) separated values
5. **Semicolon-Delimited**: Semicolon (;) separated values
6. **Fixed-Width**: Fixed column positions
7. **Auto-Detect**: Automatic format detection

### Format Conversion Process

1. **Read Source File**: Parse file in native format
2. **Create DataFrame**: Load into pandas DataFrame
3. **Apply Transformations**: Execute mapping and validation rules
4. **Generate JSON**: Convert to FSM API JSON format
5. **Upload to FSM**: Submit via ION API

### JSON Template System

- **Template Definition**: Configurable JSON structure per business class
- **Field Mapping**: Map DataFrame columns to JSON fields
- **Batch Processing**: Support for batch API operations
- **Error Handling**: Capture and report conversion errors

## FSM Business Class Details

### FinanceEnterpriseGroup

- **Purpose**: Enterprise group configuration
- **Key Fields**: Group ID, Name, Description, Parent Group
- **Validation**: Unique group IDs, valid parent references
- **Usage**: Organizing GL accounts and transactions

### GLTransactionInterface

- **Purpose**: Primary GL transaction entry point
- **Key Fields**: Transaction ID, Account, Amount, Date, Description, Entity
- **Validation**: Balanced entries, valid accounts, date ranges
- **Processing**: Converts to GeneralLedgerTransaction after validation

### PayablesInvoice

- **Purpose**: Vendor invoice master record
- **Key Fields**: Invoice Number, Vendor, Amount, Date, Status
- **Validation**: Unique invoices, valid vendors, positive amounts
- **Matching**: Links to MatchInvoiceImport for PO matching

### MatchInvoiceImport

- **Purpose**: Invoice matching and import
- **Key Fields**: Invoice ID, PO Number, Line Items, Match Status
- **Validation**: Valid PO references, quantity/amount matching
- **Processing**: Matches invoices to purchase orders

## FSM Data Quality Metrics

### Validation Results

- **Success**: All records passed validation
- **Partial Success**: Some records passed, some failed
- **Failed**: No records passed validation

### Error Categories

- **Syntax Errors**: Invalid data format or type
- **Validation Errors**: Data fails business rules
- **Reference Errors**: Invalid foreign key references
- **Duplicate Errors**: Duplicate records detected
- **Missing Errors**: Required fields missing

### Reporting Standards

- **Summary Report**: Total records, passed, failed, error rate
- **Detailed Report**: Row-by-row error messages
- **Error Analysis**: Grouped by error type and field
- **Recommendations**: Suggested fixes for common errors

## FSM Integration Best Practices

### Performance Optimization

- **Batch Processing**: Process records in 25K-100K chunks
- **Indexing**: Use indexed queries for large datasets
- **Caching**: Cache frequently accessed reference data
- **Async Operations**: Use async for long-running operations
- **Connection Pooling**: Reuse database connections

### Error Handling

- **Retry Logic**: Implement exponential backoff for failures
- **Timeout Protection**: Set reasonable timeouts for API calls
- **Graceful Degradation**: Fallback mechanisms for failures
- **Logging**: Comprehensive logging of all operations
- **User Feedback**: Clear error messages for end users

### Security Standards

- **Credential Management**: Secure storage of API credentials
- **Encryption**: Encrypt sensitive data in transit and at rest
- **Access Control**: Role-based permissions for operations
- **Audit Logging**: Track all data access and modifications
- **Data Sanitization**: Remove sensitive data before sharing

## FSM Configuration Data (Example)

### Primary Endpoint

- **URL**: <https://mingle-ionapi.inforcloudsuite.com/TAMICS10_AX1/FSM/fsm/soap>
- **Tenant ID**: TAMICS10_AX1
- **Portal**: <https://mingle-portal.inforcloudsuite.com/TAMICS10_AX1>
- **Client**: White Plains Hospital

### Entities

- 2600, 2602, 2604, 2606, 2608, 2610, 2612, 2614, 2616, 2618, 2620, 2622, 2624, 2632

### Contact

- Email: <finance@whiteplainshospital.org>

## FSM Troubleshooting

### Common Issues

#### ClassCastException

- **Cause**: Incorrect activity type or edge type in IPA
- **Solution**: Verify activity types match FSM business class requirements
- **Prevention**: Use proper activity type mapping

#### Authentication Failures

- **Cause**: Invalid credentials or expired tokens
- **Solution**: Verify service account credentials, refresh OAuth token
- **Prevention**: Implement token refresh logic

#### Data Validation Failures

- **Cause**: Data doesn't match FSM business rules
- **Solution**: Review validation rules, clean data, retry
- **Prevention**: Pre-validate data before submission

#### API Timeouts

- **Cause**: Large dataset or slow network
- **Solution**: Reduce batch size, increase timeout, retry
- **Prevention**: Implement async processing and chunking

#### Reference Errors

- **Cause**: Invalid foreign key references
- **Solution**: Verify referenced records exist, map IDs correctly
- **Prevention**: Validate references before submission

## FSM Resources

### Documentation

- **IPD (Infor Process Designer)**: Process automation documentation
- **LPL (Landmark Pattern Language)**: Business class definition language
- **ANA-050**: Functional specification template
- **DES-020**: Technical specification template
- **TES-070**: Test results documentation template

### Tools

- **Configuration Console**: FSM configuration management
- **Compass SQL**: FSM data query language
- **ION API**: REST/SOAP API for integration
- **Mingle Portal**: Web-based FSM interface

### Training

- **Infor University**: Official training courses
- **Community Forums**: User community support
- **Documentation Portal**: Official documentation
- **Support Tickets**: Infor support system
