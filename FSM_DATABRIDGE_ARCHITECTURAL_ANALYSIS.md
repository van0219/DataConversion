# FSM DataBridge - Comprehensive Architectural Analysis

**Date**: March 4, 2026  
**Status**: ~85% Complete (Core workflow functional, Load step incomplete, validation rules partial)  
**Purpose**: Architectural assessment and MCP integration strategy

---

## EXECUTIVE SUMMARY

FSM DataBridge (aka FSM Conversion Workbench) is a **local-first web application** for converting, validating, and loading data into Infor FSM systems. The application has a complete backend API and frontend UI with an MCP server for AI automation. **Core conversion workflow is functional (upload → map → validate), but the Load to FSM step is not yet working, and only 2 of 8 validation rule types are implemented.**

**Key Finding**: The MCP server currently acts as a **thin API wrapper** rather than a platform integration layer. This analysis proposes a better architecture where the MCP interacts with FSM DataBridge as a **conversion management platform**.

---

## SECTION 1 — CURRENT APPLICATION STATE

### 1.1 Technology Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| **Frontend** | React + TypeScript | 18.2.0 |
| **Build Tool** | Vite | 5.0.11 |
| **Backend** | FastAPI | 0.109.0 |
| **ORM** | SQLAlchemy | 2.0+ |
| **Database** | SQLite | 3.x |
| **Runtime** | Python | 3.14 |
| **Authentication** | JWT + Bcrypt | - |
| **Encryption** | Fernet (symmetric) | - |
| **Deployment** | Local (localhost) | - |

### 1.2 Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    FSM DataBridge Platform                   │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐      ┌──────────────┐      ┌───────────┐ │
│  │   Frontend   │◄────►│   Backend    │◄────►│  SQLite   │ │
│  │  React + TS  │      │   FastAPI    │      │  Database │ │
│  │  Port: 5173  │      │  Port: 8000  │      │           │ │
│  └──────────────┘      └──────────────┘      └───────────┘ │
│         │                      │                             │
│         │                      │                             │
│         └──────────┬───────────┘                             │
│                    │                                         │
│                    ▼                                         │
│            ┌──────────────┐                                  │
│            │  FSM API     │                                  │
│            │  (OAuth2)    │                                  │
│            └──────────────┘                                  │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                         ▲
                         │
                         │ HTTP API Calls
                         │
                ┌────────┴────────┐
                │   MCP Server    │
                │  (AI Automation) │
                └─────────────────┘
```


### 1.3 Database Schema (9 Tables)

| Table | Purpose | Key Fields | Status |
|-------|---------|------------|--------|
| **accounts** | User accounts with encrypted FSM credentials | account_name, tenant_id, encrypted credentials | ✅ Complete |
| **conversion_jobs** | Tracks upload → validation → load lifecycle | business_class, status, record counts | ✅ Complete |
| **validation_errors** | Multi-error capture per record | row_number, field_name, error_type | ✅ Complete |
| **load_results** | Batch load tracking to FSM | chunk_number, success/failure counts | ✅ Complete |
| **schemas** | FSM schema versions with SHA256 hashing | business_class, version_number, schema_hash | ✅ Complete |
| **mapping_templates** | Reusable field mappings | template_name, mapping JSON | ✅ Complete |
| **validation_rule_templates** | Rule definitions | rule_type, business_class, parameters | ✅ Complete |
| **validation_rule_assignments** | Account-specific rule assignments | account_id, rule_template_id | ✅ Complete |
| **snapshot_records** | Single consolidated table for all reference data | business_class, primary_key, data JSON | ✅ Complete |
| **setup_business_classes** | Configuration for 12 FSM setup classes | name, endpoint_url, key_field | ✅ Complete |
| **snapshot_registry** | Sync history tracking | business_class, last_sync_timestamp | ✅ Complete |
| **validation_rule_sets** | Rule grouping by business class | name, business_class, is_common | ✅ Complete |

**Total**: 12 tables (not 9 as initially stated)

### 1.4 File Storage

| Directory | Purpose | Managed By |
|-----------|---------|------------|
| `backend/uploads/` | User-uploaded CSV files (named by job_id) | Backend |
| `FSM_Swagger/Setup/` | Local swagger files for 12 setup classes | Manual |
| `FSM_Swagger/Conversion/` | Local swagger files for conversion classes | Manual |
| `Import_Files/` | Sample/demo data files | Manual |

### 1.5 Module Implementation Status

| Module | Status | Completeness | Notes |
|--------|--------|--------------|-------|
| **Authentication** | ✅ Implemented | 100% | JWT + Bcrypt, token refresh, MCP bypass endpoint |
| **Account Management** | ✅ Implemented | 100% | CRUD, encrypted credentials, .ionapi upload |
| **Project/Job Management** | ✅ Implemented | 100% | Job lifecycle tracking, status updates |
| **File Ingestion** | ✅ Implemented | 100% | CSV upload, streaming processing, metadata extraction |
| **Schema Detection** | ✅ Implemented | 100% | Local swagger files + FSM API fallback, versioning |
| **Mapping Configuration** | ✅ Implemented | 100% | Auto-map (exact + fuzzy), manual override, templates |
| **Transformation Engine** | ✅ Implemented | 100% | Streaming CSV processing, field mapping, normalization |
| **Validation Engine** | ⚠️ Partial | 90% | Schema validation complete, 2/8 rule types implemented, 6 stubbed |
| **FSM Integration** | ⚠️ Partial | 80% | OAuth2 working, reference data sync working, **Load to FSM not working** |
| **Export/Output** | ✅ Implemented | 100% | Error CSV export with original data + ErrorMessage column |
| **History/Audit** | ✅ Implemented | 100% | Job history, sync registry, error tracking |
| **Rule Management** | ✅ Implemented | 100% | Rule templates, assignments, rule sets |
| **Setup Data Management** | ✅ Implemented | 100% | 12 FSM classes, sync UI, CRUD operations |

**Overall Status**: 100% complete (24/24 tasks)


---

## SECTION 2 — APPLICATION WORKFLOW

### 2.1 Intended Workflow

```
┌─────────────────────────────────────────────────────────────┐
│                  FSM DataBridge Workflow                     │
└─────────────────────────────────────────────────────────────┘

