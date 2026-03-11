# FSM DataBridge - Architectural Improvements Status

**Date**: March 4, 2026  
**Session**: Implementation Phase 1  
**Status**: Steps 1-3 Complete

---

## COMPLETED STEPS

### ✅ Step 1: Swagger Importer Service (COMPLETE)

**File Created**: `backend/app/services/swagger_importer.py`

**Features Implemented**:
- ✅ Accept uploaded Swagger JSON
- ✅ Parse OpenAPI schema (components.schemas)
- ✅ Extract field metadata (name, type, required, enum, pattern, description, example)
- ✅ Extract load operations from paths (create, createUnreleased, createReleased, update)
- ✅ Compute SHA256 hash for version detection
- ✅ Compare with existing schemas
- ✅ Create new version if schema changed
- ✅ Return comprehensive import summary

**Methods**:
- `import_swagger()` - Main entry point
- `parse_openapi_schema()` - Parse Swagger JSON
- `extract_fields()` - Extract field metadata
- `extract_operations()` - Extract operation names from paths
- `extract_enum_fields()` - Extract enum values
- `extract_date_fields()` - Extract date/datetime fields
- `compute_schema_hash()` - SHA256 hashing
- `find_existing_schema()` - Check for duplicates
- `create_schema_version()` - Create new version

---

### ✅ Step 2: Database Schema Updates (COMPLETE)

**Migration File**: `backend/migrate_schema_improvements.py`

**Changes Applied**:

1. **Extended `schemas` table**:
   - ✅ Added `source` column (VARCHAR(50)) - tracks origin: 'local_swagger' | 'fsm_api' | 'imported'
   - ✅ Added `created_at` column (TIMESTAMP) - creation timestamp
   - ✅ Added `operations_json` column (TEXT) - JSON array of operations
   - ✅ Added `required_fields_json` column (TEXT) - JSON array of required fields
   - ✅ Added `enum_fields_json` column (TEXT) - JSON object {field: [values]}
   - ✅ Added `date_fields_json` column (TEXT) - JSON array of date fields

2. **Created `schema_fields` table**:
   - ✅ Stores individual field metadata
   - ✅ Columns: id, schema_id, business_class, field_name, field_type, required, enum_values_json, pattern, description, example
   - ✅ Index on (schema_id, field_name) for fast lookups
   - ✅ Foreign key to schemas table with CASCADE delete

3. **Created `schema_operations` table**:
   - ✅ Stores available operations per schema
   - ✅ Columns: id, schema_id, business_class, operation_name
   - ✅ Index on (schema_id, business_class)
   - ✅ Foreign key to schemas table with CASCADE delete

4. **Extended `conversion_jobs` table**:
   - ✅ Added `schema_version` column (INTEGER) - locks job to specific schema version

**Models Created**:
- ✅ `backend/app/models/schema_field.py` - SchemaField model
- ✅ `backend/app/models/schema_operation.py` - SchemaOperation model

**Models Updated**:
- ✅ `backend/app/models/schema.py` - Added new columns
- ✅ `backend/app/models/job.py` - Added schema_version column

**Migration Status**: ✅ Successfully executed

---

### ✅ Step 3: Schema Import API (COMPLETE)

**Endpoint Added**: `POST /api/schema/import-swagger`

**File Updated**: `backend/app/modules/schema/router.py`

**Request Format**:
```
Content-Type: multipart/form-data
Fields:
- business_class: str (FSM business class name)
- swagger_file: UploadFile (Swagger JSON file)
```

**Response Format**:
```json
{
  "business_class": "GLTransactionInterface",
  "version": 2,
  "new_schema": true,
  "fields_count": 91,
  "required_fields": 7,
  "operations": ["createUnreleased", "createReleased"],
  "schema_hash": "abc123...",
  "schema_id": 456
}
```

**Logic Flow**:
1. Read uploaded Swagger JSON file
2. Call SwaggerImporter.import_swagger()
3. Parse schema and extract metadata
4. Compute SHA256 hash
5. Check if schema already exists
6. If new → create schema version
7. Return import summary

**Error Handling**:
- 400 Bad Request: Invalid JSON, missing schema
- 500 Internal Server Error: Database errors, parsing errors

---

## NEXT STEPS

### ⏳ Step 4: Load Strategy Resolver (IN PROGRESS)

**File to Create**: `backend/app/services/load_strategy_resolver.py`

**Purpose**: Dynamically determine FSM load method based on available operations

