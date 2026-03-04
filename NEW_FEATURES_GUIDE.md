# New Features Guide

## Overview

This guide covers the 3 new features added to complete the FSM Conversion Workbench (100% completion):

1. **Rule Management UI** - Create and manage custom validation rules
2. **Enhanced Dashboard** - View recent jobs and sync status
3. **Comprehensive E2E Testing** - Automated testing script

---

## 1. Rule Management UI

### Access
Navigate to **Validation Rules** from the sidebar menu.

### Features

#### View Rules
- See all validation rules with filtering by business class
- Rules show scope (GLOBAL or specific business class)
- Color-coded rule types:
  - Blue: REFERENCE_EXISTS
  - Orange: REQUIRED_OVERRIDE
  - Purple: NUMERIC_COMPARISON (future)
  - Green: DATE_COMPARISON (future)
  - Red: PATTERN_MATCH (future)

#### Create Rule
1. Click **+ Create Rule** button
2. Fill in the form:
   - **Rule Name**: Descriptive name (e.g., "Vendor Must Exist")
   - **Scope**: GLOBAL or specific business class
   - **Rule Type**: Select from available types
   - **Field Name**: Field to validate
   - **Reference Business Class**: For REFERENCE_EXISTS rules
   - **Error Message**: Custom error message (use {value} placeholder)
3. Click **Create Rule**

#### Enable/Disable Rules
- Toggle the checkbox next to each rule
- Enabled rules run during validation
- Disabled rules are skipped

#### Delete Rules
- Click the 🗑️ icon to delete a rule
- Confirmation required
- Deletes for all accounts

### Example: Create a Vendor Validation Rule

```
Rule Name: Vendor Must Exist
Scope: GLTransactionInterface
Rule Type: REFERENCE_EXISTS
Field Name: Vendor
Reference Business Class: Vendor
Error Message: Vendor '{value}' does not exist in FSM
```

---

## 2. Enhanced Dashboard

### Access
The Dashboard is the default landing page after login.

### New Features

#### Recent Jobs Table
- Shows last 10 conversion jobs
- Columns:
  - Business Class
  - Filename
  - Records (valid/total with error count)
  - Status (color-coded)
  - Created timestamp

#### Status Colors
- Gray: pending
- Blue: validating
- Green: validated, completed
- Orange: loading
- Red: failed

#### Last Sync Info
- Displays timestamp of last reference data sync
- Shows "Never" if no sync has been performed
- Located above the recent jobs table

#### Quick Actions
- **New Conversion**: Start a new conversion job
- **Setup Data**: Manage reference data sync
- **View Rules**: Access validation rules

---

## 3. Comprehensive E2E Testing

### Purpose
Automated testing script that validates the entire conversion workflow with performance metrics.

### Usage

#### Prerequisites
1. Backend server running on http://localhost:8000
2. Valid FSM credentials

#### Configuration
Edit `backend/test_e2e_comprehensive.py`:

```python
TEST_ACCOUNT = {
    "account_name": "E2E_Test_Account",
    "project_name": "E2E Testing",
    "tenant_id": "TAMICS10_AX1",
    "base_url": "https://mingle-ionapi.inforcloudsuite.com",
    "oauth_url": "https://mingle-sso.inforcloudsuite.com/TAMICS10_AX1/as/",
    "username": "your_saak_here",  # Replace with actual SAAK
    "password": "your_secret_here"  # Replace with actual secret
}
```

#### Run Tests

```bash
cd backend
python test_e2e_comprehensive.py
```

### Test Coverage

The script tests:

1. ✅ **Health Check** - Backend availability
2. ✅ **Create Account** - Account creation
3. ✅ **Login** - JWT authentication
4. ✅ **Fetch Schema** - Schema retrieval
5. ✅ **Sync Setup Data** - Reference data sync
6. ✅ **Upload File** - Large file upload (10,000 records)
7. ✅ **Auto-Mapping** - Field mapping
8. ✅ **Validation** - Streaming validation
9. ✅ **Export Errors** - Error CSV export
10. ✅ **Performance Metrics** - Records/second calculation

### Performance Targets

- **Target**: 500 records/second minimum
- **Expected**: 1,000 records/second with optimizations
- **Memory**: Constant ~100 MB (streaming architecture)

### Output

