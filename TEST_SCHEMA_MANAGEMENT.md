# Schema Management UI - Testing Guide

**Date**: March 4, 2026  
**Feature**: Schema Management Page  
**Status**: Ready for Testing

---

## Prerequisites

1. Backend server running on http://localhost:8000
2. Frontend server running on http://localhost:5173
3. Valid FSM account configured
4. Database initialized with migration

---

## Test Scenarios

### Scenario 1: Access Schema Management Page

**Steps**:
1. Open http://localhost:5173
2. Login with valid credentials
3. Click "Schema Management" (📐) button in sidebar

**Expected Result**:
- Page loads without errors
- Title: "Schema Management"
- Upload section visible
- Schema list section visible (may be empty)

**Pass Criteria**:
- ✅ No console errors
- ✅ Page renders correctly
- ✅ Navigation button highlighted

---

### Scenario 2: View Empty State

**Steps**:
1. Navigate to Schema Management page
2. Observe the schema list section

**Expected Result** (if no schemas exist):
- Empty state message: "No schemas found"
- Instructions: "Upload a Swagger file to get started"
- Upload section prominently displayed

**Pass Criteria**:
- ✅ Empty state displays correctly
- ✅ User guidance is clear

---

### Scenario 3: Upload Swagger File

**Steps**:
1. Navigate to Schema Management page
2. Enter business class name: "GLTransactionInterface"
3. Click "Choose File" or drag-and-drop
4. Select file: `FSM_Swagger/Conversion/GLTransactionInterface.json`
5. Click "Upload Swagger"

**Expected Result**:
- Upload progress indicator appears
- Success message: "Schema imported successfully"
- Schema appears in list immediately
- Upload form resets

**Pass Criteria**:
- ✅ File uploads without errors
- ✅ Success feedback displayed
- ✅ Schema list refreshes automatically
- ✅ New schema visible in table

---

### Scenario 4: View Schema List

**Steps**:
1. After uploading schema, observe the schema list table

**Expected Result**:
- Table displays with columns:
  - Business Class: "GLTransactionInterface"
  - Version: 1 (or higher if re-uploaded)
  - Fields: ~91 (total fields)
  - Required: ~7 (required fields)
  - Operations: "createUnreleased, createReleased" (or similar)
  - Source: Badge with "Imported" (orange)
  - Created: Timestamp

**Pass Criteria**:
- ✅ All columns display correct data
- ✅ Source badge shows correct color
- ✅ Field counts are accurate
- ✅ Operations list is correct

---

### Scenario 5: Upload Duplicate Schema

**Steps**:
1. Upload the same Swagger file again
2. Use same business class name

**Expected Result**:
- Upload succeeds
- Message: "Schema already exists (no changes detected)"
- Version number does NOT increment
- Schema list shows same version

**Pass Criteria**:
- ✅ No duplicate schema created
- ✅ Version detection working
- ✅ User informed of no changes

---

### Scenario 6: Upload Multiple Business Classes

**Steps**:
1. Upload GLTransactionInterface swagger
2. Upload another business class (e.g., PayablesInvoice)
3. Observe schema list

**Expected Result**:
- Both schemas appear in list
- Sorted by business class name
- Each has independent version numbers

**Pass Criteria**:
- ✅ Multiple schemas supported
- ✅ Sorting works correctly
- ✅ No conflicts between schemas

---

### Scenario 7: Test Source Badges

**Steps**:
1. Upload a swagger file (Source: "Imported" - orange)
2. Fetch schema from FSM API (Source: "FSM" - green)
3. Use local swagger file (Source: "Local" - blue)

**Expected Result**:
- Each source type shows different badge color
- Badge text matches source type

**Pass Criteria**:
- ✅ Imported: Orange badge
- ✅ FSM: Green badge
- ✅ Local: Blue badge

---

### Scenario 8: Error Handling - Invalid File

**Steps**:
1. Try to upload a non-JSON file (e.g., .txt, .csv)
2. Observe error handling

**Expected Result**:
- Error message displayed
- User-friendly error text
- Upload form remains functional

**Pass Criteria**:
- ✅ Error caught and displayed
- ✅ No application crash
- ✅ User can retry

---

### Scenario 9: Error Handling - Missing Business Class

**Steps**:
1. Leave business class field empty
2. Try to upload file

**Expected Result**:
- Validation error: "Business class is required"
- Upload prevented
- Field highlighted

**Pass Criteria**:
- ✅ Validation works
- ✅ Clear error message
- ✅ Form prevents submission

---

### Scenario 10: Sidebar Collapsed Mode

**Steps**:
1. Click sidebar collapse button (‹)
2. Observe Schema Management button
3. Click button to navigate

**Expected Result**:
- Button shows only icon (📐)
- Tooltip shows "Schema Management"
- Navigation still works

