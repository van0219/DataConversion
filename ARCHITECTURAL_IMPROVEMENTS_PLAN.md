# FSM DataBridge - Architectural Improvements Implementation Plan

**Date**: March 4, 2026  
**Goal**: Transform FSM DataBridge into a schema-driven FSM conversion platform  
**Status**: Planning Phase

---

## OVERVIEW

This document tracks the implementation of architectural improvements to make FSM DataBridge:
1. Schema-driven (Swagger-based metadata)
2. Platform-integrated (no MCP bypasses)
3. Version-aware (schema versioning)
4. Future-proof (support any FSM business class)

---

## IMPLEMENTATION SEQUENCE

### Phase 1: Schema Infrastructure (Steps 1-4)
- [ ] 1. Swagger Importer Service
- [ ] 2. Database Schema Updates
- [ ] 3. Schema Versioning Logic
- [ ] 4. Load Strategy Resolver

### Phase 2: MCP Platform Integration (Steps 5-7)
- [ ] 5. Remove MCP Authentication Bypass
- [ ] 6. Remove MCP Filesystem Access
- [ ] 7. Workflow Orchestrator API

### Phase 3: UI & User Experience (Step 8)
- [ ] 8. Schema Management UI

---

## DETAILED IMPLEMENTATION CHECKLIST

### Step 1: Swagger Importer Service ⏳

**File**: `backend/app/services/swagger_importer.py`

**Responsibilities**:
- [x] Accept uploaded Swagger JSON
- [x] Parse OpenAPI schema
- [x] Extract field metadata (name, type, required, enum, pattern)
- [x] Extract load operations (create, createUnreleased, createReleased, update)
- [x] Compute SHA256 hash
- [x] Compare with existing schemas
- [x] Create new version if schema changed

**Methods**:
```python
class SwaggerImporter:
    def import_swagger(file_content: str, business_class: str) -> dict
    def parse_openapi_schema(swagger_json: dict) -> dict
    def extract_fields(schema: dict) -> List[dict]
    def extract_operations(paths: dict) -> List[str]
    def compute_schema_hash(schema_content: dict) -> str
    def compare_with_existing(db, business_class, schema_hash) -> bool
    def create_schema_version(db, business_class, schema_data) -> Schema
```

---

### Step 2: Database Schema Updates ⏳

**Migration File**: `backend/migrate_schema_improvements.py`

**Changes to `schemas` table**:
```sql
ALTER TABLE schemas ADD COLUMN source VARCHAR(50);  -- 'local_swagger' | 'fsm_api' | 'imported'
ALTER TABLE schemas ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE schemas ADD COLUMN operations_json TEXT;  -- JSON array of operations
ALTER TABLE schemas ADD COLUMN required_fields_json TEXT;  -- JSON array of required fields
ALTER TABLE schemas ADD COLUMN enum_fields_json TEXT;  -- JSON object {field: [values]}
ALTER TABLE schemas ADD COLUMN date_fields_json TEXT;  -- JSON array of date fields
```

**New table: `schema_fields`**:
```sql
CREATE TABLE schema_fields (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    schema_id INTEGER NOT NULL,
    business_class VARCHAR(255) NOT NULL,
    field_name VARCHAR(255) NOT NULL,
    field_type VARCHAR(100) NOT NULL,
    required BOOLEAN DEFAULT FALSE,
    enum_values_json TEXT,
    pattern VARCHAR(500),
    description TEXT,
    example TEXT,
    FOREIGN KEY (schema_id) REFERENCES schemas(id) ON DELETE CASCADE
);
CREATE INDEX idx_schema_fields_lookup ON schema_fields(schema_id, field_name);
```

**New table: `schema_operations`**:
```sql
CREATE TABLE schema_operations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    schema_id INTEGER NOT NULL,
    business_class VARCHAR(255) NOT NULL,
    operation_name VARCHAR(100) NOT NULL,
    FOREIGN KEY (schema_id) REFERENCES schemas(id) ON DELETE CASCADE
);
CREATE INDEX idx_schema_operations_lookup ON schema_operations(schema_id, business_class);
```

**Update `conversion_jobs` table**:
```sql
ALTER TABLE conversion_jobs ADD COLUMN schema_version INTEGER;
```

**Models to Create**:
- [x] `backend/app/models/schema_field.py`
- [x] `backend/app/models/schema_operation.py`

---

### Step 3: Schema Import API ⏳

**Endpoint**: `POST /api/schema/import-swagger`

**Router**: `backend/app/modules/schema/router.py`

**Request**:
```python
Content-Type: multipart/form-data
Fields:
- business_class: str
- swagger_file: UploadFile
```

