# Requirements Document: FSM Conversion Workbench

## Introduction

The FSM Conversion Workbench is a local-first, enterprise-grade web application for FSM data conversion. It runs on localhost, processes millions of records via streaming architecture, and provides dynamic schema-driven validation with reusable rule templates. Each account represents one Project + Tenant combination with strict data isolation.

## Glossary

- **Workbench**: The complete FSM Conversion Workbench application (FastAPI backend + React frontend)
- **Account**: A Project + Tenant combination (e.g., BayCare_TRN, FPI_TST)
- **Business_Class**: FSM entity type (e.g., GLTransactionInterface, Vendor)
- **Schema_Engine**: Component that fetches and versions FSM OpenAPI schemas dynamically
- **Snapshot_Engine**: Component that syncs setup data from FSM for reference validation
- **Streaming_Engine**: Component that processes CSV files in chunks without loading into memory
- **Validation_Pipeline**: Deterministic validation flow (normalization → schema → rules → aggregation)
- **Rule_Template**: Reusable validation rule (REFERENCE_EXISTS, REQUIRED_OVERRIDE, etc.)
- **Rule_Assignment**: Assignment of rule template to GLOBAL, BUSINESS_CLASS, or ACCOUNT scope
- **Dependency_Map**: JSON configuration defining which setup Business Classes to snapshot
- **Snapshot_Table**: SQLite table storing setup data (e.g., snapshot_1_GeneralLedgerChartAccount)
- **Mapping_Template**: Saved field mapping configuration for CSV columns to FSM fields
- **Conversion_Job**: A complete conversion operation (upload → validate → load)
- **FSM_Client**: Service for FSM OAuth authentication and API calls
- **OpenAPI_Parser**: Service that parses FSM OpenAPI JSON to extract schema definitions

## Requirements

### Requirement 1: Account-Based Authentication

**User Story:** As a consultant, I want to log in using a Project+Tenant account, so that my data is isolated from other projects.

#### Acceptance Criteria

1. THE Workbench SHALL display a login screen with account dropdown and password field
2. THE Workbench SHALL store account credentials including project name, tenant ID, base URL, and encrypted FSM OAuth credentials
3. THE Workbench SHALL hash passwords using bcrypt with work factor 12
4. THE Workbench SHALL issue JWT tokens with 8-hour expiration after successful login
5. THE Workbench SHALL provide "Create New Account" option on login screen
6. THE Workbench SHALL enforce strict data isolation where all queries filter by account_id

### Requirement 2: Dynamic Schema Fetching

**User Story:** As a consultant, I want schemas fetched dynamically from FSM, so that field definitions are always current.

#### Acceptance Criteria

1. WHEN a Business Class is selected, THE Schema_Engine SHALL authenticate via FSM OAuth
2. THE Schema_Engine SHALL fetch OpenAPI JSON from FSM metadata endpoint
3. THE Schema_Engine SHALL parse components.schemas.createAllFields to extract properties, required, type, enum, and pattern
4. THE Schema_Engine SHALL flatten nested objects using dot notation (e.g., Address.City)
5. THE Schema_Engine SHALL compute SHA256 hash of schema JSON
6. THE Schema_Engine SHALL store schema with account_id, business_class, schema_json, schema_hash, version_number, and fetched_timestamp
7. IF schema_hash changes, THEN THE Schema_Engine SHALL create new version and invalidate related mapping templates

### Requirement 3: Schema Versioning

**User Story:** As a consultant, I want schema versions tracked, so that I can detect FSM schema changes.

#### Acceptance Criteria

1. THE Schema_Engine SHALL increment version_number when schema_hash changes
2. THE Workbench SHALL display current schema version in UI
3. THE Workbench SHALL provide "Refresh Schema" button to force re-fetch
4. WHEN schema version changes, THE Workbench SHALL flag affected mapping templates as invalid
5. WHEN schema version changes, THE Workbench SHALL flag rule templates for compatibility review

### Requirement 4: Snapshot Orchestration

**User Story:** As a consultant, I want setup data synced from FSM, so that reference validation works correctly.

#### Acceptance Criteria

1. THE Workbench SHALL maintain dependency_map.json defining setup Business Classes per Business Class
2. THE Workbench SHALL provide "Sync Setup Data" button
3. WHEN sync triggered, THE Snapshot_Engine SHALL fetch each dependency Business Class using LastModifiedDate delta sync
4. THE Snapshot_Engine SHALL store data in dedicated table: snapshot_{account_id}_{business_class}
5. THE Snapshot_Engine SHALL record sync metadata in snapshot_registry with account_id, business_class, last_sync_timestamp, and record_count
6. THE Workbench SHALL display last sync timestamp in header

### Requirement 5: Streaming File Processing

**User Story:** As a consultant, I want to process large CSV files without memory issues, so that I can handle millions of records.

#### Acceptance Criteria