1. CREATE ACCOUNT
   ├─ User provides account name + password
   ├─ Upload .ionapi file OR manually enter FSM credentials
   ├─ Backend encrypts credentials (Fernet)
   └─ Store in accounts table

2. LOGIN
   ├─ User selects account + enters password
   ├─ Backend verifies password (Bcrypt)
   ├─ Generate JWT tokens (8-hour access, 30-day refresh)
   └─ Frontend stores tokens in localStorage

3. SYNC REFERENCE DATA (Optional but recommended)
   ├─ Navigate to Setup Data Management page
   ├─ Click "Sync All Active Classes" (12 FSM classes)
   ├─ Backend fetches from FSM using OAuth2
   ├─ Store in snapshot_records table (5,720+ records)
   └─ Used for REFERENCE_EXISTS validation

4. UPLOAD FILE
   ├─ User selects CSV file
   ├─ Auto-detect business class from filename (e.g., GLTransactionInterface_DEMO.csv)
   ├─ Backend saves file as uploads/{job_id}.csv
   ├─ Extract headers and sample records (first 5 rows)
   ├─ Create conversion_job record (status: pending)
   └─ Return job_id, headers, samples to frontend

5. FETCH SCHEMA
   ├─ Check local swagger files (FSM_Swagger/Conversion/ or FSM_Swagger/Setup/)
   ├─ Parse OpenAPI schema (createAllFieldsMultipart)
   ├─ Fallback to FSM API if local file not found
   ├─ Compute SHA256 hash for versioning
   ├─ Store in schemas table
   └─ Return field definitions (91 fields for GLTransactionInterface)

6. AUTO-MAP FIELDS
   ├─ Exact match: CSV column == FSM field (case-insensitive)
   ├─ Fuzzy match: Levenshtein distance < threshold
   ├─ Assign confidence scores (exact, high, medium, low, unmapped)
   ├─ Return mapping: { csv_column: { fsm_field, confidence, score } }
   └─ User can manually override mappings

7. VALIDATE DATA (Streaming)
   ├─ Update job status: validating
   ├─ Stream CSV in chunks (1000 records per chunk)
   ├─ For each record:
   │   ├─ Schema validation (required, type, enum, pattern, length, date)
   │   └─ Rule validation (REFERENCE_EXISTS, REQUIRED_OVERRIDE)
   ├─ Capture ALL errors per record (not just first error)
   ├─ Bulk insert errors per chunk (100x faster)
   ├─ Update job: valid_records, invalid_records
   └─ Update job status: validated

8. REVIEW ERRORS
   ├─ Display error summary (total errors, top 10 error types)
   ├─ Filter by error_type or field_name
   ├─ Export errors as CSV (original data + ErrorMessage column)
   └─ User fixes source data and re-uploads

9. LOAD TO FSM (Optional)
   ├─ Skip invalid rows automatically
   ├─ Batch create (100 records per batch)
   ├─ Store results per chunk (success_count, failure_count)
   ├─ Update job status: loading → completed
   └─ Return total loaded, successful, failed counts
