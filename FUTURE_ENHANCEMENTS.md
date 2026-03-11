# Future Enhancements

## Overview
This document tracks planned enhancements for the FSM Conversion Workbench that are not yet implemented.

---

## 1. Post-Load Validation Report

**Priority**: HIGH  
**Complexity**: HIGH  
**Estimated Time**: 3-4 hours  
**Status**: Not Started

### Description
After loading data to FSM and running the interface, provide a detailed report showing success and errors with exact line/sequence numbers from FSM staging tables.

### Requirements

1. **FSM Interface Results Query**
   - Query FSM staging tables after interface execution
   - Fetch success/error records from FSM
   - Extract FSM sequence numbers and error messages

2. **Sequence Number Mapping**
   - Map FSM staging sequence numbers back to original CSV line numbers
   - Maintain mapping table during load process
   - Handle batch loading scenarios

3. **Report Display**
   - Show success count with FSM sequence numbers
   - Show error count with FSM error messages
   - Display exact CSV line numbers for each error
   - Allow filtering by success/error status
   - Export report as CSV

### Technical Implementation

**Backend**:
```python
# New service: backend/app/services/fsm_staging_query.py
class FSMStagingQueryService:
    async def fetch_interface_results(
        self, 
        business_class: str,
        batch_id: str
    ) -> Dict:
        """Query FSM staging tables for interface results"""
        # Query FSM API for staging table data
        # Parse success/error records
        # Return structured results
        
    def map_sequence_to_csv_line(
        self,
        job_id: int,
        fsm_sequence: int
    ) -> int:
        """Map FSM sequence number to CSV line number"""
        # Use load_results table to map back
        # Return original CSV line number
```

**Database**:
```sql
-- Add to load_results table
ALTER TABLE load_results ADD COLUMN sequence_mapping TEXT;
-- JSON: {"fsm_sequence": csv_line_number, ...}
```

**API Endpoint**:
```python
# POST /api/load/{job_id}/staging-report
# Returns: {
#   "total_records": 1000,
#   "success_count": 950,
#   "error_count": 50,
#   "success_records": [
#     {"csv_line": 2, "fsm_sequence": 1001, "status": "success"},
#     ...
#   ],
#   "error_records": [
#     {"csv_line": 15, "fsm_sequence": 1014, "error": "Invalid account"},
#     ...
#   ]
# }
```

**Frontend**:
```typescript
// New component: PostLoadReport.tsx
interface PostLoadReportProps {
  jobId: number;
}

// Features:
// - Fetch staging report button
// - Success/error summary cards
// - Detailed table with CSV line numbers
// - Filter by success/error
// - Export report as CSV
```

### FSM API Integration

**Staging Table Endpoints**:
- GLTransactionInterface → `GLTransactionInterfaceStaging`
- PayablesInvoice → `PayablesInvoiceStaging`
- Query format: `GET /soap/classes/{BusinessClass}Staging/lists/StagingList?_filter=BatchId eq '{batch_id}'`

**Response Format**:
```json
{
  "_records": [
    {
      "_fields": {
        "SequenceNumber": 1001,
        "Status": "Success",
        "ErrorMessage": null,
        "SourceLineNumber": 2
      }
    },
    {
      "_fields": {
        "SequenceNumber": 1014,
        "Status": "Error",
        "ErrorMessage": "Invalid account code",
        "SourceLineNumber": 15
      }
    }
  ]
}
```

### User Workflow

1. User completes data load to FSM
2. FSM interface runs (triggered or manual)
3. User clicks "Fetch Staging Report" button
4. System queries FSM staging tables
5. System maps FSM sequences to CSV line numbers
6. Report displays with exact line numbers
7. User can filter, review, and export report

### Benefits

- **Exact Error Location**: Users know exactly which CSV lines failed
- **FSM Validation**: See FSM-level validation errors (beyond pre-load validation)
- **Reconciliation**: Verify all records processed correctly
- **Audit Trail**: Complete record of load success/failure
- **Troubleshooting**: Quickly identify and fix problematic records

### Dependencies

- FSM API access to staging tables
- Understanding of FSM staging table structure per business class
- Batch ID tracking during load process
- Sequence number mapping during load

### Risks

- FSM staging table structure may vary by business class
- Staging data may be purged after interface run
- Requires additional FSM API calls (performance impact)
- Complex mapping logic for batch scenarios

