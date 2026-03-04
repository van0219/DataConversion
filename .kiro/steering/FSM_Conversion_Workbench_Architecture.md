---
inclusion: fileMatch
fileMatchPattern: ['backend/**/*', 'frontend/**/*', 'src/**/*', '*.md']
---

# FSM Conversion Workbench Architecture

## System Type

Local-first web application (FastAPI + React + SQLite) for FSM data conversion. Runs on localhost, designed for Infor FSM consultants.

## Technology Stack

**Backend**: FastAPI 0.109.0, SQLAlchemy, SQLite, JWT auth, Fernet encryption, Pydantic validation

**Frontend**: React 18.2.0 + TypeScript, Vite 5.0.11, Axios, inline styles (black/red/white theme)

**Database**: SQLite with 10 tables (accounts, schemas, snapshot_records, snapshot_registry, setup_business_classes, conversion_jobs, validation_errors, load_results, mapping_templates, validation_rule_templates, validation_rule_assignments)

## Project Structure

```text
backend/
├── app/
│   ├── core/              # database.py, config.py, security.py, logging.py, dependency_config.py
│   ├── models/            # SQLAlchemy models (account, schema, snapshot, job, mapping, rule)
│   ├── services/          # Business logic (fsm_client, streaming_engine, mapping_engine, schema_validator, rule_executor, openapi_parser)
│   └── modules/           # API routers (accounts, schema, snapshot, upload, mapping, validation, load)
├── init_db.py             # Database initialization
├── requirements.txt
└── .env                   # JWT_SECRET_KEY, ENCRYPTION_KEY, DATABASE_URL

frontend/
├── src/
│   ├── pages/             # Login.tsx, ConversionWorkflow.tsx, ValidationDashboard.tsx, SetupDataManagement.tsx
│   ├── services/          # api.ts (Axios client with JWT interceptor)
│   └── App.tsx            # Main app with navigation
├── package.json
└── vite.config.ts
```

## Critical Design Patterns

### 1. Streaming Architecture (REQUIRED)

Use generator-based CSV processing to handle millions of records without memory overflow.

```python
# CORRECT: Generator-based streaming
def stream_csv(file_path: str, chunk_size: int = 1000):
    for chunk in pd.read_csv(file_path, chunksize=chunk_size):
        yield chunk

# WRONG: Loading entire file
df = pd.read_csv(file_path)  # Don't do this for large files
```

### 2. Account-Level Isolation (REQUIRED)

ALL database queries MUST filter by `account_id` for multi-tenant security.

```python
# CORRECT: Account-level filtering
jobs = db.query(ConversionJob).filter(ConversionJob.account_id == account_id).all()

# WRONG: Missing account filter
jobs = db.query(ConversionJob).all()  # Security violation
```

### 3. No eval() - Explicit Parsing (SECURITY)

NEVER use `eval()` for rule execution. Parse operators explicitly.

```python
# CORRECT: Explicit operator parsing
if operator == ">":
    return value > threshold
elif operator == ">=":
    return value >= threshold

# WRONG: Using eval()
eval(f"{value} {operator} {threshold}")  # Security risk
```

### 4. Encrypted Credentials (SECURITY)

FSM credentials MUST be encrypted before storing in database.

```python
# CORRECT: Encrypt before storing
encrypted = encryption.encrypt(credentials)
account.fsm_credentials = encrypted

# WRONG: Plaintext storage
account.fsm_credentials = credentials  # Security violation
```

### 5. Incremental Error Persistence (RELIABILITY)

Save validation errors incrementally (per chunk), not at the end.

```python
# CORRECT: Save errors per chunk
for chunk in stream_csv(file_path):
    errors = validate_chunk(chunk)
    db.bulk_insert_mappings(ValidationError, errors)
    db.commit()  # Commit per chunk

# WRONG: Save all at end
all_errors = []
for chunk in stream_csv(file_path):
    all_errors.extend(validate_chunk(chunk))
db.bulk_insert_mappings(ValidationError, all_errors)  # Risk data loss
```

### 6. Single Consolidated Snapshot Table (ARCHITECTURE)

Use ONE `snapshot_records` table for all business classes. Filter by `(account_id, business_class, primary_key)`.