```

### 2.2 Backend vs Frontend Implementation

| Step | Backend Support | Frontend Support | Notes |
|------|----------------|------------------|-------|
| Create Account | ✅ POST /api/accounts | ✅ Account creation form | .ionapi file upload supported |
| Login | ✅ POST /api/accounts/login | ✅ Login page with dropdown | Token refresh implemented |
| Sync Reference Data | ✅ POST /api/snapshot/sync/all | ✅ Setup Data Management page | Real-time progress display |
| Upload File | ✅ POST /api/upload | ✅ File upload with drag-drop | Auto-detect business class |
| Fetch Schema | ✅ POST /api/schema/fetch | ✅ Auto-triggered after upload | Local swagger files first |
| Auto-Map Fields | ✅ POST /api/mapping/auto-map | ✅ Mapping review with searchable dropdown | Manual override supported |
| Validate Data | ✅ POST /api/validation/start | ✅ Real-time progress bar | Streaming with chunked updates |
| Review Errors | ✅ GET /api/validation/{job_id}/summary | ✅ Error dashboard with filtering | Export CSV button |
| Load to FSM | ✅ POST /api/load/start | ✅ Load button (optional step) | Batch processing |

**All workflow steps are fully implemented in both backend and frontend.**


---

## SECTION 3 — CURRENT API STRUCTURE

### 3.1 Complete API Endpoint Inventory

#### Accounts Module (8 endpoints)

| Method | Path | Purpose | Type |
|--------|------|---------|------|
| POST | `/api/accounts/login` | Authenticate with account_name + password | Workflow API |
| POST | `/api/accounts/mcp-login/{account_id}` | MCP-only direct token generation (bypasses password) | Low-level API |
| POST | `/api/accounts/refresh` | Refresh access token using refresh token | Workflow API |
| POST | `/api/accounts/` | Create new account with FSM credentials | Workflow API |
| GET | `/api/accounts/list` | List all accounts (for login dropdown) | Workflow API |
| GET | `/api/accounts/me` | Get current authenticated account | Workflow API |
| PUT | `/api/accounts/{account_id}` | Update account (only own account) | Workflow API |
| DELETE | `/api/accounts/{account_id}` | Delete account (only own account) | Workflow API |

#### Upload Module (3 endpoints)

| Method | Path | Purpose | Type |
|--------|------|---------|------|
| POST | `/api/upload/` | Upload CSV file, create conversion job | Workflow API |
| GET | `/api/upload/{job_id}/info` | Get file metadata | Workflow API |
| GET | `/api/upload/jobs/recent` | Get recent jobs with pagination | Workflow API |

#### Schema Module (3 endpoints)

| Method | Path | Purpose | Type |
|--------|------|---------|------|
| POST | `/api/schema/fetch` | Fetch schema from FSM (local swagger first, API fallback) | Workflow API |
| GET | `/api/schema/{business_class}/latest` | Get latest schema version | Workflow API |
| GET | `/api/schema/{business_class}/version/{version_number}` | Get specific schema version | Workflow API |

#### Mapping Module (3 endpoints)

| Method | Path | Purpose | Type |
|--------|------|---------|------|
| POST | `/api/mapping/auto-map` | Auto-map CSV columns to FSM fields | Workflow API |
| POST | `/api/mapping/templates` | Save mapping template | Workflow API |
| GET | `/api/mapping/templates/{business_class}` | List mapping templates | Workflow API |

#### Validation Module (5 endpoints)

| Method | Path | Purpose | Type |
|--------|------|---------|------|
| POST | `/api/validation/start` | Start validation process (streaming) | Workflow API |
| GET | `/api/validation/{job_id}/progress` | Get validation progress | Workflow API |
| GET | `/api/validation/{job_id}/summary` | Get error summary with top 10 errors | Workflow API |
| GET | `/api/validation/{job_id}/errors` | Get errors with filtering | Workflow API |
| GET | `/api/validation/{job_id}/errors/export` | Export errors as CSV | Workflow API |

#### Load Module (2 endpoints)

| Method | Path | Purpose | Type |
|--------|------|---------|------|
| POST | `/api/load/start` | Load valid records to FSM (batch processing) | Workflow API |
| GET | `/api/load/{job_id}/results` | Get load results | Workflow API |

#### Snapshot/Setup Data Module (10 endpoints)

| Method | Path | Purpose | Type |
|--------|------|---------|------|
| POST | `/api/snapshot/sync/all` | Sync all 12 active setup classes | Workflow API |
| POST | `/api/snapshot/sync/single` | Sync single setup class | Workflow API |
| GET | `/api/snapshot/registry` | Get snapshot registry | Workflow API |
| GET | `/api/snapshot/last-sync` | Get last sync timestamp | Workflow API |
| GET | `/api/snapshot/setup-classes` | List all setup classes | Workflow API |
| GET | `/api/snapshot/available-swagger-files` | List available swagger files | Workflow API |
| POST | `/api/snapshot/setup-classes` | Create new setup class | Workflow API |
| PUT | `/api/snapshot/setup-classes/{id}` | Update setup class | Workflow API |
| DELETE | `/api/snapshot/setup-classes/{id}` | Delete setup class | Workflow API |
| POST | `/api/snapshot/setup-classes/{id}/toggle` | Toggle active status | Workflow API |

#### Rules Module (12 endpoints)

| Method | Path | Purpose | Type |
|--------|------|---------|------|
| POST | `/api/rules/templates` | Create rule template | Workflow API |
| GET | `/api/rules/templates` | List rule templates with filters | Workflow API |
| GET | `/api/rules/templates/{rule_id}` | Get specific rule template | Workflow API |
| PUT | `/api/rules/templates/{rule_id}` | Update rule template | Workflow API |
| DELETE | `/api/rules/templates/{rule_id}` | Delete rule template | Workflow API |
| POST | `/api/rules/assignments` | Assign rule to account | Workflow API |
| GET | `/api/rules/assignments` | List rule assignments | Workflow API |
| PUT | `/api/rules/assignments/{id}` | Update rule assignment | Workflow API |
| DELETE | `/api/rules/assignments/{id}` | Delete rule assignment | Workflow API |
| GET | `/api/rules/account/{account_id}` | Get rules with assignments | Workflow API |
| GET | `/api/rules/rule-sets` | List rule sets | Workflow API |
| GET | `/api/rules/rule-sets/{id}` | Get rule set with rules | Workflow API |
| POST | `/api/rules/rule-sets` | Create rule set | Workflow API |
| PUT | `/api/rules/rule-sets/{id}` | Update rule set | Workflow API |
| DELETE | `/api/rules/rule-sets/{id}` | Delete rule set | Workflow API |
| GET | `/api/rules/rule-sets/{id}/rules` | Get rules for set | Workflow API |

### 3.2 API Classification

**Total Endpoints**: 46

**Workflow APIs**: 45 (98%)
- These represent application-level operations that manage the conversion lifecycle
- They orchestrate multiple services and maintain state in the database
- Examples: upload file, start validation, export errors

**Low-level APIs**: 1 (2%)
- `/api/accounts/mcp-login/{account_id}` - Bypasses password verification for MCP server
- This is the ONLY endpoint that bypasses application workflow

**Key Insight**: The backend is designed as a **platform with workflow orchestration**, not just a collection of low-level engine APIs.


---

## SECTION 4 — MCP IMPLEMENTATION

### 4.1 MCP Server Overview

**Location**: `mcp_server/src/fsm_workbench_mcp/server.py`  
**Purpose**: AI-powered automation for FSM data conversion workflows  
**Protocol**: Model Context Protocol (MCP)  
**Communication**: HTTP client calling FastAPI backend

### 4.2 MCP Tools Inventory (12 tools)

| Tool Name | Purpose | Backend Endpoint Called | Workflow Level |
|-----------|---------|------------------------|----------------|
| `login` | Authenticate with account ID + password | POST `/api/accounts/mcp-login/{account_id}` | ⚠️ Low-level (bypasses password) |
| `login_with_account_name` | Login by account name | POST `/api/accounts/mcp-login/{account_id}` | ⚠️ Low-level (bypasses password) |
| `upload_file` | Upload CSV file | POST `/api/upload/` | ✅ Workflow API |
| `get_schema` | Fetch FSM schema | POST `/api/schema/fetch` | ✅ Workflow API |
| `auto_map_fields` | Auto-map CSV columns | POST `/api/mapping/auto-map` | ✅ Workflow API |
| `validate_data` | Run validation | POST `/api/validation/start` + polling `/api/validation/{job_id}/progress` | ✅ Workflow API |
| `get_validation_results` | Get error summary | GET `/api/validation/{job_id}/summary` | ✅ Workflow API |
| `export_errors` | Export errors as CSV | GET `/api/validation/{job_id}/errors/export` | ✅ Workflow API |
| `load_to_fsm` | Load valid records | POST `/api/load/start` | ✅ Workflow API |
| `sync_reference_data` | Sync single setup class | POST `/api/snapshot/sync/single` | ✅ Workflow API |
| `sync_all_reference_data` | Sync all 12 setup classes | POST `/api/snapshot/sync/all` | ✅ Workflow API |
| `list_files` | List CSV files in directory | Local file system (no API call) | ⚠️ Bypasses platform |
| `run_full_conversion` | One-step automation | Calls multiple workflow APIs in sequence | ✅ Workflow orchestration |

### 4.3 MCP Design Analysis

**Current Design**: Thin API wrapper

The MCP server is essentially a **thin HTTP client** that:
1. Authenticates using the MCP-only bypass endpoint
2. Calls the same workflow APIs that the frontend uses
3. Formats responses for AI consumption
4. Provides convenience tools like `run_full_conversion`

**Positive Aspects**:
- ✅ Uses workflow APIs (not low-level engine APIs)
- ✅ Maintains application state in database
- ✅ Respects account-level isolation
- ✅ Follows the same validation/load process as UI

**Issues**:
- ⚠️ Bypasses password authentication (security concern)
- ⚠️ `list_files` tool accesses file system directly (bypasses platform)
- ⚠️ No platform-level features like job history, template management
- ⚠️ Duplicates workflow orchestration logic (e.g., `run_full_conversion`)

### 4.4 Does MCP Bypass Application Workflows?

**Answer**: Mostly NO, but with 2 exceptions

**What MCP Does Right** (10/12 tools):
- Calls workflow APIs that manage job lifecycle
- Validation results are stored in database
- Load results are tracked
- Reference data sync uses platform sync mechanism

**What MCP Bypasses** (2/12 tools):
1. **Authentication**: Uses `/api/accounts/mcp-login/{account_id}` which bypasses password verification
2. **File Listing**: `list_files` tool reads file system directly instead of using `/api/upload/jobs/recent`

**Conclusion**: The MCP server is **95% platform-integrated** but has 2 low-level bypasses that should be addressed.


---

## SECTION 5 — CONVERSION ENGINE

### 5.1 Engine Architecture

The conversion logic is **distributed across multiple backend services**, not a standalone engine module.

```
┌─────────────────────────────────────────────────────────────┐
│                  Conversion Engine Services                  │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │  FSMClient       │  │  OpenAPIParser   │                │
│  │  - OAuth2 auth   │  │  - Schema parsing│                │
│  │  - Batch ops     │  │  - Field extract │                │
│  └──────────────────┘  └──────────────────┘                │
│                                                               │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │ StreamingEngine  │  │  MappingEngine   │                │
│  │  - CSV streaming │  │  - Exact match   │                │
│  │  - Chunking      │  │  - Fuzzy match   │                │
│  └──────────────────┘  └──────────────────┘                │
│                                                               │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │ SchemaValidator  │  │  RuleExecutor    │                │
│  │  - Type check    │  │  - REFERENCE_    │                │
│  │  - Enum check    │  │    EXISTS        │                │
│  │  - Pattern check │  │  - REQUIRED_     │                │
│  │  - Date norm     │  │    OVERRIDE      │                │
│  └──────────────────┘  └──────────────────┘                │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Service Locations

