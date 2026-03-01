# FSM Conversion Workbench - Demo Script

**Demo Date**: Wednesday, March 4, 2026  
**Duration**: 15-20 minutes  
**Audience**: Technical and functional consultants (Infor employees)

---

## Pre-Demo Checklist

- [ ] Backend running: `uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`
- [ ] Frontend running: `npm run dev` (http://localhost:5173)
- [ ] Demo account created: `Demo_TRN`
- [ ] FSM credentials configured and tested
- [ ] Sample CSV prepared with intentional errors
- [ ] Snapshot data synced for GLTransactionInterface dependencies
- [ ] Browser window ready (full screen, no distractions)

---

## Demo Flow (15 minutes)

### 1. Introduction (2 minutes)

**Talking Points**:
- "This is the FSM Conversion Workbench - a local-first tool for data conversion"
- "Built specifically for Infor consultants to streamline data migration projects"
- "Handles everything from field mapping to validation to FSM loading"
- "Can process millions of records without crashing"

**Show**:
- Architecture diagram (if available)
- Mention: FastAPI backend, React frontend, SQLite database

---

### 2. Account Login (1 minute)

**Action**:
1. Open http://localhost:5173
2. Show account dropdown with `Demo_TRN`
3. Enter password
4. Click "Login"

**Talking Points**:
- "Each account represents one Project + Tenant combination"
- "FSM credentials are encrypted using Fernet encryption"
- "Environment badge shows TRN (blue), TST (yellow), or PRD (red)"

**Show**:
- Dashboard with quick actions
- Sidebar navigation
- Environment badge (TRN = blue)

---

### 3. New Conversion Workflow (10 minutes)

#### 3.1 File Upload (2 minutes)

**Action**:
1. Click "New Conversion"
2. Enter business class: `GLTransactionInterface`
3. Upload sample CSV file
4. Click "Upload & Auto-Map"

**Talking Points**:
- "Business class can be auto-detected from filename"
- "File is streamed in chunks - never fully loaded into memory"
- "This allows processing of millions of records"
- "System immediately starts analyzing the file structure"

**Show**:
- File upload interface
- Business class input
- Upload progress

#### 3.2 Field Mapping (3 minutes)

**Action**:
1. Review auto-generated mappings
2. Point out confidence scores (exact, high, medium, low, unmapped)
3. Manually adjust 1-2 mappings using dropdowns
4. Show "Enable Validation Rules" checkbox
5. Click "Start Validation"

**Talking Points**:
- "Auto-mapping uses exact match + Levenshtein distance fuzzy matching"
- "Confidence scores help identify which mappings need review"
- "Green = exact match, Yellow = fuzzy match, Red = unmapped"
- "You can manually override any mapping"
- "Mappings can be saved as templates for reuse"
- "Validation rules include schema checks + custom business rules"

**Show**:
- Mapping grid with source columns and target fields
- Confidence badges
- Dropdown for manual override
- Enable rules checkbox

#### 3.3 Validation Progress (2 minutes)

**Action**:
1. Watch real-time progress bar
2. Show chunk processing (e.g., "Chunk 5 of 10")
3. Wait for validation to complete

**Talking Points**:
- "Validation runs in streaming fashion - chunk by chunk"
- "Progress updates in real-time"
- "System validates against FSM schema + custom rules"
- "Errors are persisted incrementally - no data loss if process crashes"

**Show**:
- Progress bar
- Chunk counter
- Valid/Invalid record counts updating

#### 3.4 Validation Results (3 minutes)

**Action**:
1. Show validation summary
2. Point out success rate
3. Show "Top 10 Most Common Errors" table
4. Click "View Errors"
5. Apply filter (e.g., filter by error type "required")
6. Click "Export Errors (CSV)"
7. Open exported CSV in Excel/Notepad

**Talking Points**:
- "Summary shows overall data quality"
- "Top errors help identify systemic issues"
- "You can filter errors by type or field name"
- "Export errors as CSV for sharing with data team"
- "Each error shows: row number, field, invalid value, error type, message"

**Show**:
- Validation summary card
- Top errors table with color-coded error types
- Error details table
- Filter inputs
- CSV export

---

### 4. Load to FSM (2 minutes)

**Action**:
1. Scroll to "Load to FSM" section
2. Show "Trigger Interface After Load" checkbox
3. Click "Load to FSM"
4. Wait for completion
5. Show success/failure counts

**Talking Points**:
- "Only valid records are loaded - invalid rows are skipped"
- "Data is sent to FSM in chunks (default 100 records per batch)"
- "This prevents timeout errors with large datasets"
- "Trigger interface option runs FSM business logic after load"
- "Load results are tracked per chunk for troubleshooting"

**Show**:
- Load section
- Trigger interface checkbox
- Load button
- Success/failure counts

---

### 5. Key Features Recap (1 minute)

**Talking Points**:
- "Let me recap the key capabilities:"
  1. **Streaming Architecture**: Handles millions of records without memory issues
  2. **Intelligent Auto-Mapping**: Saves hours of manual mapping work
  3. **Dynamic Schema Validation**: Works with any FSM business class
  4. **Custom Rules**: REFERENCE_EXISTS checks, required field overrides
  5. **Error Export**: Easy sharing with data teams
  6. **Batch Loading**: Reliable loading with progress tracking
  7. **Account Isolation**: Multiple projects/tenants in one tool

---

## Q&A Preparation

### Expected Questions

**Q: Can it handle 2 million records?**  
A: Yes! The streaming architecture processes files in chunks. We've designed it to handle millions of records without loading the entire file into memory.

**Q: What business classes are supported?**  
A: Any FSM business class with an OpenAPI schema. The system dynamically fetches the schema and validates against it. We've tested with GLTransactionInterface, but it works with PayablesInvoice, Vendor, Customer, etc.

**Q: Can we add custom validation rules?**  
A: Yes! The rule engine supports multiple rule types. Currently implemented: REFERENCE_EXISTS (checks if referenced records exist) and REQUIRED_OVERRIDE (custom required field rules). The architecture supports adding more rule types.

**Q: How are FSM credentials stored?**  
A: Credentials are encrypted using Fernet encryption before storage. The encryption key is stored separately in environment variables.

**Q: Can we use this for multiple clients?**  
A: Absolutely! Each account is isolated. You can have separate accounts for different projects/tenants. Data never crosses account boundaries.

**Q: What if validation fails midway?**  
A: Errors are persisted incrementally as they're found. If the process crashes, you don't lose any error data. You can resume or restart validation.

**Q: Can we save mapping templates?**  
A: Yes! Mapping templates can be saved and reused for similar files. This is especially useful for recurring data loads.

**Q: Does it work offline?**  
A: The tool runs locally (localhost), but it needs internet access to communicate with FSM APIs for schema fetching, snapshot sync, and data loading.

**Q: What about data cleansing?**  
A: The validation layer identifies data quality issues. You can export errors, fix the source data, and re-upload. Future enhancements could include automated cleansing rules.

**Q: Can we customize the UI?**  
A: Yes! The UI is built with React and uses a theme system. Colors, layouts, and components can be customized.

---

## Demo Tips

### Do's
- ✅ Keep the pace steady - not too fast, not too slow
- ✅ Explain WHY features matter (e.g., "streaming prevents crashes")
- ✅ Show real errors in the validation results
- ✅ Emphasize time savings vs. manual processes
- ✅ Highlight enterprise-grade architecture

### Don'ts
- ❌ Don't rush through the mapping step - it's a key differentiator
- ❌ Don't skip the error export - consultants love this feature
- ❌ Don't use a tiny sample file - show it can handle scale
- ❌ Don't ignore questions - pause and address them
- ❌ Don't claim it's "finished" - position as "production-ready MVP"

---

## Backup Plan

If something goes wrong during the demo:

1. **Backend crashes**: Have a backup terminal ready to restart
2. **Frontend crashes**: Refresh browser (state is in backend)
3. **FSM API fails**: Have screenshots of successful runs
4. **File upload fails**: Have a smaller backup file ready
5. **Validation takes too long**: Use a smaller sample file (1000 rows)

---

## Post-Demo Actions

1. Share SETUP_GUIDE.md with interested consultants
2. Collect feedback on missing features
3. Schedule follow-up demos if needed
4. Document any bugs found during demo
5. Plan next iteration based on feedback

---

## Success Metrics

Demo is successful if:
- ✅ Audience understands the value proposition
- ✅ At least 2-3 consultants want to try it
- ✅ No major bugs encountered
- ✅ Questions are answered confidently
- ✅ Feedback is positive overall

---

**Good luck with the demo! 🚀**