```python
# CORRECT: Single table with business_class filter
records = db.query(SnapshotRecord).filter(
    SnapshotRecord.account_id == account_id,
    SnapshotRecord.business_class == "Vendor"
).all()

# WRONG: Dynamic table creation
table_name = f"snapshot_{business_class}"  # SQL injection risk
```

### 7. Schema Versioning (DATA INTEGRITY)

Use SHA256 hash of schema content to detect changes and invalidate mappings.

```python
# CORRECT: Hash-based versioning
schema_hash = hashlib.sha256(json.dumps(schema_content).encode()).hexdigest()
if existing_schema.version_hash != schema_hash:
    # Schema changed, invalidate mappings
    invalidate_mappings(account_id, business_class)
```

### 8. Local Swagger Files for Schema (RELIABILITY)

Use local swagger files as primary source for schema definitions, with FSM API as fallback.

```python
# CORRECT: Local-first schema loading
swagger_json = SchemaService._load_local_swagger(business_class)
if swagger_json:
    # Parse local swagger file (FSM_Swagger/Conversion/GLTransactionInterface.json or FSM_Swagger/Setup/Account.json)
    parsed_schema = SchemaService._parse_local_swagger(swagger_json, business_class)
else:
    # Fallback to FSM API
    openapi_json = await fsm_client.get_openapi_schema(business_class)
    parsed_schema = OpenAPIParser.parse_schema(openapi_json, business_class)

# WRONG: Only using FSM API
openapi_json = await fsm_client.get_openapi_schema(business_class)  # May fail or return incomplete data
```

### 9. Setup Business Classes Configuration (EXTENSIBILITY)

Store FSM setup class configurations in database with standardized endpoint format.

```python
# CORRECT: Database-driven configuration with _fields=_all and _limit=100000
setup_classes = db.query(SetupBusinessClass).filter(SetupBusinessClass.is_active == True).all()
for setup_class in setup_classes:
    # All endpoints use _fields=_all to return complete field sets
    # All endpoints use _limit=100000 to ensure all records are captured
    records = await fsm_client.fetch_setup_data(setup_class.endpoint_url)

# Standard endpoint format:
# soap/classes/{BusinessClass}/lists/{ListName}?_fields=_all&_limit=100000&_links=false&_pageNav=true&_out=JSON&_flatten=false

# WRONG: Hardcoded configuration
business_classes = ["Currency", "Vendor", "Customer"]  # Not extensible
```

**Key Requirements**:
- Always use `_fields=_all` to return all available fields (future-proof)
- Always use `_limit=100000` to ensure all records are captured
- List names vary by business class (DetailAccountList, Currencies, FlatList, etc.)
- User must specify correct list name when adding new setup classes

**Complete List of 12 Setup Classes**:

| Business Class | List Name | Key Field |
|----------------|-----------|-----------|
| Account | DetailAccountList | Account |
| AccountingEntity | PrimaryAccountingEntityList | AccountingEntity |
| Currency | Currencies | Currency |
| FinanceDimension1 | FinanceDimension1FlatList | FinanceDimension1 |
| FinanceDimension2 | FinanceDimension2FlatList | FinanceDimension2 |
| FinanceDimension3 | FinanceDimension3FlatList | FinanceDimension3 |
| FinanceDimension4 | FinanceDimension4FlatList | FinanceDimension4 |
| FinanceDimension5 | FinanceDimension5FlatList | FinanceDimension5 |
| FinanceEnterpriseGroup | FinanceEnterpriseGroupList | FinanceEnterpriseGroup |
| GeneralLedgerChartAccount | DetailAccountList | DisplayAccount |
| Ledger | PrimaryCloseLedgerList | Ledger |
| Project | ProjectFlatList | Project |

**JSON Schema Folder Format**:
- All setup classes use folder format (not single .json files)
- Each folder contains: `FSM_{BusinessClass}.schema.json` and `FSM_{BusinessClass}.properties.json`
- Key field extracted from `IdentifierPaths` in properties.json (uses last identifier)
- FinanceDimension classes auto-generate FlatList endpoint format
- Response format: List where index 0 is metadata, index 1+ are records with `_fields` wrapper

**Why _fields=_all and _limit=100000?**:
- `_fields=_all`: Returns all available fields (10-140 fields per class), future-proof against FSM schema changes
- `_limit=100000`: Ensures all records captured in single request, no pagination issues
- Benefits: Complete data, guaranteed capture, consistency, maintainability

