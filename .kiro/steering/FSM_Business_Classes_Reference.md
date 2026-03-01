---
inclusion: auto
name: fsm-business-classes
description: FSM business class field definitions, GLTransactionInterface, PayablesInvoice, Vendor, Customer, field types, validation rules, relationships, API endpoints. Use when mapping data fields, understanding validation rules, or troubleshooting field errors.
---

# FSM Business Classes Reference

## Quick Reference

**Business Class**: FSM data structure representing a business entity (Vendor, Invoice, GL Account, etc.)

**Naming**: PascalCase (e.g., PayablesInvoice, GeneralLedgerTransaction)

**Components**: Fields (data attributes), Relationships (links to other classes), Validation Rules (constraints), API Endpoints (access methods)

## When to Use This Guide

- Mapping source data to FSM fields
- Determining required vs optional fields
- Understanding field validation rules
- Troubleshooting validation errors
- Building API requests
- Understanding business class relationships

## GL Module Business Classes

### GLTransactionInterface

**Purpose**: Primary interface for GL transaction entry and batch processing

**Module**: GL (General Ledger)

**Required Fields**:

- `transactionId` (String): Unique identifier
- `account` (String): Valid GL account number
- `amount` (Decimal): 2 decimal places, can be positive or negative
- `date` (Date): YYYY-MM-DD format
- `entity` (String): Valid entity ID

**Optional Fields**:

- `description` (String): Max 255 characters
- `department` (String): Valid department code
- `project` (String): Valid project code
- `costCenter` (String): Valid cost center code
- `reference` (String): Max 50 characters
- `status` (String): DRAFT, POSTED, REVERSED
- `lineNumber` (Integer): Sequential line number
- `debitAmount` (Decimal): 2 decimal places
- `creditAmount` (Decimal): 2 decimal places

**Critical Validation Rules**:

- Debits must equal credits per transaction
- Account must be active and valid
- Date must be within fiscal period
- Entity must be valid and active
- Amount must be non-zero

**Relationships**:

- FinanceEnterpriseGroup (via entity)
- GeneralLedgerAccount (via account)
- CostCenter (via costCenter)
- Department (via department)

**API Example**:

```json
POST /FSM/fsm/soap
{
  "_records": [{
    "message": "GLTransactionInterface",
    "_fields": {
      "transactionId": "TXN001",
      "account": "1000",
      "amount": 1000.00,
      "date": "2024-01-15",
      "entity": "2600",
      "description": "Monthly rent payment"
    }
  }]
}
```

### GeneralLedgerTransaction

**Purpose**: GL transaction master record (created from GLTransactionInterface)

**Module**: GL

**Key Fields**:

- `transactionId` (String): Unique identifier
- `transactionDate` (Date): Date of transaction
- `postingDate` (Date): Date posted to GL
- `entity` (String): Legal entity
- `description` (String): Transaction description
- `status` (String): DRAFT, POSTED, REVERSED
- `totalDebit` (Decimal): Sum of all debits
- `totalCredit` (Decimal): Sum of all credits

**Critical Validation Rules**:

- Total debits must equal total credits
- Dates must be in chronological order
- Cannot modify posted transactions

**Relationships**:

- Contains: GLTransactionDetail (line items)
- Links to: FinanceEnterpriseGroup, GeneralLedgerAccount

### GLTransactionDetail

**Purpose**: Individual GL transaction line items

**Module**: GL

**Key Fields**:

- `transactionId` (String): Parent transaction ID
- `lineNumber` (Integer): Sequential line number
- `account` (String): GL account number
- `debitAmount` (Decimal): Debit amount (if applicable)
- `creditAmount` (Decimal): Credit amount (if applicable)
- `description` (String): Line description
- `department`, `project`, `costCenter`, `reference` (String): Optional dimensions

**Critical Validation Rules**:

- Either debit OR credit must be populated (not both)
- Amount must be positive
- Line number must be sequential

**Relationships**:

- Parent: GeneralLedgerTransaction
- Links to: GeneralLedgerAccount, CostCenter, Department

### FinanceEnterpriseGroup

**Purpose**: Enterprise group configuration and hierarchy

**Module**: GL