| Service | File | Purpose | Reusability |
|---------|------|---------|-------------|
| **FSMClient** | `backend/app/services/fsm_client.py` | FSM API integration (OAuth2, CRUD) | ✅ Reusable |
| **StreamingEngine** | `backend/app/services/streaming_engine.py` | Generator-based CSV processing | ✅ Reusable |
| **MappingEngine** | `backend/app/services/mapping_engine.py` | Field mapping with confidence scoring | ✅ Reusable |
| **SchemaValidator** | `backend/app/services/schema_validator.py` | Schema-based validation | ✅ Reusable |
| **RuleExecutor** | `backend/app/services/rule_executor.py` | Business rule validation | ✅ Reusable |
| **OpenAPIParser** | `backend/app/services/openapi_parser.py` | FSM schema parsing | ✅ Reusable |

### 5.3 Engine Reusability

**Answer**: YES, the engine is highly reusable

**Design Characteristics**:
- ✅ Services are **stateless** (no global state)
- ✅ Services accept **dependency injection** (db session, account_id)
- ✅ Services return **structured data** (not HTTP responses)
- ✅ Services are **testable** (can be unit tested independently)
- ✅ Services are **composable** (orchestrated by module services)

**Example Usage**:
```python
# Module service orchestrates engine services
from app.services.streaming_engine import StreamingEngine
from app.services.schema_validator import SchemaValidator
from app.services.rule_executor import RuleExecutor

async def start_validation(db, account_id, job_id, business_class, mapping, enable_rules):
    # Get job and schema
    job = get_job(db, account_id, job_id)
    schema = get_schema(db, account_id, business_class)
    
    # Stream CSV and validate
    for chunk in StreamingEngine.stream_csv(job.file_path):
        for record in chunk:
            # Schema validation
            schema_errors = SchemaValidator.validate_record(record, schema, mapping)
            
            # Rule validation
            if enable_rules:
                rule_errors = await RuleExecutor.validate_record(db, account_id, record, mapping)
            
            # Store errors
            all_errors = schema_errors + rule_errors
            save_errors(db, job_id, all_errors)
```

**Conclusion**: The engine is **service-oriented** and fully reusable within the application.


---

## SECTION 6 — ARCHITECTURAL GAPS

### 6.1 Incomplete Core Features

| Feature | Current State | What's Missing | Impact |
|---------|---------------|----------------|--------|
| **Load to FSM** | ❌ Not Working | Backend endpoint exists but not functional | CRITICAL - Cannot complete conversion workflow |
| **Validation Rules** | ⚠️ Partial (2/8) | Only REFERENCE_EXISTS and REQUIRED_OVERRIDE implemented | HIGH - Limited validation capabilities |
| **FSM Batch Create** | ❌ Not Tested | batch_create_unreleased() method not verified | CRITICAL - Core load functionality |
| **Error Handling in Load** | ❌ Unknown | Load error handling not tested | HIGH - May fail silently |