**Response**:
```json
{
  "business_class": "GLTransactionInterface",
  "version": 2,
  "new_schema": true,
  "fields_count": 91,
  "required_fields": 7,
  "operations": ["createUnreleased", "createReleased"],
  "schema_hash": "abc123..."
}
```

**Logic**:
1. Load uploaded JSON
2. Parse with SwaggerImporter
3. Calculate SHA256
4. Check if hash exists in database
5. If exists → return existing schema
6. If new → create schema version + fields + operations
7. Return summary

---

### Step 4: Load Strategy Resolver ⏳

**File**: `backend/app/services/load_strategy_resolver.py`

**Purpose**: Dynamically determine FSM load method based on available operations

**Methods**:
```python
class LoadStrategyResolver:
    def resolve_load_method(db: Session, business_class: str, schema_version: int) -> str
    def get_available_operations(db: Session, schema_id: int) -> List[str]
    def validate_load_mode(db: Session, business_class: str, requested_mode: str) -> bool
```

**Logic**:
```python
operations = get_operations_from_schema(business_class, schema_version)

if "createReleased" in operations:
    return "createReleased"  # Direct release mode
elif "createUnreleased" in operations:
    return "createUnreleased"  # Staging mode
elif "create" in operations:
    return "create"  # Direct create
else:
    raise ValueError("No supported load operation found")
```

---

### Step 5: Remove MCP Authentication Bypass ⏳

**Changes**:
1. Delete endpoint: `POST /api/accounts/mcp-login/{account_id}` from `backend/app/modules/accounts/router.py`
2. Update MCP `login` tool in `mcp_server/src/fsm_workbench_mcp/server.py`

**Before**:
```python
# MCP calls bypass endpoint
response = await client.post(f"{base_url}/api/accounts/mcp-login/{account_id}")
```

**After**:
```python
# MCP uses same login as UI
response = await client.post(
    f"{base_url}/api/accounts/login",
    json={"account_name": account_name, "password": password}
)
```

---

### Step 6: Remove MCP Filesystem Access ⏳

**Changes**:
1. Remove `list_files` tool from MCP server
2. Add `list_jobs` tool that calls `GET /api/upload/jobs/recent`

**Before**:
```python
def handle_list_files(args):
    directory = Path(args.get("directory", "Import_Files"))
    csv_files = list(directory.glob("*.csv"))
    # Direct filesystem access
```

**After**:
```python
async def handle_list_jobs(args):
    response = await client.get(
        f"{base_url}/api/upload/jobs/recent?limit=20",
        headers=client._get_headers()
    )
    # Uses platform API
```

---

### Step 7: Workflow Orchestrator API ⏳

**File**: `backend/app/services/workflow_orchestrator.py`

**Endpoint**: `POST /api/workflows/full-conversion`

**Request**:
```json
{
  "file_path": "path/to/file.csv",
  "business_class": "GLTransactionInterface",
  "load_to_fsm": false,
  "template_id": 123  // optional
}
```

**Response**:
```json
{
  "job_id": 456,
  "status": "started",
  "steps": ["upload", "schema", "mapping", "validation", "load"]
}
```

**Orchestration Flow**:
```python
async def run_full_conversion(db, account_id, file_path, business_class, load_to_fsm, template_id):
    # 1. Upload file
    job = await upload_service.handle_upload(...)
    
    # 2. Fetch schema (latest version)
    schema = await schema_service.fetch_and_store_schema(...)
    
    # 3. Auto-map fields (or apply template)
    if template_id:
        mapping = await mapping_service.apply_template(...)
    else:
        mapping = await mapping_service.auto_map(...)
    
    # 4. Start validation
    await validation_service.start_validation(...)
    
    # 5. Optionally load to FSM
    if load_to_fsm:
        await load_service.start_load(...)
    
    return {"job_id": job.id, "status": "started"}
```

---

### Step 8: Schema Management UI ⏳

**File**: `frontend/src/pages/SchemaManagement.tsx`

**Features**:
1. Upload Swagger file
2. View schema versions
3. Show field count
4. Show required fields
5. Show load methods
6. Schema change summary

**UI Layout**:
```
┌─────────────────────────────────────────────────────────┐
│  Schema Management                                       │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  [Upload Swagger File]  [Business Class: ___________]   │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐│
│  │ Business Class | Version | Fields | Required | Ops  ││
│  ├─────────────────────────────────────────────────────┤│
│  │ GLTransaction  │   v2    │   91   │    7     │ cU,cR││
│  │ PayablesInv    │   v1    │   45   │    5     │ c    ││
│  └─────────────────────────────────────────────────────┘│
│                                                           │
│  [View Details] [Compare Versions] [Export Schema]      │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

---

## ADDITIONAL IMPROVEMENTS

### Load Mode Selection in UI

**Location**: `frontend/src/pages/ConversionWorkflow.tsx`

**Add field**:
```tsx
<select name="loadMode">
  <option value="createUnreleased">Staging Only</option>
  <option value="createReleased">Create Released</option>
  <option value="create">Direct Create</option>