1. THE Streaming_Engine SHALL use generator-based streaming to read CSV files
2. THE Streaming_Engine SHALL process files in configurable chunks (default 1000 rows)
3. THE Streaming_Engine SHALL never load entire file into memory
4. THE Streaming_Engine SHALL persist validation results incrementally after each chunk
5. THE Streaming_Engine SHALL support files with up to 10 million rows

### Requirement 6: Schema Structural Validation

**User Story:** As a consultant, I want records validated against FSM schema rules, so that invalid data is caught before loading.

#### Acceptance Criteria

1. THE Validation_Pipeline SHALL validate required fields are present and non-empty
2. THE Validation_Pipeline SHALL validate field types match schema (string, integer, decimal, date, boolean)
3. THE Validation_Pipeline SHALL validate enum values are in allowed list
4. THE Validation_Pipeline SHALL validate regex patterns match
5. THE Validation_Pipeline SHALL normalize date formats to FSM standard (YYYYMMDD)
6. THE Validation_Pipeline SHALL return ValidationError with field_name, invalid_value, and error_message for each failure

### Requirement 7: Reusable Rule Template System

**User Story:** As a consultant, I want to create reusable validation rules, so that I don't duplicate validation logic across projects.

#### Acceptance Criteria

1. THE Workbench SHALL support rule types: REFERENCE_EXISTS, REQUIRED_OVERRIDE, REGEX_OVERRIDE, NUMERIC_COMPARISON, DATE_COMPARISON, CONDITIONAL_REQUIRED, CROSS_FIELD, CUSTOM_EXPRESSION
2. THE Workbench SHALL store rule templates with name, business_class, rule_type, field_name, condition_expression, error_message, version, and is_active
3. THE Workbench SHALL allow rule templates to be scoped as GLOBAL (account_id = NULL), BUSINESS_CLASS, or ACCOUNT
4. THE Workbench SHALL execute rules in order: schema validation → GLOBAL rules → BUSINESS_CLASS rules → ACCOUNT rules
5. THE Workbench SHALL allow rules to be enabled/disabled per account via validation_rule_assignments

### Requirement 8: Reference Validation Against Snapshots

**User Story:** As a consultant, I want to validate that referenced records exist in FSM, so that I don't create orphaned data.

#### Acceptance Criteria

1. WHEN a rule_type is REFERENCE_EXISTS, THE Validation_Pipeline SHALL query the corresponding snapshot table
2. THE Validation_Pipeline SHALL use reference_business_class from rule template to determine snapshot table
3. IF referenced record not found in snapshot, THEN THE Validation_Pipeline SHALL return ValidationError
4. THE Validation_Pipeline SHALL cache snapshot lookups within a chunk for performance
5. THE Workbench SHALL display "Snapshot out of date" warning if last_sync_timestamp > 7 days

### Requirement 9: Intelligent Auto-Mapping

**User Story:** As a consultant, I want CSV columns auto-mapped to FSM fields, so that I save time on manual mapping.

#### Acceptance Criteria

1. THE Workbench SHALL attempt exact match between CSV column names and FSM field names (case-insensitive)
2. THE Workbench SHALL attempt fuzzy match using Levenshtein distance for near-matches
3. THE Workbench SHALL display mapping confidence score (exact, high, medium, low, unmapped)
4. THE Workbench SHALL allow manual override of auto-mapped fields
5. THE Workbench SHALL provide "Save as Template" to store mapping configuration

### Requirement 10: Mapping Template Management

**User Story:** As a consultant, I want to save and reuse field mappings, so that I don't remap the same files repeatedly.

#### Acceptance Criteria

1. THE Workbench SHALL store mapping templates with account_id, business_class, template_name, and mapping_json
2. THE Workbench SHALL provide "Load Template" dropdown on upload screen
3. WHEN template loaded, THE Workbench SHALL apply saved mappings to CSV columns
4. THE Workbench SHALL invalidate templates when schema version changes
5. THE Workbench SHALL display "Template invalid - schema changed" warning for outdated templates

### Requirement 11: Incremental Validation Results

**User Story:** As a consultant, I want validation results saved incrementally, so that I can review errors while processing continues.

#### Acceptance Criteria

1. THE Validation_Pipeline SHALL persist validation errors to database after each chunk
2. THE Workbench SHALL display real-time error count during validation
3. THE Workbench SHALL provide "View Errors" button to display errors while validation runs
4. THE Workbench SHALL store errors with conversion_job_id, row_number, field_name, invalid_value, error_type, and error_message
5. THE Workbench SHALL support filtering errors by error_type and field_name

### Requirement 12: Error Export

**User Story:** As a consultant, I want to export validation errors as CSV, so that I can fix data in Excel.

#### Acceptance Criteria

1. THE Workbench SHALL provide "Export Errors" button
2. THE exported CSV SHALL include columns: row_number, field_name, invalid_value, error_type, error_message
3. THE exported CSV SHALL be sorted by row_number
4. THE Workbench SHALL generate export file within 5 seconds for up to 100,000 errors
5. THE Workbench SHALL trigger browser download of CSV file

