# Demo Preparation Checklist

**Demo Date**: Wednesday, March 4, 2026  
**Preparation Time**: 30 minutes before demo

---

## Pre-Demo Setup (30 minutes before)

### 1. Environment Setup (10 minutes)

#### Backend
```bash
cd backend
# Ensure database is initialized
python init_db.py

# Start backend server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Verify**: Open http://localhost:8000/docs - should see API documentation

#### Frontend
```bash
cd frontend
# Install dependencies (if not already done)
npm install

# Start frontend server
npm run dev
```

**Verify**: Open http://localhost:5173 - should see login page

### 2. Create Demo Account (5 minutes)

1. Open http://localhost:5173
2. Click "Create New Account"
3. Fill in form:
   - **Account Name**: `Demo_TRN`
   - **Project Name**: `FSM Demo Project`
   - **Tenant ID**: `[Your FSM Tenant ID]`
   - **FSM Base URL**: `[Your FSM Environment URL]`
   - **FSM Client ID**: `[Your OAuth2 Client ID]`
   - **FSM Client Secret**: `[Your OAuth2 Client Secret]`
   - **App Password**: `Demo123!`
4. Click "Create Account"
5. Login with `Demo_TRN` / `Demo123!`

**Verify**: Should see dashboard after login

### 3. Fetch Schema (2 minutes)

**Option A: Via API** (if you have Postman/curl)
```bash
# Get JWT token first
curl -X POST http://localhost:8000/api/accounts/login \
  -H "Content-Type: application/json" \
  -d '{"account_name":"Demo_TRN","password":"Demo123!"}'