**Key Fields**:

- `groupId` (String): Unique group identifier
- `groupName` (String): Group name
- `parentGroupId` (String): Parent group (for hierarchy)
- `status` (String): ACTIVE, INACTIVE

**Relationships**:

- Parent: FinanceEnterpriseGroup (if hierarchical)
- Contains: FinanceEnterpriseGroup (child groups)

### GeneralLedgerTotal

**Purpose**: GL account totals and balances

**Module**: GL

**Key Fields**:

- `account` (String): GL account number
- `entity` (String): Legal entity
- `fiscalPeriod` (String): Fiscal period
- `openingBalance` (Decimal): Balance at period start
- `debits` (Decimal): Total debits in period
- `credits` (Decimal): Total credits in period
- `closingBalance` (Decimal): Balance at period end

**Critical Validation Rules**:

- Opening balance + debits - credits = closing balance

**Relationships**:

- Links to: GeneralLedgerAccount, FinanceEnterpriseGroup, FiscalPeriod

## AP Module Business Classes

### PayablesInvoice

**Purpose**: Vendor invoice master record

**Module**: AP (Accounts Payable)

**Required Fields**:

- `invoiceNumber` (String): Unique per vendor
- `vendor` (String): Vendor ID
- `invoiceDate` (Date): Date of invoice
- `dueDate` (Date): Payment due date
- `amount` (Decimal): Invoice total amount
- `entity` (String): Legal entity

**Optional Fields**:

- `currency` (String): Currency code (USD, EUR, etc.)
- `description` (String): Invoice description
- `status` (String): DRAFT, POSTED, PAID, REVERSED
- `department`, `project`, `reference` (String): Optional dimensions

**Critical Validation Rules**:

- Invoice number must be unique per vendor
- Vendor must be active
- Amount must be positive
- Invoice date must be before or equal to due date
- Entity must be valid

**Relationships**:

- Links to: Vendor
- Contains: PayablesInvoiceDetail (line items)
- Links to: MatchInvoiceImport (for PO matching)

**API Example**:

```json
POST /FSM/fsm/soap
{
  "_records": [{
    "message": "PayablesInvoice",
    "_fields": {
      "invoiceNumber": "INV-2024-001",
      "vendor": "V001",
      "invoiceDate": "2024-01-15",
      "dueDate": "2024-02-15",
      "amount": 5000.00,
      "currency": "USD",
      "entity": "2600"
    }
  }]
}
```

### PayablesInvoiceDetail

**Purpose**: Individual invoice line items

**Module**: AP

**Key Fields**:

- `invoiceNumber` (String): Parent invoice number
- `lineNumber` (Integer): Sequential line number
- `description` (String): Line description
- `quantity` (Decimal): Quantity ordered
- `unitPrice` (Decimal): Price per unit
- `lineAmount` (Decimal): Total line amount
- `account` (String): GL account for posting
- `department`, `project`, `costCenter` (String): Optional dimensions

**Critical Validation Rules**:

- Line amount = quantity × unit price
- Line number must be sequential

**Relationships**:

- Parent: PayablesInvoice
- Links to: GeneralLedgerAccount, CostCenter, Department

### MatchInvoiceImport

**Purpose**: Invoice matching and import functionality

**Module**: AP

**Key Fields**:

- `invoiceNumber` (String): Invoice number
- `vendor` (String): Vendor ID
- `poNumber` (String): Purchase order number
- `matchStatus` (String): MATCHED, UNMATCHED, PARTIAL
- `matchDate` (Date): Date of match
- `discrepancies` (String): Description of discrepancies

**Critical Validation Rules**:

- Quantities must match (or be within tolerance)
- Amounts must match (or be within tolerance)

**Relationships**:

- Links to: PayablesInvoice, PurchaseOrder, Vendor

### Vendor

**Purpose**: Vendor master data

**Module**: AP

**Required Fields**:

- `vendorId` (String): Unique vendor identifier
- `vendorName` (String): Vendor name
- `vendorType` (String): Type of vendor

**Optional Fields**:

