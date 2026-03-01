# Design Document: FSM Conversion Workbench

## Overview

The FSM Conversion Workbench is a local-first, enterprise-grade web application for FSM data conversion. It runs on localhost (FastAPI + React), uses SQLite for storage, and processes millions of records via streaming architecture. The system is fully dynamic and schema-driven, with no hardcoded field definitions.

### Key Design Goals

1. **Local-First**: Runs entirely on consultant machine, no cloud dependencies
2. **Streaming Architecture**: Process millions of records without memory issues
3. **Schema-Driven**: Fetch and version FSM schemas dynamically
4. **Reusable Rules**: Template-based validation system
5. **Account Isolation**: Strict data segregation per Project+Tenant
6. **Enterprise UI**: Premium black/red/white design

### Technology Stack

- **Backend**: FastAPI (Python 3.11+) with async/await
- **Frontend**: React 18 + TypeScript + Vite
- **Database**: SQLite 3
- **Authentication**: JWT tokens with bcrypt
- **FSM Integration**: OAuth2 password grant
- **File Processing**: Generator-based streaming (no pandas)

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    React Frontend (localhost:3000)           │
│  - Account Login                                             │
│  - Schema Management                                         │
│  - Snapshot Sync                                             │
│  - File Upload & Mapping                                     │
│  - Validation Dashboard                                      │
│  - Load Management                                           │
└─────────────────────────────────────────────────────────────┘
                            ↓ HTTP/WebSocket
┌─────────────────────────────────────────────────────────────┐
│                FastAPI Backend (localhost:8000)              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  API Layer (FastAPI Routes)                         │    │
│  └─────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Service Layer                                       │    │
│  │  - FSM Client (OAuth + API calls)                   │    │
│  │  - OpenAPI Parser (schema extraction)               │    │
│  │  - Streaming Engine (CSV processing)                │    │
│  │  - Rule Executor (validation logic)                 │    │
│  └─────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Module Layer                                        │    │
│  │  - Accounts  - Schema  - Snapshot                   │    │
│  │  - Validation  - Rules  - Mapping  - Load           │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    SQLite Database                           │
│  - accounts                                                  │
│  - schemas (versioned)                                       │
│  - snapshot_registry                                         │
│  - snapshot_{account_id}_{business_class} (dynamic tables)  │
│  - conversion_jobs                                           │
│  - validation_errors                                         │
│  - load_results                                              │
│  - mapping_templates                                         │
│  - validation_rule_templates                                 │
│  - validation_rule_assignments                               │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    FSM API (External)                        │
│  - OAuth2 Authentication                                     │
│  - OpenAPI Metadata                                          │
│  - Business Class CRUD                                       │
│  - Batch Create Unreleased                                   │
└─────────────────────────────────────────────────────────────┘
```

### Backend Module Structure

```
app/
├── main.py                      # FastAPI app entry point
├── core/
│   ├── config.py                # Configuration management
│   ├── database.py              # SQLite connection and session
│   ├── security.py              # JWT and bcrypt utilities
│   └── logging.py               # Structured logging
├── modules/
│   ├── accounts/
│   │   ├── router.py            # Account API endpoints
│   │   ├── service.py           # Account business logic
│   │   └── models.py            # Account data models
│   ├── schema/
│   │   ├── router.py
│   │   ├── service.py
│   │   └── models.py
│   ├── snapshot/
│   │   ├── router.py
│   │   ├── service.py
│   │   └── models.py
│   ├── validation/
│   │   ├── router.py
│   │   ├── service.py
│   │   └── models.py
│   ├── rules/
│   │   ├── router.py
│   │   ├── service.py
│   │   └── models.py
│   ├── mapping/
│   │   ├── router.py
│   │   ├── service.py
│   │   └── models.py
│   └── load/
│       ├── router.py
│       ├── service.py
│       └── models.py
├── services/
│   ├── fsm_client.py            # FSM OAuth + API client
│   ├── openapi_parser.py        # Parse FSM OpenAPI JSON
│   ├── streaming_engine.py      # Generator-based CSV streaming
│   └── rule_executor.py         # Execute validation rules
├── models/
│   ├── account.py               # SQLAlchemy models
│   ├── schema.py
│   ├── snapshot.py
│   ├── rule.py
│   └── job.py
└── utils/
    ├── encryption.py            # Fernet encryption for credentials
    ├── normalization.py         # Date/field normalization
    └── hashing.py               # SHA256 schema hashing
```

## Database Schema (SQLite)

### accounts

```sql
CREATE TABLE accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_name TEXT UNIQUE NOT NULL,
    project_name TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    base_url TEXT NOT NULL,
    client_id_encrypted BLOB NOT NULL,
    client_secret_encrypted BLOB NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_accounts_name ON accounts(account_name);
