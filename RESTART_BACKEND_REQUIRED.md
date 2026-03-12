# Backend Restart Required

## Issue
The new endpoint `GET /api/schema/{business_class}/fields` is returning 404 because the backend server needs to be restarted to pick up the new route.

## Solution

### Option 1: Quick Restart (Recommended)
```powershell
# Kill all Python processes
Get-Process python -ErrorAction SilentlyContinue | Stop-Process -Force

# Clear Python cache
Get-ChildItem -Path backend/app -Recurse -Directory -Filter "__pycache__" | Remove-Item -Recurse -Force

# Start backend server
cd backend
python -m uvicorn app.main:app --reload
```

### Option 2: Manual Restart
1. Stop the backend server (Ctrl+C in the terminal running uvicorn)
2. Start it again:
   ```powershell
   cd backend
   python -m uvicorn app.main:app --reload
   ```

## Verification

After restarting, test the endpoint:

1. Open browser to: http://localhost:8000/docs
2. Find the endpoint: `GET /api/schema/{business_class}/fields`
3. Try it with `business_class = "Account"`
4. Should return a list of field names

Or test in the UI:
1. Open http://localhost:5173
2. Navigate to Validation Rules
3. Select a business class (e.g., GLTransactionInterface)
4. Click "View" on a rule set
5. Click "+" to add a rule
6. Select "REFERENCE_EXISTS" as rule type
7. Select "Account" from Reference Business Class dropdown
8. The Reference Field Name dropdown should now load fields from Account schema

## What Was Added

**New Endpoint**: `GET /api/schema/{business_class}/fields`

**Purpose**: Returns all field names from the latest schema for a business class

**Response Example**:
```json
{
  "business_class": "Account",
  "field_count": 15,
  "fields": [
    "Account",
    "AccountCode",
    "AccountDescription",
    "AccountType",
    "ActiveStatus",
    ...
  ]
}
```

**Used By**: Reference Field Name dropdown in Add Rule modal (REFERENCE_EXISTS rules)