**Methods Needed**:
```python
class LoadStrategyResolver:
    def resolve_load_method(db, business_class, schema_version) -> str
    def get_available_operations(db, schema_id) -> List[str]
    def validate_load_mode(db, business_class, requested_mode) -> bool
```

**Logic**:
- Query schema_operations table
- Check for createReleased, createUnreleased, create
- Return appropriate load method
- Validate user-requested mode against available operations

---

### ⏳ Step 5: Remove MCP Authentication Bypass (PENDING)

**Changes Needed**:
1. Delete `POST /api/accounts/mcp-login/{account_id}` endpoint
2. Update MCP `login` tool to use `POST /api/accounts/login` with password
3. Test MCP authentication with real password

---

### ⏳ Step 6: Remove MCP Filesystem Access (PENDING)

**Changes Needed**:
1. Remove `list_files` tool from MCP server
2. Add `list_jobs` tool that calls `GET /api/upload/jobs/recent`
3. Update MCP tool descriptions

---

### ⏳ Step 7: Workflow Orchestrator API (PENDING)

**File to Create**: `backend/app/services/workflow_orchestrator.py`

**Endpoint to Add**: `POST /api/workflows/full-conversion`

**Purpose**: Backend-managed workflow orchestration

---

### ⏳ Step 8: Schema Management UI (PENDING)

**File to Create**: `frontend/src/pages/SchemaManagement.tsx`

**Features**:
- Upload Swagger file
- View schema versions
- Show field count, required fields, operations
- Schema comparison

---

## TESTING CHECKLIST

### Unit Tests Needed
- [ ] SwaggerImporter.parse_openapi_schema()
- [ ] SwaggerImporter.extract_operations()
- [ ] SwaggerImporter.compute_schema_hash()
- [ ] LoadStrategyResolver.resolve_load_method()

### Integration Tests Needed
- [ ] Upload Swagger → Create schema version
- [ ] Duplicate schema → Return existing version
- [ ] Schema versioning → Increment version number
- [ ] Job schema lock → Assign version to job

### E2E Tests Needed
- [ ] Upload new business class Swagger via API
- [ ] Verify schema fields and operations stored
- [ ] Run conversion with new business class
- [ ] Verify load mode selection based on operations

---

## IMPLEMENTATION NOTES

### Design Decisions

1. **SHA256 Hashing**: Used for detecting schema changes
   - Ensures identical schemas don't create duplicate versions
   - Sorted JSON keys for consistent hashing

2. **Separate Tables**: schema_fields and schema_operations
   - Allows efficient querying of fields and operations
   - Supports future features like field-level lineage

3. **Schema Version Locking**: conversion_jobs.schema_version
   - Ensures historical jobs remain stable
   - Prevents schema changes from breaking old jobs

4. **Source Tracking**: schemas.source column
   - Tracks origin: local_swagger, fsm_api, imported
   - Helps with debugging and auditing

### Known Limitations

1. **SQLite Constraints**: Cannot use CURRENT_TIMESTAMP in ALTER TABLE
   - Workaround: Use NULL for created_at, set manually

2. **No Background Processing**: Import is synchronous
   - Future: Add Celery task for large Swagger files

3. **No Schema Validation**: Assumes valid OpenAPI format
   - Future: Add JSON Schema validation

---

## PROGRESS SUMMARY

**Completed**: 3/8 steps (37.5%)

**Phase 1 (Schema Infrastructure)**: 75% complete
- ✅ Step 1: Swagger Importer
- ✅ Step 2: Database Updates
- ✅ Step 3: Schema Import API
- ⏳ Step 4: Load Strategy Resolver (next)

**Phase 2 (MCP Integration)**: 0% complete
- ⏳ Step 5: Remove Auth Bypass
- ⏳ Step 6: Remove Filesystem Access
- ⏳ Step 7: Workflow Orchestrator

**Phase 3 (UI)**: 0% complete
- ⏳ Step 8: Schema Management UI

---

## FILES CREATED/MODIFIED

### New Files (5)
1. `backend/app/services/swagger_importer.py` - Swagger import service
2. `backend/app/models/schema_field.py` - SchemaField model
3. `backend/app/models/schema_operation.py` - SchemaOperation model
4. `backend/migrate_schema_improvements.py` - Database migration
5. `ARCHITECTURAL_IMPROVEMENTS_PLAN.md` - Implementation plan

### Modified Files (3)
1. `backend/app/models/schema.py` - Added new columns
2. `backend/app/models/job.py` - Added schema_version
3. `backend/app/modules/schema/router.py` - Added import-swagger endpoint

---

**Next Session**: Implement Load Strategy Resolver and begin MCP integration