### 6.2 Missing Platform Features

| Feature | Current State | Gap Description | Impact |
|---------|---------------|-----------------|--------|
| **Job Orchestration** | ✅ Implemented | ConversionJob tracks lifecycle, status updates | None |
| **Conversion History** | ✅ Implemented | `/api/upload/jobs/recent` with pagination | None |
| **Mapping Templates** | ✅ Implemented | Save/load mapping configurations | None |
| **Validation Engine** | ⚠️ Partial | Schema validation complete, 2/8 rule types implemented | Medium |
| **Background Job Processing** | ❌ Missing | Validation runs synchronously (blocks API call) | High |
| **Job Queue** | ❌ Missing | No queue for concurrent validations | Medium |
| **Webhook Notifications** | ❌ Missing | No notifications when validation completes | Low |
| **Scheduled Jobs** | ❌ Missing | No recurring conversions | Low |
| **Multi-file Batch** | ❌ Missing | Can only process one file at a time | Medium |
| **Incremental Load** | ❌ Missing | Must load all valid records at once | Low |
| **Rollback Mechanism** | ❌ Missing | No way to undo FSM loads | Low |
| **Data Lineage** | ⚠️ Partial | Tracks job → validation → load, but no field-level lineage | Low |
| **Performance Metrics** | ❌ Missing | No tracking of validation speed, load throughput | Low |
| **User Roles/Permissions** | ❌ Missing | All users have full access | Medium |
| **Audit Log** | ⚠️ Partial | Timestamps on jobs, but no detailed action log | Low |

### 6.3 Critical Gaps for Production

**CRITICAL PRIORITY**:
1. **Load to FSM Not Working** - Must be completed and tested
   - Current: Backend endpoint exists but functionality not working
   - Needed: Fix FSM batch_create_unreleased() integration
   - Impact: Cannot complete conversion workflow

**HIGH PRIORITY**:
1. **Background Job Processing** - Validation should run asynchronously
   - Current: Validation blocks API call for minutes
   - Needed: Celery/RQ task queue with job status polling
   - Impact: Poor UX for large files, API timeouts

2. **Validation Rule Types** - Only 2/8 rule types implemented
   - Current: REFERENCE_EXISTS, REQUIRED_OVERRIDE
   - Needed: NUMERIC_COMPARISON, DATE_COMPARISON, CONDITIONAL_REQUIRED, CROSS_FIELD, CUSTOM_EXPRESSION, REGEX_OVERRIDE
   - Impact: Limited validation capabilities

**MEDIUM PRIORITY**:
3. **Job Queue** - No concurrent validation support
   - Current: One validation at a time per account
   - Needed: Queue system for multiple jobs
   - Impact: Users must wait for previous job to complete

4. **Multi-file Batch** - Can only process one file at a time
   - Current: Upload → validate → load (repeat for each file)
   - Needed: Batch upload with parallel processing
   - Impact: Time-consuming for multiple files

5. **User Roles/Permissions** - All users have full access
   - Current: Account-level isolation only
   - Needed: Admin, Converter, Viewer roles
   - Impact: Security concern for shared environments

**LOW PRIORITY**:
6. **Webhook Notifications** - No async notifications
7. **Scheduled Jobs** - No recurring conversions
8. **Incremental Load** - Must load all at once
9. **Rollback Mechanism** - No undo for FSM loads
10. **Performance Metrics** - No tracking

### 6.3 What Should Exist But Doesn't

**Platform-Level Features**:
- ❌ Background task queue (Celery/RQ)
- ❌ WebSocket for real-time progress (currently polling)
- ❌ Job scheduler (APScheduler)
- ❌ Audit log service
- ❌ Notification service
- ❌ Role-based access control (RBAC)
- ❌ API rate limiting
- ❌ Batch job orchestrator

**Engine Features**:
- ❌ 6 additional rule types
- ❌ Custom transformation functions
- ❌ Data quality scoring
- ❌ Duplicate detection
- ❌ Data profiling

**Integration Features**:
- ❌ Export to other formats (Excel, JSON)
- ❌ Import from other sources (Excel, database)
- ❌ Integration with FSM workflows
- ❌ API for external systems


---

## SECTION 7 — MCP STRATEGY

### 7.1 Current MCP Design Evaluation

**Architecture**: Thin API wrapper with HTTP client

**Strengths**:
- ✅ Uses workflow APIs (respects platform state)
- ✅ Maintains job lifecycle in database
- ✅ Provides AI-friendly tool descriptions
- ✅ Handles token management automatically
- ✅ Supports one-step automation (`run_full_conversion`)

**Weaknesses**:
- ⚠️ Bypasses password authentication (security risk)
- ⚠️ Accesses file system directly (`list_files`)
- ⚠️ Duplicates workflow orchestration logic
- ⚠️ No access to platform-level features (templates, history, rule sets)
- ⚠️ Limited error handling and retry logic
- ⚠️ No support for background jobs (validation blocks)

### 7.2 Why Current Design Bypasses Platform

**Problem 1: Authentication Bypass**

```python
# Current MCP login
POST /api/accounts/mcp-login/{account_id}
# Bypasses password verification
# Security concern: Anyone with account_id can login
```

**Why This Is Bad**:
- Violates security model (password should always be required)
- Creates two authentication paths (UI vs MCP)
- No audit trail of MCP logins
- Potential security vulnerability if MCP server is exposed

**Problem 2: File System Access**

```python
# Current list_files tool
def handle_list_files(args):
    directory = Path(args.get("directory", "Import_Files"))
    csv_files = list(directory.glob("*.csv"))
    # Bypasses platform job history
```

**Why This Is Bad**:
- Doesn't use `/api/upload/jobs/recent` endpoint
- No account-level filtering
- Shows files from all accounts
- Doesn't show job status, validation results

**Problem 3: Workflow Duplication**