### 10. Mapping Format Consistency (CRITICAL)

Frontend and backend must use consistent mapping formats. Frontend maintains TWO mapping structures for different purposes.

```typescript
// Frontend maintains two mapping structures:

// 1. UI state (FSM field → CSV column) - for display
const mapping: Record<string, string> = {
  "SequenceNumber": "Sequence",
  "Amount": "Amount"
};

// 2. Backend-compatible state (CSV column → FSM field object) - for API calls
const mappingData = {
  mapping: {
    "Sequence": {
      "fsm_field": "SequenceNumber",
      "confidence": "exact",
      "score": 0.0
    },
    "Amount": {
      "fsm_field": "Amount",
      "confidence": "exact",
      "score": 0.0
    }
  }
};

// CORRECT: Send backend-compatible format to validation
await api.post('/validation/start', {
  mapping: mappingData.mapping  // CSV → FSM format
});

// WRONG: Send UI state format
await api.post('/validation/start', {
  mapping: mapping  // FSM → CSV format - will cause "string indices" error
});
```

**Why Two Formats?**
- UI format (FSM → CSV): Easy to display which CSV column maps to each FSM field
- Backend format (CSV → FSM): Backend transforms CSV records by looking up each CSV column

**Keeping Them in Sync**: When user manually changes mapping, update BOTH structures:
```typescript
// Update UI state
updateMapping(fsmField, csvCol);

// Update backend-compatible state
setMappingData({
  ...mappingData,
  mapping: {
    ...mappingData.mapping,
    [csvCol]: {
      fsm_field: fsmField,
      confidence: 'manual',
      score: 0.0
    }
  }
});
```

## Code Conventions

### Backend (Python)

**Style**: PEP 8, type hints required, async/await for API endpoints

```python
# CORRECT: Type hints and async
async def get_account(account_id: int, db: Session) -> Account:
    return db.query(Account).filter(Account.id == account_id).first()

# Module structure (each module has 3 files)
modules/
├── accounts/
│   ├── router.py      # FastAPI routes
│   ├── service.py     # Business logic
│   └── schemas.py     # Pydantic models
```

**Error Handling**: Try-catch in all services, structured responses

```python
# CORRECT: Structured error handling
try:
    result = await service.process()
    return {"status": "success", "data": result}
except ValueError as e:
    raise HTTPException(status_code=400, detail=str(e))
except Exception as e:
    logger.error(f"Unexpected error: {e}")
    raise HTTPException(status_code=500, detail="Internal server error")
```

### Frontend (TypeScript/React)

**Style**: Strict TypeScript, functional components with hooks, inline styles

```typescript
// CORRECT: Typed functional component
interface Props {
  accountId: number;
  onComplete: () => void;
}

const ConversionWorkflow: React.FC<Props> = ({ accountId, onComplete }) => {
  const [loading, setLoading] = useState(false);
  // ...
};

// Theme colors (use consistently)
const colors = {
  background: '#000000',
  primary: '#dc2626',
  text: '#ffffff'
};
```

**API Calls**: Use Axios with JWT interceptor from `services/api.ts`

```typescript
// CORRECT: Use configured API client
import api from '../services/api';

const response = await api.post('/validation/start', { job_id });

// WRONG: Direct axios calls
import axios from 'axios';
axios.post('http://localhost:8000/validation/start', data);  // Don't do this
```

## Data Flow Patterns

### Conversion Workflow

1. **Upload**: Save CSV with `job_id` as filename → Extract headers/samples → Create `conversion_job`
2. **Auto-Map**: Fetch FSM schema → Exact match + fuzzy match (Levenshtein) → Return confidence scores
3. **Validate** (streaming): Stream chunks (1000 records) → Schema validation → Rule validation → Persist errors incrementally
4. **Review**: Display errors → Filter by type/field → Export CSV
5. **Load** (optional): Skip invalid rows → Batch create (100 records) → Store results

### Setup Data Sync Workflow

1. **Configure**: 12 FSM setup business classes configured in `setup_business_classes` table (all using `_fields=_all&_limit=100000`)
2. **Sync**: User clicks "Sync All Active Classes" → Backend fetches from FSM using account credentials
3. **Store**: Reference data stored in `snapshot_records` table (account-level isolation)
4. **Track**: Sync timestamps and record counts stored in `snapshot_registry` table
5. **Validate**: REFERENCE_EXISTS rules check against synced data (no FSM API calls during validation)