# Use token to fetch schema
curl -X POST http://localhost:8000/api/schema/fetch \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"business_class":"GLTransactionInterface"}'
```

**Option B: Via Frontend** (if schema management page exists)
- Navigate to Schema page
- Enter `GLTransactionInterface`
- Click "Fetch Schema"

**Option C: Skip** (validation will fail gracefully)
- Demo will show error handling

### 4. Sync Snapshot Data (5 minutes)

**Note**: This requires real FSM connection. If not available, skip this step.

```bash
# Via API
curl -X POST http://localhost:8000/api/snapshot/sync \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"business_class":"GLTransactionInterface"}'
```

**Expected**: Syncs 5 dependency business classes:
- GeneralLedgerChartAccount
- AccountingEntity
- Ledger
- Currency
- FinanceEnterpriseGroup

**If skipped**: REFERENCE_EXISTS validation will fail (which is fine for demo)

### 5. Prepare Demo File (2 minutes)

**File**: `Import_Files/GLTransactionInterface_DEMO.csv`

**Contents**:
- 25 total records
- 20 valid records
- 5 records with intentional errors:
  - Row 6: Missing FinanceEnterpriseGroup (required field)
  - Row 9: Missing TransactionAmount (required field)
  - Row 10: Invalid AccountCode (reference does not exist)
  - Row 11: Invalid date format (13/45/2025)
  - Row 12: Invalid amount (ABC123)
  - Row 13: Invalid AccountingEntity (reference does not exist)

**Verify**: File exists and has correct format

### 6. Browser Setup (2 minutes)

1. Open Chrome/Edge in full screen (F11)
2. Clear browser cache (Ctrl+Shift+Delete)
3. Open http://localhost:5173
4. Login as `Demo_TRN`
5. Zoom to 100% (Ctrl+0)
6. Close all other tabs
7. Disable notifications

### 7. Backup Plan (2 minutes)

**If backend crashes**:
- Have backup terminal ready: `uvicorn app.main:app --reload`

**If frontend crashes**:
- Refresh browser (Ctrl+R)

**If FSM API fails**:
- Have screenshots of successful runs ready
- Explain: "This would normally connect to FSM, but for demo purposes..."

**If file upload fails**:
- Have smaller backup file ready (10 rows)

### 8. Final Checks (2 minutes)

- [ ] Backend running (http://localhost:8000/health returns 200)
- [ ] Frontend running (http://localhost:5173 loads)
- [ ] Demo account exists and can login
- [ ] Demo file exists (`Import_Files/GLTransactionInterface_DEMO.csv`)
- [ ] Browser in full screen, no distractions
- [ ] Backup terminals ready
- [ ] Water/coffee ready
- [ ] Demo script printed/open

---

## Demo Flow Quick Reference

### Step 1: Login (30 seconds)
- Show account dropdown
- Login as `Demo_TRN`
- Point out environment badge (TRN = blue)

### Step 2: New Conversion (1 minute)
- Click "New Conversion"
- Enter business class: `GLTransactionInterface`
- Upload `GLTransactionInterface_DEMO.csv`
- Click "Upload & Auto-Map"

### Step 3: Mapping Review (2 minutes)
- Show auto-mapping results
- Point out confidence scores
- Manually adjust 1 mapping (for demo purposes)
- Enable validation rules
- Click "Start Validation"

### Step 4: Validation Progress (1 minute)
- Watch progress bar
- Show chunk processing
- Wait for completion

### Step 5: Validation Results (3 minutes)
- Show summary (20 valid, 5 invalid)
- Show top errors table
- Click "View Errors"
- Filter by error type
- Click "Export Errors"
- Open CSV in Excel

### Step 6: Load (Optional - 2 minutes)
- Show "Load to FSM" section
- Check "Trigger Interface"
- Click "Load to FSM"
- Show success counts

### Step 7: Q&A (5-10 minutes)
- Answer questions
- Show additional features if time permits

---

## Talking Points Cheat Sheet

### Opening
- "Local-first tool for FSM data conversion"
- "Built for Infor consultants"
- "Handles millions of records"

### Upload
- "Business class auto-detected from filename"
- "Streaming architecture - never loads entire file"

### Mapping
- "Intelligent auto-mapping with confidence scores"
- "Exact match + fuzzy matching"
- "Manual override available"

### Validation
- "Schema validation + custom business rules"
- "Processes in chunks for performance"
- "Errors persisted incrementally"

### Results
- "Top errors help identify systemic issues"
- "Export for sharing with data teams"
- "Filter by type or field"

### Load
- "Only valid records loaded"
- "Chunked loading prevents timeouts"
- "Trigger interface option"

---

## Troubleshooting During Demo

### Backend Error
**Symptom**: API returns 500 error  
**Action**: Check terminal for error message, restart if needed

### Frontend Error
**Symptom**: White screen or React error  
**Action**: Refresh browser (Ctrl+R)

### Upload Fails
**Symptom**: File upload returns error  
**Action**: Check file format, try smaller file

### Validation Hangs
**Symptom**: Progress bar stuck  
**Action**: Check backend terminal for errors, may need to restart

### No Errors Shown
**Symptom**: All records valid (unexpected)  
**Action**: Verify using correct demo file with errors

---

## Post-Demo Actions

1. **Collect Feedback**
   - What features are most valuable?
   - What's missing?
   - Would you use this?

2. **Share Resources**
   - SETUP_GUIDE.md
   - GitHub repo (if available)
   - Contact info for questions

3. **Schedule Follow-ups**
   - Individual demos if requested
   - Training sessions
   - Beta testing

4. **Document Issues**
   - Bugs found during demo
   - Feature requests
   - Performance issues

---

## Success Criteria

Demo is successful if:
- ✅ Complete flow demonstrated (upload → validate → load)
- ✅ Error handling shown (intentional errors in demo file)
- ✅ Performance demonstrated (streaming, chunking)
- ✅ At least 2-3 consultants express interest
- ✅ No major crashes or bugs
- ✅ Questions answered confidently

---

## Emergency Contacts

- **Technical Support**: [Your contact]
- **FSM Environment Issues**: [FSM admin contact]
- **Demo Backup**: [Colleague who can help]

---

**Good luck! You've got this! 🚀**
