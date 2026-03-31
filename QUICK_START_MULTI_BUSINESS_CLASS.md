# Quick Start: Multi-Business-Class Feature

## What It Does

Automatically detects FSM business class structure from CSV filename and displays:
- Structure type (Single Table / Multiple Tables)
- Table count
- Related tables with roles (header, lines, distributions, etc.)
- Confidence level

## Setup (One-Time)

### 1. Database Setup
```bash
cd backend
python migrate_add_business_class_registry.py
python import_business_class_data.py
```

**Expected Output:**
```
✅ Migration completed successfully
✅ Import completed successfully
📊 Registry Statistics:
   Total records: 255
   Single table: 85
   Multiple tables: 170
```

### 2. Verify Data
```bash
python verify_registry_data.py
```

## Usage

### 1. Start Servers
```bash
# Terminal 1 - Backend
cd backend
python -m uvicorn app.main:app --reload

# Terminal 2 - Frontend
cd frontend
npm run dev
```

### 2. Upload a File
1. Open http://localhost:5173
2. Navigate to Conversion Workflow
3. Select a CSV file (e.g., `PayablesInvoice_20250101.csv`)
4. Click "Upload File"

### 3. View Detection Results
After upload, you'll see:

```
🔍 Auto-Detection Results
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Business Class: PayablesInvoiceImport

Structure: [📑 Multiple Tables]  [8 tables]

Confidence: ⭐⭐⭐ High

Related Tables:                    [▶ Show Details]
```

Click "Show Details" to see all related tables with their roles.

## Test Files

### Single Table
- `GLTransactionInterface_20251128.csv`
- Expected: 3 tables (interface, edit, result)

### Multiple Tables
- `PayablesInvoice_20250101.csv`
- Expected: 8 tables (header, lines, distributions, etc.)

## API Testing

### Test Detection Endpoint
```bash
cd backend
python test_detection_api.py
```

### Manual API Test
```bash
curl -X POST "http://localhost:8000/api/upload/detect?filename=PayablesInvoice_20250101.csv"
```

## Troubleshooting

### Issue: "No such file or directory: fsm_business_classes..."
**Solution:** CSV files must be in workspace root directory

### Issue: Detection shows "Unknown" business class
**Solution:** 
- Check filename format (should start with business class name)
- Verify business class exists in registry
- Run `python verify_registry_data.py` to check

### Issue: Detection card doesn't appear
**Solution:**
- Check browser console for errors
- Verify backend is returning detection data
- Check response in Network tab

### Issue: Related tables list is empty
**Solution:**
- This is normal for single-table classes
- Only multiple-table classes show related tables

## Role Icons Reference

| Icon | Role | Example |
|------|------|---------|
| 📄 | header | Main table (PayablesInvoiceImport) |
| 📝 | lines | Detail lines (PayablesInvoiceDetailImport) |
| 💰 | distributions | GL distributions |
| 💬 | comments | Comment records |
| ❌ | errors | Error records |
| ✅ | results | Result/status records |
| 💳 | charges | Add-on charges |
| 💵 | payments | Payment records |
| 🏦 | funds | Fund allocations |
| ⚙️ | options | Configuration options |

## What's Next

### Current Status (75% Complete)
- ✅ Phase 1: Database & Detection Service
- ✅ Phase 2: API Integration
- ✅ Phase 3: Frontend Display
- ⏳ Phase 4: Multi-Table Load Support

### Phase 4 (Coming Soon)
- Multi-table load strategies
- Tabbed mapping UI for multiple tables
- Foreign key relationship handling
- Sequential loading (header → lines → distributions)

## Support

### Documentation
- `MULTI_BUSINESS_CLASS_SUMMARY.md` - Complete overview
- `PHASE_2_COMPLETE.md` - API details
- `PHASE_3_COMPLETE.md` - Frontend details
- `MULTI_BUSINESS_CLASS_ARCHITECTURE.md` - Architecture design

### Commands
```bash
# Verify registry data
cd backend
python verify_registry_data.py

# Test detection API
python test_detection_api.py

# Check backend logs
# Look for "Auto-detection result:" messages
```

---

**Quick Start Complete!** 🎉

The multi-business-class feature is now active and ready to use.