### Testing Requirements

- Test with small dataset (10-20 records)
- Test with errors in staging
- Test with 100% success scenario
- Test sequence number mapping accuracy
- Test with multiple batches
- Verify staging table query performance

---

## 2. Batch Upload Service (Enhancement #6 Completion)

**Priority**: MEDIUM  
**Complexity**: MEDIUM  
**Estimated Time**: 2-3 hours  
**Status**: Backend Models Ready

### Description
Complete the batch upload feature by implementing the service layer and UI for uploading multiple CSV files at once.

### Requirements

1. **Backend Service**
   - Create `BatchUploadService` in `backend/app/modules/upload/`
   - Process multiple files in queue
   - Track batch progress
   - Handle individual file failures gracefully

2. **Frontend UI**
   - Multi-file upload interface
   - File queue display with status
   - Progress tracking per file
   - Batch summary (X of Y completed)

3. **API Endpoints**
   - POST `/api/upload/batch` - Upload multiple files
   - GET `/api/upload/batch/{batch_id}/progress` - Get batch progress
   - GET `/api/upload/batch/{batch_id}/summary` - Get batch summary

### Benefits
- Upload multiple files at once
- Save time for bulk conversions
- Track progress across multiple files

---

## 3. Advanced Validation Rules

**Priority**: MEDIUM  
**Complexity**: MEDIUM  
**Estimated Time**: 2-3 hours  
**Status**: Not Started

### Description
Extend validation rule types beyond REFERENCE_EXISTS and REQUIRED_OVERRIDE.

### New Rule Types

1. **NUMERIC_COMPARISON**
   - Compare numeric fields (>, <, >=, <=, ==, !=)
   - Example: Amount > 0, Quantity >= 1

2. **DATE_COMPARISON**
   - Compare date fields
   - Example: EndDate > StartDate, PostingDate <= Today

3. **CONDITIONAL_REQUIRED**
   - Field required based on another field's value
   - Example: If Type = "Invoice", InvoiceNumber is required

4. **REGEX_PATTERN**
   - Custom regex validation
   - Example: Email format, phone format

5. **CROSS_FIELD_VALIDATION**
   - Validate relationships between fields
   - Example: Debit + Credit = 0 for GL transactions

---

## 4. Rule Management UI

**Priority**: LOW  
**Complexity**: MEDIUM  
**Estimated Time**: 3-4 hours  
**Status**: Not Started

### Description
Web UI for managing validation rules without database access.

### Features
- View all validation rules
- Create new rules
- Edit existing rules
- Enable/disable rules
- Assign rules to business classes
- Test rules against sample data

---

## 5. Enhanced Dashboard

**Priority**: LOW  
**Complexity**: LOW  
**Estimated Time**: 2-3 hours  
**Status**: Not Started

### Description
Improve the main dashboard with analytics and insights.

### Features
- Conversion history chart
- Success rate trends
- Most common errors
- Processing time metrics
- Recent jobs list
- Quick actions

---

## 6. Export Mapping Configuration

**Priority**: LOW  
**Complexity**: LOW  
**Estimated Time**: 1 hour  
**Status**: Not Started

### Description
Export mapping configuration as JSON/Excel for documentation or sharing.

### Features
- Export current mapping as JSON
- Export as Excel with field descriptions
- Import mapping from JSON
- Share mappings between users

---

## 7. Field Transformation Rules

**Priority**: LOW  
**Complexity**: HIGH  
**Estimated Time**: 4-5 hours  
**Status**: Not Started

### Description
Apply transformations to field values during mapping.

### Transformation Types
- Case conversion (UPPER, lower, Title)
- Date format conversion
- Number format conversion
- String concatenation
- String splitting
- Lookup/replace values
- Formula-based transformations

---

## Implementation Priority

1. **Post-Load Validation Report** (HIGH) - Most requested feature
2. **Batch Upload Service** (MEDIUM) - Backend ready, just needs service layer
3. **Advanced Validation Rules** (MEDIUM) - Extends existing functionality
4. **Rule Management UI** (LOW) - Nice to have
5. **Enhanced Dashboard** (LOW) - Analytics
6. **Export Mapping Configuration** (LOW) - Documentation
7. **Field Transformation Rules** (LOW) - Advanced feature

---

**Last Updated**: March 10, 2026  
**Maintained By**: Development Team