**Setup Classes** (12 total):
- Account, AccountingEntity, Currency
- FinanceDimension1-5, FinanceEnterpriseGroup
- GeneralLedgerChartAccount, Ledger, Project

**Endpoint Standard**: All use `_fields=_all&_limit=100000` for complete data capture

### Schema Fetching Workflow

1. **Request**: User clicks "Fetch Schema from FSM" for business class
2. **Local First**: Check `FSM_Swagger/Conversion/{business_class}.json` then `FSM_Swagger/Setup/{business_class}.json`
3. **Parse**: Extract `components.schemas.createAllFieldsMultipart` with 91+ fields
4. **Fallback**: If local file not found in either folder, call FSM API endpoint
5. **Store**: Compute SHA256 hash, store in `schemas` table with version number
6. **Use**: Schema used for auto-mapping and validation

### Validation Types

**Schema Validation**: required, type, enum, pattern, length, date format

**Rule Validation**: REFERENCE_EXISTS, REQUIRED_OVERRIDE (extensible for NUMERIC_COMPARISON, DATE_COMPARISON)

### Batch Sizes

- CSV streaming: 1000 records per chunk
- FSM API loading: 100 records per batch
- Database inserts: Bulk insert per chunk

## Security Requirements

### Authentication

- JWT tokens with 8-hour expiration
- Bcrypt password hashing (cost factor 12)
- Tokens stored in localStorage (frontend)
- Protected API endpoints with dependency injection

### Data Protection

- Fernet encryption for FSM credentials (symmetric encryption)
- Parameterized SQL queries (no string concatenation)
- No `eval()` or dynamic code execution
- File type validation (CSV only)
- Account-level data isolation

### Input Validation

- Pydantic validation on all API inputs
- Business class validation against known types
- File size limits (configurable)
- CSV header validation

## Performance Patterns

### Streaming

```python
# Use generators for large files
def stream_csv(file_path: str, chunk_size: int = 1000):
    for chunk in pd.read_csv(file_path, chunksize=chunk_size):
        yield chunk
```

### Database Indexing

```sql
-- Required indexes
CREATE INDEX idx_snapshot_lookup ON snapshot_records(account_id, business_class, primary_key);
CREATE INDEX idx_account_data ON conversion_jobs(account_id);
CREATE INDEX idx_job_errors ON validation_errors(conversion_job_id);
```

### Caching

- Reference data cached in rule executor (per request)
- Schema cached per request (not persisted)
- JWT tokens cached in frontend localStorage

## Common Tasks

### Setup and Run

```bash
# Backend setup
cd backend
pip install -r requirements.txt
python init_db.py
python -m uvicorn app.main:app --reload  # http://localhost:8000

# Frontend setup
cd frontend
npm install --legacy-peer-deps
npm run dev  # http://localhost:5173
```

### Testing

- **Backend health**: GET `http://localhost:8000/health`
- **API docs**: `http://localhost:8000/docs`
- **Unit tests**: `backend/test_validation.py`, `backend/test_e2e.py`
- **Manual testing**: Follow `TEST_RESULTS.md` in root

### Adding New Validation Rules

1. Add rule type to `validation_rule_templates` table
2. Implement logic in `backend/app/services/rule_executor.py`
3. Update `RuleExecutor.execute_rule()` method
4. Add tests in `test_validation.py`

### Adding New Business Class Support

1. Add OpenAPI schema to appropriate folder:
   - `FSM_Swagger/Conversion/` for classes going through conversion (e.g., `PayablesInvoice.json`, `Item.json`)
   - `FSM_Swagger/Setup/` for reference data classes (e.g., `Vendor.json`, `Customer.json`)
2. Schema will auto-parse on fetch from local file
3. Add to `setup_business_classes` table if it's a reference data class
4. Update `dependency_config.py` if class has dependencies
5. Test with sample CSV file

### Managing Setup Business Classes

1. Navigate to "Setup Data" page in UI
2. View all 12 configured FSM setup classes
3. Click "Sync All Active Classes" to fetch reference data from FSM
4. Add custom classes using "Add New Class" button
5. Edit endpoint URLs (must use `_fields=_all&_limit=100000`), key fields, or active status
6. Individual sync available per class