```

### schemas

```sql
CREATE TABLE schemas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL,
    business_class TEXT NOT NULL,
    schema_json TEXT NOT NULL,
    schema_hash TEXT NOT NULL,
    version_number INTEGER NOT NULL,
    fetched_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    UNIQUE(account_id, business_class, version_number)
);

CREATE INDEX idx_schemas_account_bc ON schemas(account_id, business_class);
CREATE INDEX idx_schemas_hash ON schemas(schema_hash);
```

### snapshot_registry

```sql
CREATE TABLE snapshot_registry (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL,
    business_class TEXT NOT NULL,
    last_sync_timestamp TIMESTAMP,
    record_count INTEGER DEFAULT 0,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    UNIQUE(account_id, business_class)
);

CREATE INDEX idx_snapshot_registry_account ON snapshot_registry(account_id);
```

### Dynamic Snapshot Tables

```sql
-- Created dynamically per account and business class
-- Example: snapshot_1_GeneralLedgerChartAccount

CREATE TABLE snapshot_{account_id}_{business_class} (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    primary_key TEXT NOT NULL,
    last_modified_date TIMESTAMP,
    raw_json TEXT NOT NULL,
    -- Additional indexed columns extracted from JSON for performance
    UNIQUE(primary_key)
);

CREATE INDEX idx_snapshot_{account_id}_{business_class}_pk 
ON snapshot_{account_id}_{business_class}(primary_key);
```

### conversion_jobs

```sql
CREATE TABLE conversion_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL,
    business_class TEXT NOT NULL,
    filename TEXT NOT NULL,
    total_records INTEGER,
    valid_records INTEGER DEFAULT 0,
    invalid_records INTEGER DEFAULT 0,
    status TEXT NOT NULL, -- 'pending', 'validating', 'validated', 'loading', 'completed', 'failed'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

CREATE INDEX idx_conversion_jobs_account ON conversion_jobs(account_id);
CREATE INDEX idx_conversion_jobs_status ON conversion_jobs(status);
CREATE INDEX idx_conversion_jobs_created ON conversion_jobs(created_at DESC);
```

### validation_errors

```sql
CREATE TABLE validation_errors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversion_job_id INTEGER NOT NULL,
    row_number INTEGER NOT NULL,
    field_name TEXT NOT NULL,
    invalid_value TEXT,
    error_type TEXT NOT NULL, -- 'required', 'type', 'enum', 'pattern', 'reference', 'rule'
    error_message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversion_job_id) REFERENCES conversion_jobs(id) ON DELETE CASCADE
);

CREATE INDEX idx_validation_errors_job ON validation_errors(conversion_job_id);
CREATE INDEX idx_validation_errors_type ON validation_errors(error_type);
CREATE INDEX idx_validation_errors_field ON validation_errors(field_name);
```

### load_results

```sql
CREATE TABLE load_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversion_job_id INTEGER NOT NULL,
    chunk_number INTEGER NOT NULL,
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    fsm_response TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversion_job_id) REFERENCES conversion_jobs(id) ON DELETE CASCADE
);

CREATE INDEX idx_load_results_job ON load_results(conversion_job_id);
```

### mapping_templates

```sql
CREATE TABLE mapping_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL,
    business_class TEXT NOT NULL,
    template_name TEXT NOT NULL,
    mapping_json TEXT NOT NULL, -- {"csv_column": "fsm_field", ...}
    schema_version INTEGER NOT NULL,
    is_valid BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    UNIQUE(account_id, business_class, template_name)
);

CREATE INDEX idx_mapping_templates_account_bc ON mapping_templates(account_id, business_class);
```

### validation_rule_templates

```sql
CREATE TABLE validation_rule_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    business_class TEXT, -- NULL for GLOBAL rules
    rule_type TEXT NOT NULL, -- 'REFERENCE_EXISTS', 'REQUIRED_OVERRIDE', etc.
    field_name TEXT NOT NULL,
    reference_business_class TEXT, -- For REFERENCE_EXISTS rules
    condition_expression TEXT, -- For conditional rules
    error_message TEXT NOT NULL,
    version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_rule_templates_bc ON validation_rule_templates(business_class);
CREATE INDEX idx_rule_templates_type ON validation_rule_templates(rule_type);
```

### validation_rule_assignments

```sql
CREATE TABLE validation_rule_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rule_template_id INTEGER NOT NULL,
    account_id INTEGER, -- NULL for GLOBAL assignment
    is_enabled BOOLEAN DEFAULT TRUE,
    override_error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (rule_template_id) REFERENCES validation_rule_templates(id) ON DELETE CASCADE,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    UNIQUE(rule_template_id, account_id)
);

