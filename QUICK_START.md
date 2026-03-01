# Quick Start Guide - FSM Conversion Workbench

**Goal**: Get the workbench running in 10 minutes

---

## Prerequisites

- Python 3.9+ installed
- Node.js 16+ installed
- Git (optional)

---

## Step 1: Install Backend Dependencies (2 minutes)

```bash
cd backend
pip install -r requirements.txt
```

**Expected output**: All packages installed successfully

---

## Step 2: Initialize Database (1 minute)

```bash
python init_db.py
```

**Expected output**: 
```
Database initialized successfully!
Created tables:
- accounts
- schemas
- snapshot_records
- snapshot_registry
- conversion_jobs
- validation_errors
- load_results
- mapping_templates
- validation_rule_templates
- validation_rule_assignments
```

---

## Step 3: Start Backend Server (1 minute)

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Expected output**:
```
INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     Application startup complete.
```

**Verify**: Open http://localhost:8000/docs in browser - should see API documentation

**Keep this terminal open!**

---

## Step 4: Install Frontend Dependencies (3 minutes)

Open a **new terminal**:

```bash
cd frontend
npm install
```

**Expected output**: All packages installed successfully

---

## Step 5: Start Frontend Server (1 minute)

```bash
npm run dev
```

**Expected output**:
```
VITE v5.0.11  ready in 500 ms

➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

**Verify**: Open http://localhost:5173 in browser - should see login page

**Keep this terminal open!**

---

## Step 6: Create Demo Account (2 minutes)

1. Open http://localhost:5173
2. Click "Create New Account"
3. Fill in form:

```
Account Name: Demo_TRN
Project Name: Demo Project
Tenant ID: demo_tenant
FSM Base URL: https://your-fsm-url.com
FSM Client ID: your_client_id
FSM Client Secret: your_client_secret
App Password: Demo123!
```

4. Click "Create Account"
5. Login with `Demo_TRN` / `Demo123!`

**Expected**: Dashboard appears with "New Conversion" button

---

## Step 7: Test File Upload (Optional - 2 minutes)

1. Click "New Conversion"
2. Enter business class: `GLTransactionInterface`
3. Upload file: `Import_Files/GLTransactionInterface_DEMO.csv`
4. Click "Upload & Auto-Map"

**Expected**: Mapping page appears with auto-detected field mappings

---

## ✅ Success!

You now have:
- ✅ Backend running on http://localhost:8000
- ✅ Frontend running on http://localhost:5173
- ✅ Demo account created
- ✅ Ready to test full workflow

---

## Next Steps

### Test Full Workflow
1. Upload demo file
2. Review mappings
3. Start validation
4. View errors
5. Export errors

### Read Documentation
- `SETUP_GUIDE.md` - Detailed setup instructions
- `DEMO_SCRIPT.md` - Demo walkthrough
- `DEMO_PREPARATION.md` - Pre-demo checklist

### Prepare for Demo
- Configure real FSM credentials
- Test with real FSM environment
- Practice demo flow

---

## Troubleshooting

### Backend won't start
**Error**: `ModuleNotFoundError: No module named 'fastapi'`  
**Fix**: Run `pip install -r requirements.txt` in backend folder

**Error**: `Database not found`  
**Fix**: Run `python init_db.py` in backend folder

### Frontend won't start
**Error**: `Cannot find module 'react'`  
**Fix**: Run `npm install` in frontend folder

**Error**: `Port 5173 already in use`  
**Fix**: Kill process on port 5173 or use different port

### Login fails
**Error**: `Account not found`  
**Fix**: Create account first using "Create New Account" button

**Error**: `Invalid password`  
**Fix**: Check password (case-sensitive, min 8 chars)

### Upload fails
**Error**: `File not found`  
**Fix**: Ensure file exists in `Import_Files/` folder

**Error**: `Invalid file format`  
**Fix**: Ensure file is CSV format

---

## Quick Commands Reference

### Backend
```bash
# Install dependencies
pip install -r requirements.txt

# Initialize database
python init_db.py

# Start server
uvicorn app.main:app --reload

# Run tests
python test_validation.py
python test_e2e.py
```

### Frontend
```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build
```

---

## URLs

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs
- **Health Check**: http://localhost:8000/health

---

## Demo Data

**File**: `Import_Files/GLTransactionInterface_DEMO.csv`

**Contents**:
- 25 total records
- 20 valid records
- 5 records with errors (for demo purposes)

**Errors**:
- Row 6: Missing required field
- Row 9: Missing required field
- Row 10: Invalid reference
- Row 11: Invalid date format
- Row 12: Invalid number format
- Row 13: Invalid reference

---

## Need Help?

1. Check `SETUP_GUIDE.md` for detailed instructions
2. Check `FINAL_STATUS.md` for implementation status
3. Check terminal output for error messages
4. Check browser console for frontend errors

---

**You're all set! 🚀**