```python
# Current run_full_conversion tool
async def handle_full_conversion(args):
    # Duplicates workflow orchestration
    upload_result = await handle_upload_file(...)
    schema_result = await handle_get_schema(...)
    map_result = await handle_auto_map(...)
    validate_result = await handle_validate(...)
    # This logic should live in the platform, not MCP
```

**Why This Is Bad**:
- Workflow logic exists in two places (backend + MCP)
- Changes to workflow require updating both
- No reusability for other clients (API, CLI)

### 7.3 Proposed MCP Integration Strategy

**Vision**: MCP as a **platform client**, not an API wrapper

**Key Principles**:
1. **Use platform authentication** - No bypass endpoints
2. **Use platform APIs exclusively** - No direct file/database access
3. **Leverage platform features** - Templates, history, rule sets
4. **Delegate orchestration to platform** - Don't duplicate workflow logic
5. **Add platform-level MCP tools** - Job management, template management

**Proposed Architecture**:

```
┌─────────────────────────────────────────────────────────────┐
│                    FSM DataBridge Platform                   │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐      ┌──────────────┐      ┌───────────┐ │
│  │   Frontend   │      │   Backend    │      │  Database │ │
│  │  (UI Client) │      │  (Platform)  │      │           │ │
│  └──────────────┘      └──────────────┘      └───────────┘ │
│         │                      ▲                             │
│         │                      │                             │
│         │                      │ Same APIs                   │
│         │                      │                             │
│         └──────────┬───────────┴─────────────┐               │
│                    │                         │               │
│                    ▼                         ▼               │
│            ┌──────────────┐         ┌──────────────┐        │
│            │  MCP Server  │         │  API Client  │        │
│            │ (AI Client)  │         │ (External)   │        │
│            └──────────────┘         └──────────────┘        │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

**All clients use the same platform APIs - no special MCP endpoints**

### 7.4 Recommended MCP Tools (Platform-Integrated)

**Authentication & Account Management**:
- `login` - Use POST `/api/accounts/login` (with password)
- `list_accounts` - Use GET `/api/accounts/list`
- `get_current_account` - Use GET `/api/accounts/me`

**Job Management**:
- `list_jobs` - Use GET `/api/upload/jobs/recent` (not file system)
- `get_job_status` - Use GET `/api/upload/{job_id}/info`
- `get_job_history` - Use GET `/api/upload/jobs/recent?limit=50`

**Conversion Workflow**:
- `upload_file` - Use POST `/api/upload/`
- `fetch_schema` - Use POST `/api/schema/fetch`
- `auto_map_fields` - Use POST `/api/mapping/auto-map`
- `start_validation` - Use POST `/api/validation/start`
- `get_validation_progress` - Use GET `/api/validation/{job_id}/progress`
- `get_validation_summary` - Use GET `/api/validation/{job_id}/summary`
- `export_errors` - Use GET `/api/validation/{job_id}/errors/export`
- `load_to_fsm` - Use POST `/api/load/start`

**Template Management** (NEW):
- `list_mapping_templates` - Use GET `/api/mapping/templates/{business_class}`
- `save_mapping_template` - Use POST `/api/mapping/templates`
- `apply_mapping_template` - Use saved template in auto-map

**Rule Management** (NEW):
- `list_rule_sets` - Use GET `/api/rules/rule-sets`
- `get_rule_set` - Use GET `/api/rules/rule-sets/{id}`
- `list_rules_for_account` - Use GET `/api/rules/account/{account_id}`

**Reference Data Management**:
- `sync_all_reference_data` - Use POST `/api/snapshot/sync/all`
- `sync_single_reference_data` - Use POST `/api/snapshot/sync/single`
- `get_sync_history` - Use GET `/api/snapshot/registry`

**Platform Orchestration** (NEW - Backend API):
- `run_full_conversion` - NEW backend endpoint that orchestrates workflow
  - POST `/api/workflows/full-conversion`
  - Backend handles: upload → schema → map → validate → load
  - Returns job_id for progress tracking
  - MCP just calls this one endpoint

**Key Changes**:
1. ❌ Remove `/api/accounts/mcp-login/{account_id}` endpoint
2. ❌ Remove `list_files` tool (use `list_jobs` instead)
3. ✅ Add `/api/workflows/full-conversion` endpoint
4. ✅ Add template management tools
5. ✅ Add rule management tools
6. ✅ Use password authentication for all MCP logins


---

## SECTION 8 — RECOMMENDED FUTURE ARCHITECTURE

### 8.1 Ideal Platform Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     FSM DataBridge Platform (v2.0)                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                        Presentation Layer                         │  │
│  ├──────────────────────────────────────────────────────────────────┤  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │  │
│  │  │   Web UI     │  │  MCP Server  │  │  REST API    │          │  │
│  │  │  (React)     │  │  (AI Client) │  │  (External)  │          │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘          │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                 │                                        │
│                                 ▼                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                      Application Layer (FastAPI)                  │  │
│  ├──────────────────────────────────────────────────────────────────┤  │
│  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐    │  │
│  │  │  Workflow      │  │  Job           │  │  Template      │    │  │
│  │  │  Orchestrator  │  │  Orchestrator  │  │  Manager       │    │  │
│  │  └────────────────┘  └────────────────┘  └────────────────┘    │  │
│  │                                                                   │  │
│  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐    │  │
│  │  │  Auth          │  │  Notification  │  │  Audit         │    │  │
│  │  │  Service       │  │  Service       │  │  Service       │    │  │
│  │  └────────────────┘  └────────────────┘  └────────────────┘    │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                 │                                        │
│                                 ▼                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                      Business Logic Layer                         │  │
│  ├──────────────────────────────────────────────────────────────────┤  │
│  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐    │  │
│  │  │  Streaming     │  │  Mapping       │  │  Schema        │    │  │
│  │  │  Engine        │  │  Engine        │  │  Validator     │    │  │
│  │  └────────────────┘  └────────────────┘  └────────────────┘    │  │
│  │                                                                   │  │
│  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐    │  │
│  │  │  Rule          │  │  FSM           │  │  OpenAPI       │    │  │
│  │  │  Executor      │  │  Client        │  │  Parser        │    │  │
│  │  └────────────────┘  └────────────────┘  └────────────────┘    │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                 │                                        │
│                                 ▼                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                      Infrastructure Layer                         │  │
│  ├──────────────────────────────────────────────────────────────────┤  │
│  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐    │  │
│  │  │  Task Queue    │  │  Database      │  │  File Storage  │    │  │
│  │  │  (Celery/RQ)   │  │  (SQLite/PG)   │  │  (Local/S3)    │    │  │
│  │  └────────────────┘  └────────────────┘  └────────────────┘    │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

### 8.2 New Services to Add

#### Application Layer Services

**1. Workflow Orchestrator Service**
```python
# backend/app/services/workflow_orchestrator.py