CREATE INDEX idx_rule_assignments_rule ON validation_rule_assignments(rule_template_id);
CREATE INDEX idx_rule_assignments_account ON validation_rule_assignments(account_id);
```

## Core Services

### FSM Client Service

```python
# services/fsm_client.py

import httpx
from typing import Dict, List, Optional
from datetime import datetime, timedelta

class FSMClient:
    def __init__(self, base_url: str, client_id: str, client_secret: str):
        self.base_url = base_url
        self.client_id = client_id
        self.client_secret = client_secret
        self.access_token: Optional[str] = None
        self.token_expiry: Optional[datetime] = None
    
    async def authenticate(self) -> str:
        """OAuth2 password grant authentication"""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/oauth/token",
                data={
                    "grant_type": "password",
                    "client_id": self.client_id,
                    "client_secret": self.client_secret
                }
            )
            response.raise_for_status()
            data = response.json()
            self.access_token = data["access_token"]
            self.token_expiry = datetime.now() + timedelta(seconds=data["expires_in"])
            return self.access_token
    
    async def get_openapi_schema(self, business_class: str) -> Dict:
        """Fetch OpenAPI JSON for business class"""
        await self._ensure_authenticated()
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/api/metadata/openapi/{business_class}",
                headers={"Authorization": f"Bearer {self.access_token}"}
            )
            response.raise_for_status()
            return response.json()
    
    async def fetch_records(
        self,
        business_class: str,
        last_modified_after: Optional[datetime] = None,
        limit: int = 1000
    ) -> List[Dict]:
        """Fetch records with optional delta sync"""
        await self._ensure_authenticated()
        params = {"limit": limit}
        if last_modified_after:
            params["lastModifiedDate"] = last_modified_after.isoformat()
        
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/api/classes/{business_class}",
                headers={"Authorization": f"Bearer {self.access_token}"},
                params=params
            )
            response.raise_for_status()
            return response.json()["items"]
    
    async def batch_create_unreleased(
        self,
        business_class: str,
        records: List[Dict],
        trigger_interface: bool = False
    ) -> Dict:
        """Batch create unreleased records"""
        await self._ensure_authenticated()
        async with httpx.AsyncClient(timeout=300.0) as client:
            response = await client.post(
                f"{self.base_url}/api/classes/{business_class}/actions/CreateUnreleased/batch",
                headers={"Authorization": f"Bearer {self.access_token}"},
                json={
                    "records": records,
                    "triggerInterface": trigger_interface
                }
            )
            response.raise_for_status()
            return response.json()
    
    async def _ensure_authenticated(self):
        """Ensure token is valid, refresh if needed"""
        if not self.access_token or datetime.now() >= self.token_expiry:
            await self.authenticate()
```

### OpenAPI Parser Service

```python
# services/openapi_parser.py

from typing import Dict, List
import json

class OpenAPIParser:
    @staticmethod
    def parse_schema(openapi_json: Dict, business_class: str) -> Dict:
        """
        Parse OpenAPI JSON to extract field definitions.
        Returns structured schema with properties, required, types, enums, patterns.
        """
        try:
            create_schema = openapi_json["components"]["schemas"]["createAllFields"]
            properties = create_schema.get("properties", {})
            required = create_schema.get("required", [])
            
            fields = []
            for field_name, field_def in properties.items():
                field_info = {
                    "name": field_name,
                    "type": field_def.get("type", "string"),
                    "required": field_name in required,
                    "enum": field_def.get("enum"),
                    "pattern": field_def.get("pattern"),
                    "format": field_def.get("format"),
                    "maxLength": field_def.get("maxLength"),
                    "description": field_def.get("description")
                }
                
                # Handle nested objects - flatten with dot notation
                if field_info["type"] == "object" and "properties" in field_def:
                    nested_fields = OpenAPIParser._flatten_nested(
                        field_name,
                        field_def["properties"],
                        field_def.get("required", [])
                    )
                    fields.extend(nested_fields)
                else:
                    fields.append(field_info)
            
            return {
                "business_class": business_class,
                "fields": fields,
                "raw_schema": create_schema
            }
        except KeyError as e:
            raise ValueError(f"Invalid OpenAPI schema structure: {e}")
    
    @staticmethod
    def _flatten_nested(parent: str, properties: Dict, required: List) -> List[Dict]:
        """Flatten nested objects using dot notation"""
        fields = []
        for field_name, field_def in properties.items():
            full_name = f"{parent}.{field_name}"
            field_info = {
                "name": full_name,
                "type": field_def.get("type", "string"),
                "required": field_name in required,
                "enum": field_def.get("enum"),
                "pattern": field_def.get("pattern"),
                "format": field_def.get("format"),
                "maxLength": field_def.get("maxLength"),
                "description": field_def.get("description")
            }
            fields.append(field_info)
        return fields
```

### Streaming Engine Service

```python
# services/streaming_engine.py