</select>
```

**Backend validation**:
```python
# Validate requested mode against schema_operations
available_ops = get_operations(business_class, schema_version)
if requested_mode not in available_ops:
    raise ValueError(f"Load mode {requested_mode} not supported")
```

---

### OpenAPI Parser Enhancement

**File**: `backend/app/services/openapi_parser.py`

**New extraction methods**:
```python
def extract_operations(paths: dict) -> List[str]:
    """Extract operation names from paths"""
    operations = []
    for path, methods in paths.items():
        for method, details in methods.items():
            if "operationId" in details:
                operations.append(details["operationId"])
    return operations

def extract_required_fields(schema: dict) -> List[str]:
    """Extract required field names"""
    return schema.get("required", [])

def extract_enum_fields(properties: dict) -> dict:
    """Extract fields with enum values"""
    enum_fields = {}
    for field_name, field_def in properties.items():
        if "enum" in field_def:
            enum_fields[field_name] = field_def["enum"]
    return enum_fields

def extract_date_fields(properties: dict) -> List[str]:
    """Extract date/datetime fields"""
    date_fields = []
    for field_name, field_def in properties.items():
        if field_def.get("type") == "string" and field_def.get("format") in ["date", "date-time"]:
            date_fields.append(field_name)
    return date_fields
```

---

## MCP TOOL FINAL LIST

**14 Tools** (all platform-integrated):

1. `login` - POST `/api/accounts/login` (with password)
2. `get_current_account` - GET `/api/accounts/me`
3. `list_jobs` - GET `/api/upload/jobs/recent`
4. `upload_file` - POST `/api/upload/`
5. `fetch_schema` - POST `/api/schema/fetch`
6. `auto_map_fields` - POST `/api/mapping/auto-map`
7. `start_validation` - POST `/api/validation/start`
8. `get_validation_progress` - GET `/api/validation/{job_id}/progress`
9. `get_validation_summary` - GET `/api/validation/{job_id}/summary`
10. `export_errors` - GET `/api/validation/{job_id}/errors/export`
11. `load_to_fsm` - POST `/api/load/start`
12. `run_full_conversion` - POST `/api/workflows/full-conversion`
13. `sync_reference_data` - POST `/api/snapshot/sync/single`
14. `sync_all_reference_data` - POST `/api/snapshot/sync/all`

**Removed**:
- ❌ `login_with_account_name` (merged into `login`)
- ❌ `list_files` (replaced with `list_jobs`)

---

## SUCCESS CRITERIA

### Schema-Driven Platform
- ✅ Any FSM business class can be added by uploading Swagger
- ✅ No code changes required for new business classes
- ✅ Schema versioning tracks changes over time
- ✅ Historical jobs remain stable with locked schema versions

### Platform Integration
- ✅ MCP uses same authentication as UI
- ✅ MCP uses platform APIs exclusively
- ✅ No direct filesystem or database access from MCP
- ✅ Workflow orchestration lives in backend, not MCP

### User Experience
- ✅ Schema Management UI for uploading Swagger
- ✅ Load mode selection based on available operations
- ✅ Schema version comparison
- ✅ Auto-registration of business classes

---

## TESTING PLAN

### Unit Tests
- [ ] SwaggerImporter.parse_openapi_schema()
- [ ] LoadStrategyResolver.resolve_load_method()
- [ ] WorkflowOrchestrator.run_full_conversion()

### Integration Tests
- [ ] Upload Swagger → Create schema version
- [ ] Schema versioning → Lock job to version
- [ ] Load strategy → Validate against operations

### E2E Tests
- [ ] Upload new business class Swagger
- [ ] Run conversion with new class
- [ ] Verify load mode selection
- [ ] MCP authentication with password

---

## ROLLOUT PLAN

### Phase 1: Backend Infrastructure (Week 1)
- Implement Swagger importer
- Database migrations
- Schema versioning
- Load strategy resolver

### Phase 2: API & MCP Updates (Week 2)
- Schema import API
- Remove MCP bypasses
- Workflow orchestrator
- Update MCP tools

### Phase 3: UI & Testing (Week 3)
- Schema Management UI
- Load mode selection
- E2E testing
- Documentation

---

**Status**: Ready to begin implementation  
**Next Step**: Create Swagger Importer Service