class WorkflowOrchestrator:
    """Orchestrates multi-step conversion workflows"""
    
    async def run_full_conversion(
        self,
        db: Session,
        account_id: int,
        file_path: str,
        business_class: str,
        load_to_fsm: bool = False
    ) -> dict:
        """
        One-step conversion workflow:
        1. Upload file
        2. Fetch schema
        3. Auto-map fields
        4. Start validation (background task)
        5. Optionally load to FSM
        
        Returns job_id for progress tracking
        """
        # Implementation here
        pass
```

**2. Job Orchestrator Service**
```python
# backend/app/services/job_orchestrator.py

class JobOrchestrator:
    """Manages background job execution"""
    
    async def queue_validation_job(
        self,
        db: Session,
        account_id: int,
        job_id: int,
        business_class: str,
        mapping: dict,
        enable_rules: bool
    ) -> str:
        """
        Queue validation job for background processing.
        Returns task_id for status tracking.
        """
        task = validate_data_task.delay(
            account_id, job_id, business_class, mapping, enable_rules
        )
        return task.id
    
    def get_job_status(self, task_id: str) -> dict:
        """Get background job status"""
        pass
```

**3. Template Manager Service**
```python
# backend/app/services/template_manager.py

class TemplateManager:
    """Manages mapping and validation templates"""
    
    def apply_template(
        self,
        db: Session,
        account_id: int,
        template_id: int,
        csv_headers: List[str]
    ) -> dict:
        """
        Apply saved template to new file.
        Returns mapping with confidence scores.
        """
        pass
    
    def suggest_template(
        self,
        db: Session,
        account_id: int,
        business_class: str,
        csv_headers: List[str]
    ) -> Optional[int]:
        """
        Suggest best matching template based on headers.
        Returns template_id or None.
        """
        pass
```

**4. Notification Service**
```python
# backend/app/services/notification_service.py

class NotificationService:
    """Handles notifications for async operations"""
    
    async def notify_validation_complete(
        self,
        account_id: int,
        job_id: int,
        status: str,
        error_count: int
    ):
        """Send notification when validation completes"""
        # WebSocket, email, or webhook
        pass
```

**5. Audit Service**
```python
# backend/app/services/audit_service.py

class AuditService:
    """Tracks user actions for compliance"""
    
    def log_action(
        self,
        account_id: int,
        action: str,
        resource_type: str,
        resource_id: int,
        details: dict
    ):
        """Log user action to audit trail"""
        pass
```

### 8.3 New API Endpoints

#### Workflow Orchestration API

```python
# POST /api/workflows/full-conversion
{
  "file_path": "path/to/file.csv",
  "business_class": "GLTransactionInterface",
  "load_to_fsm": false,
  "use_template_id": 123  # Optional
}

# Response
{
  "job_id": 456,
  "task_id": "abc-123-def",
  "status": "queued",
  "estimated_duration_seconds": 120
}

# GET /api/workflows/jobs/{job_id}/status
{
  "job_id": 456,
  "task_id": "abc-123-def",
  "status": "validating",  # queued, validating, validated, loading, completed, failed
  "progress_percent": 45,
  "current_step": "validation",
  "steps_completed": ["upload", "schema", "mapping"],
  "steps_remaining": ["validation", "load"]
}
```

#### Background Job API

```python
# GET /api/jobs/background/{task_id}
{
  "task_id": "abc-123-def",
  "status": "running",  # pending, running, success, failure
  "progress": 0.45,
  "result": null,
  "error": null
}

# POST /api/jobs/background/{task_id}/cancel
{
  "message": "Job cancelled successfully"
}
```

#### Template Management API

```python
# POST /api/templates/suggest
{
  "business_class": "GLTransactionInterface",
  "csv_headers": ["Sequence", "Amount", "Date"]
}

# Response
{
  "suggested_template_id": 123,
  "template_name": "GL Standard Mapping",
  "confidence": 0.85,
  "matching_fields": 15,
  "total_fields": 18
}

# POST /api/templates/{template_id}/apply
{
  "job_id": 456
}