**Pass Criteria**:
- ✅ Icon visible in collapsed mode
- ✅ Tooltip displays on hover
- ✅ Navigation functional

---

## API Testing

### Test GET /api/schema/list

**Request**:
```bash
curl -X GET "http://localhost:8000/api/schema/list" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Expected Response**:
```json
{
  "schemas": [
    {
      "id": 1,
      "business_class": "GLTransactionInterface",
      "version": 1,
      "version_hash": "abc123...",
      "source": "Imported",
      "created_at": "2026-03-04T10:30:00",
      "fields_count": 91,
      "required_fields_count": 7,
      "operations": ["createUnreleased", "createReleased"]
    }
  ]
}
```

**Pass Criteria**:
- ✅ Status: 200 OK
- ✅ Response format matches
- ✅ Account-level filtering applied

---

### Test POST /api/schema/import-swagger

**Request**:
```bash
curl -X POST "http://localhost:8000/api/schema/import-swagger" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "business_class=GLTransactionInterface" \
  -F "swagger_file=@FSM_Swagger/Conversion/GLTransactionInterface.json"
```

**Expected Response**:
```json
{
  "business_class": "GLTransactionInterface",
  "version": 1,
  "new_schema": true,
  "fields_count": 91,
  "required_fields": 7,
  "operations": ["createUnreleased", "createReleased"],
  "schema_hash": "abc123...",
  "schema_id": 1
}
```

**Pass Criteria**:
- ✅ Status: 200 OK
- ✅ Schema created in database
- ✅ Version number correct
- ✅ Hash computed correctly

---

## Browser Console Checks

### No Errors Expected

Open browser console (F12) and verify:
- ✅ No red errors
- ✅ No failed API calls (check Network tab)
- ✅ No React warnings
- ✅ API responses are 200 OK

### Expected Console Logs

You may see:
- API request logs (if logging enabled)
- React component mount/unmount logs
- Navigation state changes

---

## Database Verification

### Check Schemas Table

```sql
SELECT 
  id, 
  business_class, 
  version, 
  source, 
  created_at,
  LENGTH(required_fields_json) as required_count,
  LENGTH(operations_json) as operations_count
FROM schemas
WHERE account_id = YOUR_ACCOUNT_ID
ORDER BY business_class, version DESC;
```

**Expected Result**:
- Schemas exist for uploaded business classes
- Version numbers are sequential
- Source field populated correctly
- JSON fields contain data

---

## Performance Checks

### Page Load Time
- ✅ Schema list loads in < 1 second
- ✅ Upload completes in < 3 seconds
- ✅ No UI freezing during operations

### Memory Usage
- ✅ No memory leaks on repeated navigation
- ✅ File upload doesn't cause memory spike

---

## Accessibility Checks

### Keyboard Navigation
- ✅ Tab through form fields
- ✅ Enter key submits form
- ✅ Escape key closes modals (if any)

### Screen Reader
- ✅ Form labels are readable
- ✅ Error messages announced
- ✅ Success messages announced

---

## Test Results Template

```
Date: ___________
Tester: ___________

Scenario 1: Access Page          [ ] Pass [ ] Fail
Scenario 2: Empty State           [ ] Pass [ ] Fail
Scenario 3: Upload Swagger        [ ] Pass [ ] Fail
Scenario 4: View List             [ ] Pass [ ] Fail
Scenario 5: Duplicate Upload      [ ] Pass [ ] Fail
Scenario 6: Multiple Classes      [ ] Pass [ ] Fail
Scenario 7: Source Badges         [ ] Pass [ ] Fail
Scenario 8: Invalid File          [ ] Pass [ ] Fail
Scenario 9: Missing Field         [ ] Pass [ ] Fail
Scenario 10: Collapsed Sidebar    [ ] Pass [ ] Fail

API Tests:
GET /api/schema/list              [ ] Pass [ ] Fail
POST /api/schema/import-swagger   [ ] Pass [ ] Fail

Overall Status: [ ] All Pass [ ] Some Failures

Notes:
_________________________________________________
_________________________________________________
_________________________________________________
```

---

## Troubleshooting

### Issue: Schema list not loading

**Solution**:
1. Check backend logs for errors
2. Verify JWT token is valid
3. Check Network tab for failed requests
4. Verify account_id is correct

### Issue: Upload fails

**Solution**:
1. Verify file is valid JSON
2. Check file size (should be < 10MB)
3. Verify business class name is correct
4. Check backend logs for detailed error

### Issue: Source badge wrong color

**Solution**:
1. Check schema.source field in database
2. Verify badge color mapping in SchemaManagement.tsx
3. Refresh page to reload data

---

**Testing Complete**: Mark all scenarios as Pass/Fail  
**Report Issues**: Document any failures with screenshots  
**Next Steps**: Fix issues and retest
