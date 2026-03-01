# Implementation Tasks: FSM Conversion Workbench

## CRITICAL: Wednesday Demo Timeline

**Target**: Fully functional demo with GLTransactionInterface
**Architecture**: Must be complete and near-final
**Scope**: Full dynamic capability demonstrated

---

## Phase 1: Foundation (Day 1 - Monday)

### Task 1.1: Project Structure Setup
**Priority**: CRITICAL  
**Estimated**: 2 hours

**Actions**:
- Create backend folder structure (app/core, app/modules, app/services, app/models, app/utils)
- Create frontend folder structure (src/components, src/services, src/pages, src/styles)
- Set up FastAPI main.py with CORS middleware
- Set up React + TypeScript + Vite project
- Configure environment variables (.env files)
- Create requirements.txt and package.json

**Deliverable**: Clean project structure ready for development

---

### Task 1.2: SQLite Database Setup
**Priority**: CRITICAL  
**Estimated**: 3 hours

**Actions**:
- Create core/database.py with SQLAlchemy setup
- Define all SQLAlchemy models (accounts, schemas, snapshot_registry, conversion_jobs, validation_errors, load_results, mapping_templates, validation_rule_templates, validation_rule_assignments)
- Create database initialization script
- Create migration utilities for dynamic snapshot tables
- Add indexes for performance

**Deliverable**: SQLite database with all tables created

---

### Task 1.3: Authentication System
**Priority**: CRITICAL  
**Estimated**: 4 hours

**Actions**:
- Implement core/security.py (JWT token generation, bcrypt hashing, Fernet encryption)
- Create modules/accounts/service.py (account CRUD, credential encryption/decryption)
- Create modules/accounts/router.py (POST /api/auth/login, POST /api/accounts, GET /api/accounts)
- Implement JWT middleware for protected routes
- Create React login page with account dropdown
- Create React account creation form

**Deliverable**: Working login system with account management

---

## Phase 2: Schema Engine (Day 1 - Monday Evening)

### Task 2.1: FSM Client Service
**Priority**: CRITICAL  
**Estimated**: 3 hours

**Actions**:
- Implement services/fsm_client.py (OAuth2 authentication, token management)
- Implement get_openapi_schema() method
- Implement fetch_records() method for snapshot sync
- Implement batch_create_unreleased() method
- Add error handling and retry logic
- Test with real FSM sandbox environment

**Deliverable**: Working FSM API client

---

### Task 2.2: OpenAPI Parser Service
**Priority**: CRITICAL  
**Estimated**: 2 hours

**Actions**:
- Implement services/openapi_parser.py
- Parse components.schemas.createAllFields
- Extract properties, required, type, enum, pattern
- Flatten nested objects with dot notation
- Handle edge cases (missing fields, invalid structure)

**Deliverable**: Parser that extracts schema from OpenAPI JSON

---

### Task 2.3: Schema Module
**Priority**: CRITICAL  
**Estimated**: 3 hours

**Actions**:
- Implement modules/schema/service.py (fetch schema, compute SHA256 hash, version management)
- Implement modules/schema/router.py (POST /api/schema/fetch, GET /api/schema/{business_class}, POST /api/schema/refresh)
- Create React schema management page
- Display current schema version
- Show field list with types and requirements
- Add "Refresh Schema" button

**Deliverable**: Dynamic schema fetching and versioning

---

## Phase 3: Snapshot Engine (Day 2 - Tuesday Morning)

### Task 3.1: Dependency Map Configuration
**Priority**: HIGH  
**Estimated**: 1 hour

**Actions**:
- Create dependency_map.json with GLTransactionInterface dependencies
- Load configuration in snapshot service
- Validate JSON structure on startup

**Deliverable**: dependency_map.json with GLTransactionInterface setup classes

---

### Task 3.2: Snapshot Service
**Priority**: CRITICAL  
**Estimated**: 4 hours

**Actions**:
- Implement modules/snapshot/service.py
- Create dynamic snapshot tables (snapshot_{account_id}_{business_class})
- Implement delta sync using LastModifiedDate filter
- Update snapshot_registry after sync
- Handle large datasets (chunked fetching)
- Add progress tracking

**Deliverable**: Working snapshot sync for setup data

---

### Task 3.3: Snapshot UI
**Priority**: HIGH  
**Estimated**: 2 hours

**Actions**:
- Create React snapshot management page
- Display snapshot registry with last sync timestamps
- Add "Sync Setup Data" button
- Show progress during sync
- Display record counts per business class

**Deliverable**: UI for snapshot management

---

## Phase 4: File Upload & Streaming (Day 2 - Tuesday Afternoon)

### Task 4.1: Streaming Engine Service
**Priority**: CRITICAL  
**Estimated**: 3 hours

**Actions**:
- Implement services/streaming_engine.py
- Create generator-based CSV streaming
- Process in configurable chunks (default 1000)
- Never load entire file into memory
- Add row number tracking
- Test with large files (1M+ rows)

**Deliverable**: Streaming CSV processor

---

### Task 4.2: File Upload Module
**Priority**: CRITICAL  
**Estimated**: 3 hours

**Actions**:
- Implement modules/upload/router.py (POST /api/upload)
- Store uploaded files temporarily
- Create conversion_job record
- Return job_id and file metadata
- Create React file upload component with drag-and-drop

**Deliverable**: File upload functionality

---

### Task 4.3: Intelligent Auto-Mapping
**Priority**: HIGH  
**Estimated**: 4 hours

**Actions**:
- Implement mapping logic (exact match, fuzzy match with Levenshtein distance)
- Calculate confidence scores (exact, high, medium, low, unmapped)
- Create modules/mapping/service.py
- Create React mapping interface (drag-and-drop or dropdown)
- Allow manual override of mappings
- Add "Save as Template" functionality