- `status` (String): ACTIVE, INACTIVE
- `address`, `city`, `state`, `postalCode`, `country` (String): Address fields
- `phone`, `email`, `contact` (String): Contact information
- `paymentTerms` (String): Payment terms code
- `taxId` (String): Tax ID number
- `currency` (String): Default currency

**Critical Validation Rules**:

- Vendor ID must be unique
- Email must be valid format (if provided)
- Tax ID must be valid format (if provided)

**Relationships**:

- Contains: VendorLocation (multiple locations)
- Contains: PayablesInvoice (invoices)

**API Example**:

```json
POST /FSM/fsm/soap
{
  "_records": [{
    "message": "Vendor",
    "_fields": {
      "vendorId": "V001",
      "vendorName": "ACME Corporation",
      "vendorType": "SUPPLIER",
      "status": "ACTIVE",
      "city": "New York",
      "state": "NY",
      "country": "USA"
    }
  }]
}
```

### VendorLocation

**Purpose**: Vendor location details

**Module**: AP

**Key Fields**:

- `vendorId` (String): Parent vendor ID
- `locationId` (String): Unique location identifier
- `locationName` (String): Location name
- `address`, `city`, `state`, `postalCode`, `country` (String): Address fields
- `isPrimary` (Boolean): Is this the primary location
- `status` (String): ACTIVE, INACTIVE

**Critical Validation Rules**:

- Only one primary location per vendor

**Relationships**:

- Parent: Vendor

## AR Module Business Classes

### Customer

**Purpose**: Customer master data

**Module**: AR (Accounts Receivable)

**Required Fields**:

- `customerId` (String): Unique customer identifier
- `customerName` (String): Customer name
- `customerType` (String): Type of customer

**Optional Fields**:

- `status` (String): ACTIVE, INACTIVE
- `address`, `city`, `state`, `postalCode`, `country` (String): Address fields
- `phone`, `email`, `contact` (String): Contact information
- `creditLimit` (Decimal): Credit limit
- `currency` (String): Default currency
- `paymentTerms` (String): Payment terms code

**Critical Validation Rules**:

- Customer ID must be unique
- Credit limit must be non-negative
- Email must be valid format (if provided)

**Relationships**:

- Contains: CustomerLocation (multiple locations)
- Contains: Invoice, SalesOrder

### CustomerLocation

**Purpose**: Customer location details

**Module**: AR

**Key Fields**:

- `customerId` (String): Parent customer ID
- `locationId` (String): Unique location identifier
- `locationName` (String): Location name
- `address`, `city`, `state`, `postalCode`, `country` (String): Address fields
- `isPrimary` (Boolean): Is this the primary location
- `status` (String): ACTIVE, INACTIVE

**Critical Validation Rules**:

- Only one primary location per customer

**Relationships**:

- Parent: Customer
- Links to: Invoice, SalesOrder

### Invoice

**Purpose**: Customer invoice records

**Module**: AR

**Key Fields**:

- `invoiceNumber` (String): Unique invoice number
- `customer` (String): Customer ID
- `invoiceDate` (Date): Date of invoice
- `dueDate` (Date): Payment due date
- `amount` (Decimal): Invoice total amount
- `currency` (String): Currency code
- `status` (String): DRAFT, POSTED, PAID, REVERSED
- `entity` (String): Legal entity

**Critical Validation Rules**:

- Invoice number must be unique
- Customer must be active
- Amount must be positive
- Invoice date must be before or equal to due date

**Relationships**:

- Links to: Customer
- Contains: InvoiceDetail (line items)
- Links to: SalesOrder (if from sales order)

### SalesOrder

**Purpose**: Sales order management

**Module**: AR

**Key Fields**:

- `orderNumber` (String): Unique order number
- `customer` (String): Customer ID
- `orderDate` (Date): Date of order
- `requiredDate` (Date): Required delivery date
- `amount` (Decimal): Order total amount
- `status` (String): DRAFT, CONFIRMED, SHIPPED, INVOICED
- `entity` (String): Legal entity

**Critical Validation Rules**:

- Order number must be unique
- Customer must be active
- Order date must be before required date

**Relationships**:

- Links to: Customer
- Contains: SalesOrderLine (line items)
- Links to: Invoice (when invoiced)