**Standard Endpoint Format**:
```
soap/classes/{BusinessClass}/lists/{ListName}?_fields=_all&_limit=100000&_links=false&_pageNav=true&_out=JSON&_flatten=false
```

**List Name Examples**:
- Account → DetailAccountList
- Currency → Currencies
- FinanceDimension1-5 → FinanceDimensionXFlatList
- Project → ProjectFlatList

## Troubleshooting

### Common Issues

**Pydantic schema filtering fields**: When backend returns data but frontend receives `undefined`
- Check router's `response_model` parameter
- Verify Pydantic schema class has ALL fields defined
- Field types must match service return dictionary
- Example: `ValidationProgress` missing `filename: str` field caused export filename issue

**Code changes not applying**: IMMEDIATELY do complete clean restart
```powershell
Get-Process python | Stop-Process -Force
Get-ChildItem -Path backend/app -Recurse -Directory -Filter "__pycache__" | Remove-Item -Recurse -Force
cd backend
python -m uvicorn app.main:app --reload
```

**Import errors**: Use `python -m uvicorn` instead of `uvicorn` directly

**Database locked**: Close all connections, restart backend

**CORS errors**: Check `app/main.py` CORS configuration

**Authentication fails**: Verify FSM credentials, check OAuth2 token endpoint (use saak directly as username, not tenant_id#saak)

**Schema fetch fails**: Check if local swagger file exists in `FSM_Swagger/Conversion/` or `FSM_Swagger/Setup/` folders, verify file has `createAllFieldsMultipart` schema

**Sync fails**: Verify FSM credentials, check endpoint URLs in `setup_business_classes` table, verify FSM environment is accessible

**Validation hangs**: Check backend logs, verify schema was fetched, verify reference data was synced

### Debug Logging

```python
# Enable debug logging in backend/app/core/logging.py
import logging
logging.basicConfig(level=logging.DEBUG)
```

## Implementation Status

**Completed** (20/23 tasks, 87%): Core functionality, authentication, schema engine (local swagger support), snapshot engine, setup data management UI, file upload, auto-mapping, validation pipeline, load module, complete UI workflow

**Remaining** (3/23 tasks): Rule management UI (optional), enhanced dashboard (optional), end-to-end testing

**Status**: Production-ready core, demo-ready

## Recent Updates (March 1, 2026)

### Validation Mapping Format Fix
- **Issue**: Validation endpoint returned "string indices must be integers, not 'str'" error
- **Root Cause**: Frontend was sending wrong mapping format (FSM → CSV instead of CSV → FSM)
- **Solution**: Updated `handleStartValidation` to send `mappingData.mapping` instead of `mapping`
- **Impact**: Validation now works correctly, successfully validates records and identifies errors
- **Documentation**: Added Pattern #10 for mapping format consistency
- **Test Results**: Successfully validated 20 records, identified pattern validation errors on PostingDate field
- **Files Changed**: `frontend/src/pages/ConversionWorkflow.tsx`

### Workspace Cleanup & GitHub Preparation
- **Workspace Organization**: Created temp/ directories for temporary files
  - Moved 26 files to temp/ (session summaries, debug scripts, legacy code)
  - Moved 6 files to backend/temp/ (test scripts, debug data)
  - Deleted 3 redundant documentation files
  - Updated README.md for web application
- **GitHub Security**: Comprehensive .gitignore and security measures
  - Created .gitignore files (root, backend, frontend)
  - Protected sensitive data (.env, .db, .ionapi files)
  - Created SECURITY.md with security guidelines
  - Created GITHUB_SETUP.md with deployment guide
  - Created verify_github_ready.py verification script
  - All security checks passed (7/7)
- **Benefits**: Clean workspace, GitHub-ready, secure deployment

### Sync Functionality Fix
- **OAuth URL Construction**: Fixed missing slash in token endpoint
  - Before: `...TAMICS10_AX1/astoken.oauth2` (404 error)
  - After: `...TAMICS10_AX1/as/token.oauth2` (working)
- **Base URL Construction**: Added tenant_id and /FSM/fsm path
  - Full URL: `{base_url}/{tenant_id}/FSM/fsm/{endpoint_url}`
- **Response Format Handling**: Handle list with _fields wrapper
  - FSM returns: `[{"_fields": {...}}, ...]`
  - Code now flattens _fields automatically
- **Transaction Handling**: Batch commits (100 records) with error handling
  - Prevents transaction rollback on single error
  - Successfully synced 5,720 records across 12 classes
- **Result**: All 12 setup classes syncing successfully

### Schema Fetching Enhancement
- **Local swagger files**: Organized by purpose
  - `FSM_Swagger/Setup/` - Reference data classes (12 files)
  - `FSM_Swagger/Conversion/` - Conversion target classes (GLTransactionInterface, etc.)
- **FSM API fallback**: Used when local file not available
- **GLTransactionInterface**: 91 fields, 6 required fields successfully parsed
- **Benefits**: Faster, more reliable, offline-capable

### Setup Data Management
- **New table**: `setup_business_classes` with 12 FSM classes
  - All classes standardized with `_fields=_all&_limit=100000`
  - Account, AccountingEntity, Currency, FinanceDimension1-5, FinanceEnterpriseGroup, GeneralLedgerChartAccount, Ledger, Project
  - List names vary by class (DetailAccountList, Currencies, FlatList, etc.)
- **New UI page**: SetupDataManagement.tsx for managing reference data sync
  - Real-time sync progress display
  - Status badges (Syncing, Queued, Completed, Failed)
  - Sync history tracking
- **Sync functionality**: Fetch reference data from FSM for validation
  - Successfully synced 5,720+ records across 12 classes
  - Complete field sets returned via `_fields=_all`
- **Configuration**: Add/edit/delete setup classes, enable/disable, view sync history
- **Integration**: REFERENCE_EXISTS validation uses synced data (no API calls during validation)

## Workspace Organization

### Active Directories
- `backend/` - FastAPI application
- `frontend/` - React application
- `FSM_Swagger/` - Local swagger files organized by purpose
  - `Setup/` - Reference data classes (12 files)
  - `Conversion/` - Conversion target classes (GLTransactionInterface, etc.)
- `Import_Files/` - Sample data files
- `.kiro/steering/` - AI guidance documents

### Temporary Directories (Can Be Deleted)
- `temp/` - Temporary files (26 files)
  - Session summaries and status reports
  - Debug scripts and test files
  - Legacy MCP server code
- `backend/temp/` - Backend temporary files (6 files)
  - Test scripts
  - Debug data

### Protected Files (Excluded from Git)
- `backend/.env` - Environment variables with secrets
- `backend/fsm_workbench.db` - Database with user data
- `*.ionapi` - FSM API credentials
- `backend/uploads/*.csv` - User uploaded files
- `temp/` and `backend/temp/` - All temporary files

### Security Documentation
- `SECURITY.md` - Security guidelines and best practices
- `GITHUB_SETUP.md` - GitHub deployment guide
- `verify_github_ready.py` - Security verification script
- `.gitignore` files - Root, backend, and frontend

## GitHub Deployment

### Pre-Deployment Verification
```bash
# Run security verification
python verify_github_ready.py

# Should output: All checks passed! (7/7)
```

### Deployment Steps
1. Create GitHub repository (private recommended)
2. Add remote: `git remote add origin <url>`
3. Push code: `git push -u origin main`
4. Configure branch protection
5. Enable security alerts

### Security Checklist
- ✅ .gitignore files created (3 files)
- ✅ Sensitive files excluded (.env, .db, .ionapi)
- ✅ Temporary files excluded (temp/ directories)
- ✅ Security documentation created
- ✅ Verification script passed (7/7 checks)

## References

- **User docs**: `QUICK_START.md`, `SETUP_GUIDE.md`, `USER_GUIDE.md`
- **Technical docs**: `README.md`, `IMPLEMENTATION_STATUS.md`
- **Demo docs**: `DEMO_SCRIPT.md`, `DEMO_PREPARATION.md`, `TEST_RESULTS.md`
- **Security docs**: `SECURITY.md`, `GITHUB_SETUP.md`, `GITHUB_PREPARATION_COMPLETE.md`
- **API docs**: <http://localhost:8000/docs> (when running)

---

**Version**: 2.3 (March 2026) | **Authors**: Van Anthony Silleza (FSM Consultant), Kiro AI Assistant