**Deliverable**: Auto-mapping with manual override

---

## Phase 5: Validation Pipeline (Day 2 - Tuesday Evening)

### Task 5.1: Schema Validation Layer
**Priority**: CRITICAL  
**Estimated**: 4 hours

**Actions**:
- Implement modules/validation/service.py
- Validate required fields
- Validate field types (string, integer, decimal, date, boolean)
- Validate enum values
- Validate regex patterns
- Normalize date formats (MM/DD/YYYY → YYYYMMDD)
- Return structured ValidationError objects

**Deliverable**: Schema structural validation

---

### Task 5.2: Rule Executor Service
**Priority**: CRITICAL  
**Estimated**: 4 hours

**Actions**:
- Implement services/rule_executor.py
- Support rule types: REFERENCE_EXISTS, REQUIRED_OVERRIDE, REGEX_OVERRIDE, NUMERIC_COMPARISON, DATE_COMPARISON
- Query snapshot tables for REFERENCE_EXISTS
- Cache snapshot lookups for performance
- Execute rules in order: GLOBAL → BUSINESS_CLASS → ACCOUNT

**Deliverable**: Rule execution engine

---

### Task 5.3: Validation Orchestration
**Priority**: CRITICAL  
**Estimated**: 3 hours

**Actions**:
- Implement validation pipeline orchestration
- Stream CSV → Normalize → Schema Validation → Rule Validation → Persist Errors
- Process incrementally (chunk by chunk)
- Update conversion_job status in real-time
- Store validation_errors incrementally

**Deliverable**: Complete validation pipeline

---

## Phase 6: UI & Load Engine (Day 3 - Wednesday Morning)

### Task 6.1: Validation Dashboard
**Priority**: CRITICAL  
**Estimated**: 3 hours

**Actions**:
- Create React validation dashboard
- Display real-time validation progress
- Show error count by type
- Display top 10 most common errors
- Add "View Errors" button
- Add "Export Errors" button (CSV download)
- Filter errors by type and field name

**Deliverable**: Validation results UI

---

### Task 6.2: Load Module
**Priority**: CRITICAL  
**Estimated**: 3 hours

**Actions**:
- Implement modules/load/service.py
- Call FSM batch_create_unreleased in chunks
- Handle FSM API responses
- Store load_results per chunk
- Add "Trigger Interface After Load" checkbox
- Display success/failure counts

**Deliverable**: Batch loading to FSM

---

### Task 6.3: Premium UI Styling
**Priority**: HIGH  
**Estimated**: 4 hours

**Actions**:
- Implement black/red/white color scheme
- Create matte black sidebar with white icons
- Style environment badge (TRN=blue, TST=yellow, PRD=red)
- Add smooth transitions and hover effects
- Style tables (sortable, filterable, paginated, sticky headers)
- Add loading spinners
- Polish all pages for enterprise feel

**Deliverable**: Production-ready UI

---

## Phase 7: Rule Management & Dashboard (Day 3 - Wednesday Morning)

### Task 7.1: Rule Management UI
**Priority**: MEDIUM  
**Estimated**: 3 hours

**Actions**:
- Create React custom rules page
- Display rule templates list
- Add "Create Rule" form
- Show rule scope (GLOBAL, BUSINESS_CLASS, ACCOUNT)
- Add enable/disable toggle per account
- Display rule assignments

**Deliverable**: Rule management interface

---

### Task 7.2: Dashboard Page
**Priority**: MEDIUM  
**Estimated**: 2 hours

**Actions**:
- Create React dashboard page
- Display recent conversion jobs (last 10)
- Show job status with color coding
- Display last snapshot sync timestamp
- Add quick action buttons (New Conversion, Sync Snapshots, View Rules)

**Deliverable**: Dashboard overview

---

## Phase 8: Testing & Demo Prep (Day 3 - Wednesday Afternoon)

### Task 8.1: End-to-End Testing
**Priority**: CRITICAL  
**Estimated**: 3 hours

**Actions**:
- Test complete flow: Login → Schema Fetch → Snapshot Sync → Upload → Validate → Load
- Test with GLTransactionInterface sample data
- Verify all validation rules work
- Test error export
- Test with large file (100K+ rows)
- Fix any bugs found

**Deliverable**: Fully tested application

---

### Task 8.2: Demo Data Preparation
**Priority**: CRITICAL  
**Estimated**: 2 hours

**Actions**:
- Create demo account (e.g., Demo_TRN)
- Prepare GLTransactionInterface sample CSV
- Pre-configure validation rules for demo
- Create mapping template for demo
- Document demo flow steps

**Deliverable**: Demo-ready environment

---

### Task 8.3: Documentation
**Priority**: MEDIUM  
**Estimated**: 2 hours

**Actions**:
- Create README.md with setup instructions
- Document architecture decisions
- Create demo script
- Document API endpoints
- Add inline code comments

**Deliverable**: Project documentation

---

## Summary

**Total Tasks**: 23  
**Total Estimated Time**: 64 hours  
**Timeline**: 3 days (Monday-Wednesday)  
**Critical Path**: Foundation → Schema → Snapshot → Upload → Validation → Load → UI

**Day 1 (Monday)**: Tasks 1.1-2.3 (Foundation + Schema Engine)  
**Day 2 (Tuesday)**: Tasks 3.1-5.3 (Snapshot + Upload + Validation)  
**Day 3 (Wednesday)**: Tasks 6.1-8.3 (UI + Load + Testing + Demo Prep)

**Risk Mitigation**:
- Start with critical path tasks first
- Test each module as it's built
- Have fallback plan if streaming engine has issues (use smaller files)
- Prepare demo data early