import csv
from typing import Generator, Dict, Callable
from pathlib import Path

class StreamingEngine:
    @staticmethod
    def stream_csv(
        file_path: Path,
        chunk_size: int = 1000
    ) -> Generator[List[Dict], None, None]:
        """
        Stream CSV file in chunks without loading entire file into memory.
        Yields chunks of records as list of dictionaries.
        """
        with open(file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            chunk = []
            row_number = 1
            
            for row in reader:
                # Add row number for error tracking
                row['_row_number'] = row_number
                chunk.append(row)
                row_number += 1
                
                if len(chunk) >= chunk_size:
                    yield chunk
                    chunk = []
            
            # Yield remaining records
            if chunk:
                yield chunk
    
    @staticmethod
    async def process_stream(
        file_path: Path,
        processor: Callable[[List[Dict]], None],
        chunk_size: int = 1000
    ) -> Dict:
        """
        Process CSV file in streaming fashion with custom processor function.
        Returns summary statistics.
        """
        total_records = 0
        processed_chunks = 0
        
        for chunk in StreamingEngine.stream_csv(file_path, chunk_size):
            await processor(chunk)
            total_records += len(chunk)
            processed_chunks += 1
        
        return {
            "total_records": total_records,
            "processed_chunks": processed_chunks,
            "chunk_size": chunk_size
        }
```

### Rule Executor Service

```python
# services/rule_executor.py

from typing import List, Dict, Optional
from datetime import datetime
import re

class RuleExecutor:
    def __init__(self, db_session):
        self.db = db_session
        self.snapshot_cache = {}
    
    async def execute_rule(
        self,
        rule: Dict,
        record: Dict,
        account_id: int
    ) -> Optional[str]:
        """
        Execute a single validation rule against a record.
        Returns error message if validation fails, None if passes.
        """
        rule_type = rule["rule_type"]
        field_name = rule["field_name"]
        field_value = record.get(field_name)
        
        if rule_type == "REFERENCE_EXISTS":
            return await self._validate_reference(
                field_value,
                rule["reference_business_class"],
                account_id,
                rule["error_message"]
            )
        
        elif rule_type == "REQUIRED_OVERRIDE":
            if not field_value or str(field_value).strip() == "":
                return rule["error_message"]
        
        elif rule_type == "REGEX_OVERRIDE":
            pattern = rule["condition_expression"]
            if field_value and not re.match(pattern, str(field_value)):
                return rule["error_message"]
        
        elif rule_type == "NUMERIC_COMPARISON":
            return self._validate_numeric(field_value, rule)
        
        elif rule_type == "DATE_COMPARISON":
            return self._validate_date(field_value, rule)
        
        elif rule_type == "CONDITIONAL_REQUIRED":
            return self._validate_conditional(record, rule)
        
        elif rule_type == "CROSS_FIELD":
            return self._validate_cross_field(record, rule)
        
        elif rule_type == "CUSTOM_EXPRESSION":
            return self._validate_custom(record, rule)
        
        return None
    
    async def _validate_reference(
        self,
        value: str,
        reference_bc: str,
        account_id: int,
        error_message: str
    ) -> Optional[str]:
        """Validate that referenced record exists in snapshot table"""
        if not value:
            return None
        
        # Check cache first
        cache_key = f"{account_id}_{reference_bc}_{value}"
        if cache_key in self.snapshot_cache:
            return None if self.snapshot_cache[cache_key] else error_message
        
        # Query snapshot table
        table_name = f"snapshot_{account_id}_{reference_bc}"
        query = f"SELECT 1 FROM {table_name} WHERE primary_key = ? LIMIT 1"
        result = await self.db.execute(query, (value,))
        exists = result.fetchone() is not None
        
        # Cache result
        self.snapshot_cache[cache_key] = exists
        
        return None if exists else error_message
    
    def _validate_numeric(self, value, rule) -> Optional[str]:
        """Validate numeric comparisons"""
        try:
            num_value = float(value)
            condition = rule["condition_expression"]  # e.g., "> 0", "<= 100"
            if not eval(f"{num_value} {condition}"):
                return rule["error_message"]
        except (ValueError, TypeError):
            return rule["error_message"]
        return None
    
    def _validate_date(self, value, rule) -> Optional[str]:
        """Validate date comparisons"""
        # Implementation for date validation
        pass
    
    def _validate_conditional(self, record, rule) -> Optional[str]:
        """Validate conditional required fields"""
        # Implementation for conditional validation
        pass
    
    def _validate_cross_field(self, record, rule) -> Optional[str]:
        """Validate cross-field rules"""
        # Implementation for cross-field validation
        pass
    
    def _validate_custom(self, record, rule) -> Optional[str]:
        """Validate custom expression rules"""
        # Implementation for custom expression validation
        pass
```