### Requirement 13: Chunked Batch Loading

**User Story:** As a consultant, I want validated data loaded to FSM in chunks, so that API failures don't crash the entire load.

#### Acceptance Criteria

1. THE Workbench SHALL submit validated records to FSM using /classes/{BusinessClass}/actions/CreateUnreleased/batch endpoint
2. THE Workbench SHALL load records in configurable chunks (default 1000 records)
3. THE Workbench SHALL provide checkbox "Trigger Interface After Load" (default unchecked)
4. THE Workbench SHALL display success count, failure count, and error summary after load
5. THE Workbench SHALL store load results with conversion_job_id, chunk_number, success_count, failure_count, and fsm_response

### Requirement 14: Account Management UI

**User Story:** As a consultant, I want to create and manage accounts, so that I can work with multiple projects.

#### Acceptance Criteria

1. THE Workbench SHALL provide "Create New Account" form with fields: account_name, project_name, tenant_id, base_url, client_id, client_secret, password
2. THE Workbench SHALL encrypt FSM OAuth credentials using Fernet encryption before storage
3. THE Workbench SHALL validate FSM credentials by attempting authentication before saving account
4. THE Workbench SHALL provide account list page showing all registered accounts
5. THE Workbench SHALL provide "Edit Account" and "Delete Account" options

### Requirement 15: Environment Badge Display

**User Story:** As a consultant, I want to see which environment I'm working in, so that I don't accidentally load to production.

#### Acceptance Criteria

1. THE Workbench SHALL display environment badge in header based on account_name suffix
2. THE badge SHALL be blue for TRN, yellow for TST, red for PRD
3. THE badge SHALL display tenant_id
4. THE badge SHALL be prominently visible on all pages
5. THE Workbench SHALL display account_name in bold in header

### Requirement 16: Dashboard Overview

**User Story:** As a consultant, I want a dashboard showing recent activity, so that I can track my conversion work.

#### Acceptance Criteria

1. THE Workbench SHALL display dashboard with recent conversion jobs (last 10)
2. THE dashboard SHALL show job status (pending, validating, validated, loading, completed, failed)
3. THE dashboard SHALL show record counts (total, valid, invalid)
4. THE dashboard SHALL show last snapshot sync timestamp
5. THE dashboard SHALL provide quick actions: New Conversion, Sync Snapshots, View Rules

### Requirement 17: Custom Rule Management UI

**User Story:** As a consultant, I want to create and manage validation rules, so that I can enforce project-specific requirements.

#### Acceptance Criteria

1. THE Workbench SHALL provide "Custom Rules" page listing all rule templates
2. THE Workbench SHALL provide "Create Rule" form with fields: name, business_class, rule_type, field_name, condition_expression, error_message
3. THE Workbench SHALL provide rule assignment interface to enable/disable rules per account
4. THE Workbench SHALL display rule scope (GLOBAL, BUSINESS_CLASS, ACCOUNT)
5. THE Workbench SHALL provide "Test Rule" function to validate rule logic against sample data

### Requirement 18: Conversion Job History

**User Story:** As a consultant, I want to view past conversion jobs, so that I can track what data was loaded.

#### Acceptance Criteria

1. THE Workbench SHALL store conversion jobs with account_id, business_class, filename, status, created_at, completed_at
2. THE Workbench SHALL provide "Reports" page listing all conversion jobs for current account
3. THE Workbench SHALL provide filtering by business_class, status, and date range
4. THE Workbench SHALL provide "View Details" to show validation errors and load results
5. THE Workbench SHALL retain job history for 90 days

### Requirement 19: Premium Enterprise UI

**User Story:** As a consultant, I want a professional-looking interface, so that the tool feels enterprise-ready.

#### Acceptance Criteria

1. THE Workbench SHALL use color scheme: Black (#000000), Red (#C8102E), White (#FFFFFF)
2. THE Workbench SHALL use matte black sidebar with white icons
3. THE Workbench SHALL use white content canvas with subtle shadows
4. THE Workbench SHALL use red accent for active elements, buttons, and errors
5. THE Workbench SHALL use sticky table headers, sortable columns, and pagination
6. THE Workbench SHALL use smooth transitions and hover effects
7. THE Workbench SHALL display loading spinners during async operations

### Requirement 20: SQLite Database Management

**User Story:** As a system, I want data stored in SQLite, so that the application is portable and requires no external database.

#### Acceptance Criteria

1. THE Workbench SHALL create SQLite database file in user data directory
2. THE Workbench SHALL create tables: accounts, schemas, snapshot_registry, conversion_jobs, validation_errors, load_results, mapping_templates, validation_rule_templates, validation_rule_assignments
3. THE Workbench SHALL create snapshot tables dynamically: snapshot_{account_id}_{business_class}
4. THE Workbench SHALL use foreign key constraints for referential integrity
5. THE Workbench SHALL create indexes on account_id, business_class, and timestamp columns for performance