#### Console Output
```
================================================================================
FSM CONVERSION WORKBENCH - COMPREHENSIVE E2E TESTING
================================================================================

✅ Health Check: PASS (0.05s)
✅ Create Account: PASS (0.23s)
   Account ID: 5
✅ Login: PASS (0.12s)
   JWT token received
✅ Fetch Schema: PASS (1.45s)
   91 fields fetched
✅ Sync Setup Data: PASS (12.34s)
   5720 records synced
📝 Creating large test file (10,000 records)...
✅ Test file created: test_large_file.csv
✅ Upload File: PASS (0.89s)
   Job ID: 15
✅ Auto-Mapping: PASS (0.34s)
   6 fields mapped
✅ Validation: PASS (9.87s)
   Total: 10000, Valid: 9850, Invalid: 150
✅ Export Errors: PASS (0.23s)
   150 error rows exported
✅ Performance Metrics: PASS (0.01s)
   1013 records/second (target: 500)

================================================================================
TEST SUMMARY
================================================================================

Total Tests: 10
✅ Passed: 10
❌ Failed: 0
⏭️  Skipped: 0

Success Rate: 100.0%

Detailed results saved to: test_results_e2e.json
```

#### JSON Output
Results saved to `test_results_e2e.json`:

```json
[
  {
    "test": "Health Check",
    "status": "PASS",
    "message": "Backend is healthy",
    "duration": "0.05s",
    "timestamp": "2026-03-04T10:30:15.123456"
  },
  ...
]
```

### Troubleshooting

#### Backend Not Running
```
❌ Backend is not running. Please start the backend server.
```
**Solution**: Start backend with `python -m uvicorn app.main:app --reload`

#### Invalid Credentials
```
❌ Failed to login. Stopping tests.
```
**Solution**: Update TEST_ACCOUNT with valid FSM credentials

#### Performance Below Target
```
❌ Performance Metrics: FAIL
   450 records/second (below target: 500)
```
**Solution**: Check system resources, database performance, or reduce chunk size

---

## Backend API Endpoints

### Rules Management

#### Create Rule Template
```http
POST /api/rules/templates
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Vendor Must Exist",
  "business_class": "GLTransactionInterface",
  "rule_type": "REFERENCE_EXISTS",
  "field_name": "Vendor",
  "reference_business_class": "Vendor",
  "error_message": "Vendor '{value}' does not exist",
  "is_active": true
}
```

#### Get Rules with Assignments
```http
GET /api/rules/account/{account_id}?business_class=GLTransactionInterface
Authorization: Bearer {token}
```

#### Toggle Rule Assignment
```http
PUT /api/rules/assignments/{assignment_id}
Authorization: Bearer {token}
Content-Type: application/json

{
  "is_enabled": false
}
```

### Dashboard Data

#### Get Recent Jobs
```http
GET /api/upload/jobs/recent?limit=10
Authorization: Bearer {token}
```

#### Get Last Sync Time
```http
GET /api/snapshot/last-sync
Authorization: Bearer {token}
```

---

## Tips & Best Practices

### Rule Management
1. Start with GLOBAL rules for common validations
2. Create business class-specific rules for specialized logic
3. Use descriptive rule names for easy identification
4. Test rules with sample data before production use
5. Disable rules temporarily instead of deleting

### Dashboard Usage
1. Check last sync time before starting conversions
2. Monitor recent jobs for patterns in errors
3. Use status colors to quickly identify issues
4. Click job rows for detailed information (future enhancement)

### E2E Testing
1. Run tests after major changes
2. Use different record counts to test scalability
3. Save test results for performance tracking
4. Run tests in CI/CD pipeline (future enhancement)
5. Update credentials securely (use environment variables)

---

## Next Steps

### Recommended Workflow
1. **Setup**: Sync reference data from Setup Data page
2. **Rules**: Create custom validation rules if needed
3. **Convert**: Upload CSV and run conversion
4. **Monitor**: Check dashboard for job status
5. **Test**: Run E2E tests periodically

### Future Enhancements
- Click-through from dashboard to job details
- Rule templates library
- Performance monitoring dashboard
- Automated test scheduling
- Rule testing sandbox

---

## Support

For issues or questions:
1. Check `IMPLEMENTATION_STATUS.md` for current status
2. Review `TROUBLESHOOTING.md` for common issues
3. Check backend logs for detailed errors
4. Run E2E tests to validate system health

---

**Version**: 1.0  
**Last Updated**: March 4, 2026  
**Status**: All features complete (23/23 tasks)