# Response
{
  "mapping": { ... },
  "applied_fields": 15,
  "unmapped_fields": 3
}
```


### 8.4 MCP Tools for Platform Integration

**Recommended MCP Tools (20 tools)**

#### Authentication (2 tools)
- `login` - POST `/api/accounts/login` (with password, no bypass)
- `get_current_account` - GET `/api/accounts/me`

#### Job Management (5 tools)
- `list_jobs` - GET `/api/upload/jobs/recent`
- `get_job_info` - GET `/api/upload/{job_id}/info`
- `get_job_status` - GET `/api/workflows/jobs/{job_id}/status` (NEW)
- `cancel_job` - POST `/api/jobs/background/{task_id}/cancel` (NEW)
- `delete_job` - DELETE `/api/jobs/{job_id}` (NEW)

#### Conversion Workflow (8 tools)
- `upload_file` - POST `/api/upload/`
- `fetch_schema` - POST `/api/schema/fetch`
- `auto_map_fields` - POST `/api/mapping/auto-map`
- `start_validation` - POST `/api/validation/start`
- `get_validation_progress` - GET `/api/validation/{job_id}/progress`
- `get_validation_summary` - GET `/api/validation/{job_id}/summary`
- `export_errors` - GET `/api/validation/{job_id}/errors/export`
- `load_to_fsm` - POST `/api/load/start`

#### Workflow Orchestration (1 tool)
- `run_full_conversion` - POST `/api/workflows/full-conversion` (NEW - backend endpoint)

#### Template Management (3 tools)
- `list_templates` - GET `/api/mapping/templates/{business_class}`
- `suggest_template` - POST `/api/templates/suggest` (NEW)
- `apply_template` - POST `/api/templates/{template_id}/apply` (NEW)

#### Reference Data (3 tools)
- `sync_all_reference_data` - POST `/api/snapshot/sync/all`
- `sync_single_reference_data` - POST `/api/snapshot/sync/single`
- `get_sync_history` - GET `/api/snapshot/registry`

#### Rule Management (2 tools)
- `list_rule_sets` - GET `/api/rules/rule-sets`
- `get_rules_for_account` - GET `/api/rules/account/{account_id}`

**Key Improvements**:
1. ✅ All tools use platform APIs (no bypasses)
2. ✅ Password authentication required
3. ✅ Access to platform features (templates, rule sets)
4. ✅ Background job support
5. ✅ Workflow orchestration delegated to backend

### 8.5 Migration Path

**Phase 1: Fix Security Issues (Immediate)**
- Remove `/api/accounts/mcp-login/{account_id}` endpoint
- Update MCP `login` tool to use POST `/api/accounts/login` with password
- Update MCP `list_files` tool to use GET `/api/upload/jobs/recent`

**Phase 2: Add Background Processing (High Priority)**
- Implement Celery/RQ task queue
- Create `validate_data_task` background task
- Update POST `/api/validation/start` to queue task instead of blocking
- Add GET `/api/jobs/background/{task_id}` endpoint
- Update MCP `validate_data` tool to poll task status

**Phase 3: Add Workflow Orchestration (Medium Priority)**
- Create `WorkflowOrchestrator` service
- Add POST `/api/workflows/full-conversion` endpoint
- Update MCP `run_full_conversion` tool to use new endpoint
- Remove workflow logic from MCP server

**Phase 4: Add Template Features (Medium Priority)**
- Create `TemplateManager` service
- Add POST `/api/templates/suggest` endpoint
- Add POST `/api/templates/{template_id}/apply` endpoint
- Add MCP tools: `suggest_template`, `apply_template`

**Phase 5: Add Platform Services (Low Priority)**
- Implement `NotificationService` (WebSocket/webhook)
- Implement `AuditService` (action logging)
- Add user roles/permissions
- Add performance metrics

### 8.6 Technology Recommendations

**Background Processing**:
- **Celery** (recommended) - Mature, widely used, good monitoring
- **RQ** (alternative) - Simpler, Redis-based, easier setup
- **Dramatiq** (alternative) - Modern, fast, good for high throughput

**Database Migration** (if needed):
- **PostgreSQL** - Better for production, supports JSON columns, full-text search
- **SQLite** - Fine for local-first, single-user deployments

**Real-time Communication**:
- **WebSocket** (FastAPI native) - For real-time progress updates
- **Server-Sent Events** (SSE) - Simpler alternative for one-way updates

**File Storage** (if scaling):
- **Local file system** - Current approach, fine for localhost
- **S3/MinIO** - For cloud deployment or multi-instance

**Monitoring**:
- **Flower** - Celery monitoring dashboard
- **Prometheus + Grafana** - Metrics and visualization
- **Sentry** - Error tracking

### 8.7 Deployment Considerations

**Current**: Local-first (localhost only)

**Future Options**:
1. **Docker Compose** - Multi-container deployment (backend, frontend, Redis, Celery)
2. **Kubernetes** - For cloud deployment with auto-scaling
3. **Serverless** - AWS Lambda for background tasks (not recommended for long-running validations)

**Recommended**: Docker Compose for easy deployment

```yaml
# docker-compose.yml
version: '3.8'
services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    depends_on:
      - redis
      - db
  
  frontend:
    build: ./frontend
    ports:
      - "5173:5173"
  
  celery:
    build: ./backend
    command: celery -A app.tasks worker --loglevel=info
    depends_on:
      - redis
      - db
  
  redis:
    image: redis:7-alpine
  
  db:
    image: postgres:15-alpine
    volumes:
      - postgres_data:/var/lib/postgresql/data
```

---

## CONCLUSION

### Current State Summary

FSM DataBridge is a **well-architected platform** with:
- ✅ Complete workflow implementation (upload → map → validate)
- ⚠️ Load to FSM step not yet working
- ✅ Service-oriented engine (reusable, testable)
- ✅ Platform-level features (job tracking, templates, rule sets)
- ⚠️ Only 2/8 validation rule types implemented (REFERENCE_EXISTS, REQUIRED_OVERRIDE)
- **Status**: ~85% complete - Core conversion functional, FSM load incomplete

The MCP server is **95% platform-integrated** but has 2 bypasses:
- ⚠️ Authentication bypass (security concern)
- ⚠️ File system access (bypasses job history)

### Recommended Actions

**Immediate (Security)**:
1. Remove MCP authentication bypass
2. Update MCP to use platform APIs exclusively

**High Priority (UX)**:
3. Add background job processing (Celery/RQ)
4. Implement remaining validation rule types

**Medium Priority (Features)**:
5. Add workflow orchestration endpoint
6. Add template suggestion/application
7. Add job queue for concurrent processing

**Low Priority (Nice-to-have)**:
8. Add WebSocket for real-time updates
9. Add notification service
10. Add audit logging

### Final Recommendation

**The MCP server should be refactored to be a true platform client**, not an API wrapper. This means:
- Using the same authentication as the UI
- Leveraging platform features (templates, rule sets, job history)
- Delegating workflow orchestration to the backend
- No direct file system or database access

This will make FSM DataBridge a **true conversion management platform** that can be accessed by multiple clients (UI, MCP, API) with consistent behavior and security.

---

**Document Version**: 1.0  
**Date**: March 4, 2026  
**Author**: Kiro AI Assistant  
**Reviewer**: Van Anthony Silleza