## PO Module Business Classes

### PurchaseOrder

**Purpose**: Purchase order master

**Module**: PO (Purchase Orders)

**Key Fields**:

- `poNumber` (String): Unique PO number
- `vendor` (String): Vendor ID
- `poDate` (Date): Date of PO
- `requiredDate` (Date): Required delivery date
- `amount` (Decimal): PO total amount
- `status` (String): DRAFT, CONFIRMED, RECEIVED, INVOICED
- `entity` (String): Legal entity

**Critical Validation Rules**:

- PO number must be unique
- Vendor must be active
- PO date must be before required date

**Relationships**:

- Links to: Vendor
- Contains: PurchaseOrderLine (line items)
- Links to: PurchaseOrderReceipt (receipts)

### PurchaseOrderLine

**Purpose**: Individual PO line items

**Module**: PO

**Key Fields**:

- `poNumber` (String): Parent PO number
- `lineNumber` (Integer): Sequential line number
- `description` (String): Line description
- `quantity` (Decimal): Quantity ordered
- `unitPrice` (Decimal): Price per unit
- `lineAmount` (Decimal): Total line amount
- `account` (String): GL account for posting
- `status` (String): OPEN, RECEIVED, INVOICED

**Critical Validation Rules**:

- Line amount = quantity × unit price
- Line number must be sequential

**Relationships**:

- Parent: PurchaseOrder
- Links to: PurchaseOrderReceipt (receipts)

### PurchaseOrderReceipt

**Purpose**: Receipt tracking

**Module**: PO

**Key Fields**:

- `receiptNumber` (String): Unique receipt number
- `poNumber` (String): Related PO number
- `receiptDate` (Date): Date of receipt
- `quantity` (Decimal): Quantity received
- `status` (String): RECEIVED, INSPECTED, ACCEPTED

**Critical Validation Rules**:

- Quantity received cannot exceed PO quantity

**Relationships**:

- Links to: PurchaseOrder, PurchaseOrderLine

## IC Module Business Classes

### InventoryItem

**Purpose**: Inventory master

**Module**: IC (Inventory Control)

**Key Fields**:

- `itemId` (String): Unique item identifier
- `itemName` (String): Item name
- `description` (String): Item description
- `itemType` (String): Type of item
- `status` (String): ACTIVE, INACTIVE
- `unitOfMeasure` (String): Unit of measure (EA, BOX, etc.)
- `reorderPoint` (Decimal): Minimum stock level
- `reorderQuantity` (Decimal): Quantity to reorder
- `standardCost` (Decimal): Standard cost per unit

**Critical Validation Rules**:

- Item ID must be unique
- Reorder point must be non-negative
- Standard cost must be non-negative

**Relationships**:

- Contains: InventoryLocation (stock at locations)
- Contains: InventoryTransaction (movements)

### InventoryLocation

**Purpose**: Warehouse locations

**Module**: IC

**Key Fields**:

- `locationId` (String): Unique location identifier
- `locationName` (String): Location name
- `warehouseId` (String): Warehouse ID
- `aisle`, `shelf`, `bin` (String): Physical location
- `status` (String): ACTIVE, INACTIVE

**Relationships**:

- Links to: Warehouse
- Contains: InventoryTransaction (movements)

### InventoryTransaction

**Purpose**: Stock movements

**Module**: IC

**Key Fields**:

- `transactionId` (String): Unique transaction ID
- `itemId` (String): Item ID
- `locationId` (String): Location ID
- `transactionType` (String): RECEIPT, ISSUE, ADJUSTMENT
- `quantity` (Decimal): Quantity moved
- `transactionDate` (Date): Date of transaction
- `reference` (String): Reference information

**Critical Validation Rules**:

- Transaction ID must be unique
- Quantity must be positive

**Relationships**:

- Links to: InventoryItem, InventoryLocation

## Business Class Relationships

### Relationship Types

1. **Parent-Child**: One-to-many (e.g., Vendor → VendorLocation)
2. **Reference**: Many-to-one (e.g., PayablesInvoice → Vendor)
3. **Cross-Module**: Between modules (e.g., AP → GL)

### Common Data Flow Patterns

**GL Transaction Flow**:

```text
GLTransactionInterface (entry point)
  ↓
GeneralLedgerTransaction (master record)
  ↓
GLTransactionDetail (line items)
  ↓
GeneralLedgerAccount (account master)
  ↓
GeneralLedgerTotal (account balances)
```

**AP Invoice Flow**:

```text
PayablesInvoice (invoice master)
  ↓
PayablesInvoiceDetail (line items)
  ↓
MatchInvoiceImport (PO matching)
  ↓
PurchaseOrder (related PO)
  ↓
GLTransactionInterface (GL posting)
```

**AR Invoice Flow**:

```text
SalesOrder (sales order)
  ↓
Invoice (customer invoice)
  ↓
InvoiceDetail (line items)
  ↓
GLTransactionInterface (GL posting)
```

## Field Types Reference

### String

- **Format**: Text up to specified length
- **Validation**: Non-empty, no special characters (unless allowed)
- **Example**: "ACME Corporation"

### Decimal

- **Format**: Numeric with 2 decimal places
- **Validation**: Non-negative (unless negative allowed), valid number
- **Example**: 1000.00, 500.50

### Date

- **Format**: YYYY-MM-DD
- **Validation**: Valid date, within acceptable range
- **Example**: "2024-01-15"

### Integer

- **Format**: Whole number
- **Validation**: Non-negative (unless negative allowed)
- **Example**: 1, 100, 5000

### Boolean

- **Format**: True/False or Yes/No
- **Validation**: Valid boolean value
- **Example**: true, false

### Reference

- **Format**: ID of related record
- **Validation**: Referenced record must exist
- **Example**: "V001" (vendor ID)

## Data Quality Guidelines

### Data Entry Checklist

- Validate all required fields before submission
- Use consistent formatting (case, dates, amounts)
- Verify references exist before linking
- Document any manual entries or exceptions
- Review data before posting

### Data Maintenance

- Keep master data current
- Archive inactive records
- Monitor for duplicates
- Reconcile regularly
- Document changes

### Validation Priorities

- Completeness: All required fields populated
- Accuracy: Data matches source documents
- Consistency: Formats and values are uniform
- Integrity: References are valid
- Timeliness: Data is current

### Performance Optimization

- Use indexes for frequently queried fields
- Archive old records
- Batch process large volumes
- Monitor query performance
- Optimize database regularly

## Common Validation Errors

### Field-Level Errors

- **Missing required field**: Ensure all required fields are populated
- **Invalid format**: Check date format (YYYY-MM-DD), decimal places (2), string length
- **Invalid reference**: Verify referenced record exists (vendor, customer, account)
- **Out of range**: Check date within fiscal period, amount within limits

### Record-Level Errors

- **Unbalanced transaction**: Debits must equal credits
- **Duplicate key**: ID/number must be unique
- **Invalid status transition**: Check allowed status changes
- **Date sequence**: Invoice date must be before or equal to due date

### Business Logic Errors

- **Inactive reference**: Referenced entity must be active
- **Insufficient credit**: Customer credit limit exceeded
- **Quantity mismatch**: Receipt quantity exceeds PO quantity
- **Period closed**: Transaction date in closed fiscal period

## Field Mapping Strategy

### When Mapping Source Data to FSM

1. **Identify business class**: Determine target FSM business class
2. **Map required fields first**: Ensure all required fields have source data
3. **Handle optional fields**: Map optional fields where source data exists
4. **Apply transformations**: Convert formats, calculate derived values
5. **Validate references**: Ensure referenced records exist in FSM
6. **Test with sample**: Validate mapping with small dataset first

### Common Transformations

- **Date format**: Convert to YYYY-MM-DD
- **Decimal precision**: Round to 2 decimal places
- **String case**: Standardize to uppercase/lowercase
- **ID padding**: Add leading zeros if needed
- **Currency conversion**: Apply exchange rates if needed
- **Status mapping**: Map source status to FSM status values

### Handling Missing Data

- **Required fields**: Must have default value or reject record
- **Optional fields**: Leave blank or use default
- **References**: Create master record first or use placeholder
- **Calculated fields**: Derive from other fields if possible
