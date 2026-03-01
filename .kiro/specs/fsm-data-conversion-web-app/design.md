# Design Document: FSM Data Conversion Web Application

## Overview

The FSM Data Conversion Web Application is an enterprise-grade internal tool that enables Infor consultants to validate, convert, and load large-scale datasets (1,000 to 2,000,000 records) into FSM systems with reliability and transparency. The system addresses critical pain points in current conversion workflows through chunked processing with checkpoint/resume capabilities, comprehensive pre-validation, reference data checking, and detailed audit trails.

### Key Design Goals

1. **Reliability**: Process millions of records without memory issues or cascading failures
2. **Recoverability**: Resume failed conversions from checkpoints without reprocessing successful chunks
3. **Transparency**: Provide real-time progress tracking and detailed error reporting
4. **Data Integrity**: Validate all records against FSM business class rules before submission
5. **Auditability**: Maintain complete conversion history with timestamps and outcomes

### Technology Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: FastAPI (Python 3.11+) with async/await
- **Job Queue**: Celery 5.3+ with Valkey as message broker
- **Database**: PostgreSQL 15+ with asyncpg driver
- **Authentication**: JWT tokens with bcrypt password hashing
- **FSM Integration**: OAuth2 client credentials flow

## Architecture

### System Architecture Diagram

```mermaid
graph TB
    subgraph "Frontend Layer"
        UI[React UI]
        WS[WebSocket Client]
    end
    
    subgraph "Backend Layer"
        API[FastAPI Server]
        Auth[Auth Service]
        FileParser[File Parser]
        ValidationEngine[Validation Engine]
        ProgressTracker[Progress Tracker]
    end
    
    subgraph "Job Processing Layer"
        Celery[Celery Workers]
        ChunkProcessor[Chunk Processor]
        FSMLoader[FSM Loader]
        ErrorRecovery[Error Recovery]
    end
    
    subgraph "Data Layer"
        DB[(PostgreSQL)]
        Cache[(Valkey Cache)]
        Queue[Valkey Queue]
    end
    
    subgraph "External Systems"
        FSM[FSM API]
    end
    
    UI --> API
    UI --> WS
    API --> Auth
    API --> FileParser
    API --> ValidationEngine
    API --> ProgressTracker
    API --> DB
    API --> Queue
    
    Queue --> Celery
    Celery --> ChunkProcessor
    ChunkProcessor --> ValidationEngine
    ChunkProcessor --> FSMLoader
    ChunkProcessor --> ErrorRecovery
    ChunkProcessor --> DB
    ChunkProcessor --> Cache
    
    FSMLoader --> FSM
    Auth --> FSM
    ValidationEngine --> Cache
    
    ProgressTracker --> WS
```

### Component Interaction Flow

1. **File Upload Flow**: Frontend → API → FileParser → Database
2. **Job Creation Flow**: Frontend → API → Database → Celery Queue
3. **Processing Flow**: Celery Worker → ChunkProcessor → ValidationEngine → FSMLoader → FSM API
4. **Progress Updates**: ChunkProcessor → ProgressTracker → WebSocket → Frontend
5. **Error Recovery Flow**: Frontend → API → ErrorRecovery → ChunkProcessor

### Architectural Patterns

- **Async Processing**: All I/O-bound operations use async/await for concurrency
- **Task Queue Pattern**: Long-running conversions execute as Celery tasks
- **Checkpoint Pattern**: Each chunk completion creates a checkpoint for resume capability
- **Circuit Breaker**: FSM API calls implement exponential backoff and circuit breaking
- **Cache-Aside**: Reference data and schemas cached with TTL to minimize API calls

## Components and Interfaces

### Frontend Components

#### ConversionJobForm Component

**Responsibility**: Collect conversion job configuration from consultant

**Props**:
- `tenants: FSMTenant[]` - Available FSM tenants
- `onSubmit: (config: JobConfig) => Promise<void>` - Job creation callback

**State**:
- `selectedFile: File | null`
- `selectedTenant: string`
- `businessClass: string`
- `chunkSize: number` (1000-5000)
- `validationMode: 'strict' | 'lenient'`
- `enableReferenceValidation: boolean`

**Interface**:
```typescript
interface JobConfig {
  file: File;
  tenantId: string;
  businessClass: string;
  chunkSize: number;
  validationMode: 'strict' | 'lenient';
  enableReferenceValidation: boolean;
  fieldMapping?: Record<string, string>;
}
```

#### ProgressDashboard Component

**Responsibility**: Display real-time conversion progress and chunk status

**Props**:
- `jobId: string` - Conversion job identifier
- `onPause: () => void`
- `onResume: () => void`
- `onCancel: () => void`

**State**:
- `currentChunk: number`
- `totalChunks: number`
- `successfulRecords: number`
- `failedRecords: number`
- `chunkStatuses: ChunkStatus[]`
- `estimatedTimeRemaining: number`

**WebSocket Events**:
- `chunk_completed` - Update chunk status and counts
- `job_completed` - Show completion notification
- `job_failed` - Show error notification

#### ErrorReportViewer Component

**Responsibility**: Display validation errors with filtering and export

**Props**:
- `jobId: string`
- `errors: ValidationError[]`

**Features**:
- Filter by error type or field name
- Display top 10 most common errors
- Export errors as CSV
- Pagination for large error sets

### Backend Services

#### FileParserService

**Responsibility**: Parse CSV/Excel files and detect business class

**Methods**:
```python
async def parse_file(
    file_content: bytes,
    filename: str,
    delimiter: str = ',',
    business_class: Optional[str] = None
) -> ParsedFile:
    """Parse file and return structured records"""
    
async def detect_business_class(
    filename: str,
    headers: List[str]
) -> Optional[str]:
    """Auto-detect business class from filename or headers"""
    
async def apply_field_mapping(
    records: List[Dict],
    mapping: Dict[str, str]
) -> List[Dict]:
    """Transform source columns to FSM field names"""
```

**Return Type**:
```python
@dataclass
class ParsedFile:
    business_class: str
    records: List[Dict[str, Any]]
    total_count: int
    headers: List[str]
    detected: bool  # True if auto-detected
```

#### ValidationEngineService

**Responsibility**: Validate records against FSM business class schemas

**Methods**:
```python
async def validate_chunk(
    records: List[Dict],
    business_class: str,
    schema: BusinessClassSchema,
    enable_reference_validation: bool = False
) -> ValidationResult:
    """Validate all records in chunk"""
    
async def validate_required_fields(
    record: Dict,
    schema: BusinessClassSchema
) -> List[ValidationError]:
    """Check all required fields are present"""
    
async def validate_field_types(
    record: Dict,
    schema: BusinessClassSchema
) -> List[ValidationError]:
    """Check field values match expected types"""
    
async def validate_field_lengths(
    record: Dict,
    schema: BusinessClassSchema
) -> List[ValidationError]:
    """Check field lengths don't exceed maximums"""
    
async def validate_references(
    record: Dict,
    schema: BusinessClassSchema,
    fsm_client: FSMClient
) -> List[ValidationError]:
    """Verify referenced records exist in FSM"""
```

**Return Type**:
```python
@dataclass
class ValidationResult:
    valid_records: List[Dict]
    invalid_records: List[Dict]
    errors: List[ValidationError]
    validation_time: float
    
@dataclass
class ValidationError:
    record_number: int
    field_name: str
    invalid_value: Any
    error_type: str  # 'required', 'type', 'length', 'reference'
    error_message: str
```

#### ChunkProcessorService

**Responsibility**: Process individual chunks with validation and loading

**Methods**:
```python
async def process_chunk(
    job_id: str,
    chunk_id: str,
    records: List[Dict],
    config: JobConfig
) -> ChunkResult:
    """Process single chunk: validate and load to FSM"""
    
async def create_checkpoint(
    job_id: str,
    chunk_number: int,
    records_processed: int
) -> Checkpoint:
    """Save checkpoint for resume capability"""
    
async def resume_from_checkpoint(
    job_id: str
) -> int:
    """Get chunk number to resume from"""
```

**Return Type**:
```python
@dataclass
class ChunkResult:
    chunk_id: str
    status: str  # 'completed', 'failed', 'skipped'
    records_processed: int
    validation_errors: List[ValidationError]
    fsm_response: Optional[Dict]
    processing_time: float
```

#### FSMLoaderService

**Responsibility**: Submit validated records to FSM API

**Methods**:
```python
async def load_chunk(
    records: List[Dict],
    business_class: str,
    tenant: FSMTenant
) -> FSMLoadResult:
    """Submit chunk to FSM batch create endpoint"""
    
async def authenticate(
    tenant: FSMTenant
) -> str:
    """Get OAuth2 access token for FSM tenant"""
    
async def retry_with_backoff(
    operation: Callable,
    max_retries: int = 3
) -> Any:
    """Retry operation with exponential backoff"""
```

**Return Type**:
```python
@dataclass
class FSMLoadResult:
    success: bool
    records_created: int
    fsm_response: Dict
    errors: List[str]
```

#### ProgressTrackerService

**Responsibility**: Track and broadcast conversion progress

**Methods**:
```python
async def update_progress(
    job_id: str,
    chunk_number: int,
    status: str,
    records_processed: int
) -> None:
    """Update job progress and broadcast to WebSocket"""
    
async def get_progress(
    job_id: str
) -> JobProgress:
    """Get current job progress"""
    
async def calculate_eta(
    job_id: str
) -> int:
    """Calculate estimated time remaining in seconds"""
```

**Return Type**:
```python
@dataclass
class JobProgress:
    job_id: str
    current_chunk: int
    total_chunks: int
    successful_records: int
    failed_records: int
    status: str
    estimated_time_remaining: int
    chunk_statuses: List[ChunkStatus]
```

### API Endpoints

#### Authentication Endpoints

```
POST /api/auth/login
Request: { username: string, password: string }
Response: { access_token: string, token_type: "bearer", expires_in: 86400 }

POST /api/auth/register
Request: { username: string, password: string, email: string }
Response: { user_id: string, username: string }

GET /api/auth/me
Headers: Authorization: Bearer <token>
Response: { user_id: string, username: string, email: string }
```

#### Tenant Management Endpoints

```
GET /api/tenants
Headers: Authorization: Bearer <token>
Response: { tenants: FSMTenant[] }

POST /api/tenants
Request: { name: string, base_url: string, client_id: string, client_secret: string }
Response: { tenant_id: string }

PUT /api/tenants/{tenant_id}
Request: { name?: string, base_url?: string, client_id?: string, client_secret?: string }
Response: { tenant_id: string }

DELETE /api/tenants/{tenant_id}
Response: { success: boolean }
```

#### File Upload Endpoints

```
POST /api/files/upload
Headers: Authorization: Bearer <token>
Content-Type: multipart/form-data
Request: { file: File }
Response: { file_id: string, filename: string, size: number, detected_business_class?: string }

POST /api/files/parse
Request: { file_id: string, business_class: string, delimiter?: string }
Response: { record_count: number, headers: string[], sample_records: Dict[] }
```

#### Job Management Endpoints

```
POST /api/jobs
Request: {
  file_id: string,
  tenant_id: string,
  business_class: string,
  chunk_size: number,
  validation_mode: string,
  enable_reference_validation: boolean,
  field_mapping?: Record<string, string>
}
Response: { job_id: string, status: "created" }

POST /api/jobs/{job_id}/start
Response: { job_id: string, status: "processing" }

POST /api/jobs/{job_id}/pause
Response: { job_id: string, status: "paused" }

POST /api/jobs/{job_id}/resume
Response: { job_id: string, status: "processing", resumed_from_chunk: number }

POST /api/jobs/{job_id}/cancel
Response: { job_id: string, status: "cancelled" }

GET /api/jobs/{job_id}
Response: {
  job_id: string,
  status: string,
  created_at: string,
  started_at?: string,
  completed_at?: string,
  config: JobConfig,
  progress: JobProgress
}

GET /api/jobs
Query: { status?: string, business_class?: string, limit?: number, offset?: number }
Response: { jobs: Job[], total: number }
```

#### Progress Tracking Endpoints

```
GET /api/jobs/{job_id}/progress
Response: JobProgress

GET /api/jobs/{job_id}/chunks
Response: { chunks: ChunkStatus[] }

GET /api/jobs/{job_id}/errors
Query: { error_type?: string, field_name?: string, limit?: number, offset?: number }
Response: { errors: ValidationError[], total: number }
```

#### Error Recovery Endpoints

```
POST /api/jobs/{job_id}/chunks/{chunk_id}/skip
Request: { reason: string }
Response: { chunk_id: string, status: "skipped" }

POST /api/jobs/{job_id}/chunks/{chunk_id}/retry
Request: { updated_records?: Dict[] }
Response: { chunk_id: string, status: "processing" }
```

#### Schema Management Endpoints

```
GET /api/schemas/business-classes
Query: { tenant_id: string }
Response: { business_classes: string[] }

GET /api/schemas/{business_class}
Query: { tenant_id: string, force_refresh?: boolean }
Response: { schema: BusinessClassSchema }
```

#### Export Endpoints

```
GET /api/jobs/{job_id}/export/json
Response: File download (application/json)

GET /api/jobs/{job_id}/export/csv
Response: File download (text/csv)

GET /api/jobs/{job_id}/errors/export
Response: File download (text/csv)
```

#### Health Check Endpoint

```
GET /api/health
Response: {
  status: "healthy" | "degraded" | "unhealthy",
  components: {
    database: { status: "up" | "down", latency_ms: number },
    job_queue: { status: "up" | "down", pending_tasks: number },
    fsm_api: { status: "up" | "down", latency_ms: number }
  },
  timestamp: string
}
```

## Data Models

### Database Schema

#### consultants Table

```sql
CREATE TABLE consultants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_consultants_username ON consultants(username);
CREATE INDEX idx_consultants_email ON consultants(email);
```

#### fsm_tenants Table

```sql
CREATE TABLE fsm_tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consultant_id UUID NOT NULL REFERENCES consultants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    base_url VARCHAR(500) NOT NULL,
    client_id_encrypted BYTEA NOT NULL,
    client_secret_encrypted BYTEA NOT NULL,
    encryption_key_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(consultant_id, name)
);

CREATE INDEX idx_fsm_tenants_consultant ON fsm_tenants(consultant_id);
```

#### conversion_jobs Table

```sql
CREATE TABLE conversion_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consultant_id UUID NOT NULL REFERENCES consultants(id),
    tenant_id UUID NOT NULL REFERENCES fsm_tenants(id),
    filename VARCHAR(500) NOT NULL,
    business_class VARCHAR(255) NOT NULL,
    total_records INTEGER NOT NULL,
    successful_records INTEGER DEFAULT 0,
    failed_records INTEGER DEFAULT 0,
    chunk_size INTEGER NOT NULL,
    validation_mode VARCHAR(50) NOT NULL,
    enable_reference_validation BOOLEAN NOT NULL,
    status VARCHAR(50) NOT NULL, -- 'created', 'processing', 'paused', 'completed', 'failed', 'cancelled'
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    resumed_at TIMESTAMP,
    config JSONB NOT NULL
);

CREATE INDEX idx_conversion_jobs_consultant ON conversion_jobs(consultant_id);
CREATE INDEX idx_conversion_jobs_status ON conversion_jobs(status);
CREATE INDEX idx_conversion_jobs_created_at ON conversion_jobs(created_at DESC);
CREATE INDEX idx_conversion_jobs_business_class ON conversion_jobs(business_class);
```

#### chunks Table

```sql
CREATE TABLE chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES conversion_jobs(id) ON DELETE CASCADE,
    chunk_number INTEGER NOT NULL,
    start_record INTEGER NOT NULL,
    end_record INTEGER NOT NULL,
    status VARCHAR(50) NOT NULL, -- 'pending', 'processing', 'completed', 'failed', 'skipped'
    records_processed INTEGER DEFAULT 0,
    validation_errors INTEGER DEFAULT 0,
    fsm_response JSONB,
    error_message TEXT,
    skip_reason TEXT,
    processing_time_ms INTEGER,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    UNIQUE(job_id, chunk_number)
);

CREATE INDEX idx_chunks_job ON chunks(job_id);
CREATE INDEX idx_chunks_status ON chunks(status);
CREATE INDEX idx_chunks_chunk_number ON chunks(job_id, chunk_number);
```

#### validation_errors Table

```sql
CREATE TABLE validation_errors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chunk_id UUID NOT NULL REFERENCES chunks(id) ON DELETE CASCADE,
    record_number INTEGER NOT NULL,
    field_name VARCHAR(255) NOT NULL,
    invalid_value TEXT,
    error_type VARCHAR(100) NOT NULL, -- 'required', 'type', 'length', 'reference', 'format'
    error_message TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_validation_errors_chunk ON validation_errors(chunk_id);
CREATE INDEX idx_validation_errors_error_type ON validation_errors(error_type);
CREATE INDEX idx_validation_errors_field_name ON validation_errors(field_name);
```

#### field_mappings Table

```sql
CREATE TABLE field_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consultant_id UUID NOT NULL REFERENCES consultants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    business_class VARCHAR(255) NOT NULL,
    mapping JSONB NOT NULL, -- { "source_column": "fsm_field", ... }
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(consultant_id, name, business_class)
);

CREATE INDEX idx_field_mappings_consultant ON field_mappings(consultant_id);
CREATE INDEX idx_field_mappings_business_class ON field_mappings(business_class);
```

#### checkpoints Table

```sql
CREATE TABLE checkpoints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES conversion_jobs(id) ON DELETE CASCADE,
    chunk_number INTEGER NOT NULL,
    records_processed INTEGER NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_checkpoints_job ON checkpoints(job_id);
CREATE INDEX idx_checkpoints_created_at ON checkpoints(job_id, created_at DESC);
```

#### audit_log Table

```sql
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES conversion_jobs(id) ON DELETE SET NULL,
    consultant_id UUID REFERENCES consultants(id) ON DELETE SET NULL,
    action VARCHAR(255) NOT NULL, -- 'job_created', 'job_started', 'chunk_completed', 'chunk_skipped', etc.
    details JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_log_job ON audit_log(job_id);
CREATE INDEX idx_audit_log_consultant ON audit_log(consultant_id);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at DESC);
```

### Domain Models

#### BusinessClassSchema

```python
@dataclass
class FieldSchema:
    name: str
    type: str  # 'string', 'integer', 'decimal', 'date', 'boolean'
    required: bool
    max_length: Optional[int]
    format: Optional[str]  # 'date', 'datetime', 'email', etc.
    reference_to: Optional[str]  # Business class name if reference field
    
@dataclass
class BusinessClassSchema:
    name: str
    fields: List[FieldSchema]
    description: str
    cached_at: datetime
    ttl_seconds: int = 86400  # 24 hours
```

#### FSMTenant

```python
@dataclass
class FSMTenant:
    id: str
    consultant_id: str
    name: str
    base_url: str
    client_id: str  # Decrypted at runtime
    client_secret: str  # Decrypted at runtime
```

#### JobConfig

```python
@dataclass
class JobConfig:
    file_id: str
    tenant_id: str
    business_class: str
    chunk_size: int
    validation_mode: str  # 'strict' or 'lenient'
    enable_reference_validation: bool
    field_mapping: Optional[Dict[str, str]] = None
```

#### ChunkStatus

```python
@dataclass
class ChunkStatus:
    chunk_id: str
    chunk_number: int
    start_record: int
    end_record: int
    status: str  # 'pending', 'processing', 'completed', 'failed', 'skipped'
    records_processed: int
    validation_errors: int
    processing_time_ms: int
    error_message: Optional[str]
    skip_reason: Optional[str]
```

### Encryption Strategy

FSM tenant credentials are encrypted at rest using AES-256-GCM:

1. **Key Management**: Encryption keys stored in environment variables or key management service
2. **Key Rotation**: Support multiple encryption key IDs for key rotation
3. **Encryption**: Credentials encrypted before database insertion
4. **Decryption**: Credentials decrypted only when needed for FSM API calls
5. **Memory Safety**: Decrypted credentials cleared from memory after use

```python
from cryptography.fernet import Fernet

class CredentialEncryption:
    def __init__(self, key_id: str, key: bytes):
        self.key_id = key_id
        self.fernet = Fernet(key)
    
    def encrypt(self, plaintext: str) -> bytes:
        return self.fernet.encrypt(plaintext.encode())
    
    def decrypt(self, ciphertext: bytes) -> str:
        return self.fernet.decrypt(ciphertext).decode()
```

## Celery Task Definitions

### ConversionJobTask

```python
@celery_app.task(bind=True, max_retries=0)
def process_conversion_job(self, job_id: str) -> Dict[str, Any]:
    """
    Main Celery task for processing a conversion job.
    Orchestrates chunk processing, checkpointing, and progress tracking.
    """
    job = get_job_from_db(job_id)
    chunks = create_chunks_from_job(job)
    
    for chunk in chunks:
        try:
            result = process_chunk_sync(job_id, chunk)
            create_checkpoint(job_id, chunk.chunk_number)
            update_progress(job_id, chunk.chunk_number, result)
        except Exception as e:
            mark_chunk_failed(chunk.id, str(e))
            # Continue to next chunk (isolation)
    
    finalize_job(job_id)
    return {"job_id": job_id, "status": "completed"}
```

### ChunkProcessingTask

```python
@celery_app.task(bind=True, max_retries=3)
def process_chunk_task(self, job_id: str, chunk_id: str) -> Dict[str, Any]:
    """
    Process a single chunk: validate and load to FSM.
    Can be retried independently for error recovery.
    """
    chunk = get_chunk_from_db(chunk_id)
    job = get_job_from_db(job_id)
    
    # Validate chunk
    validation_result = validate_chunk(chunk.records, job.config)
    
    if validation_result.has_errors and job.config.validation_mode == 'strict':
        save_validation_errors(chunk_id, validation_result.errors)
        return {"status": "failed", "errors": len(validation_result.errors)}
    
    # Load to FSM
    fsm_result = load_to_fsm(validation_result.valid_records, job.config)
    
    update_chunk_status(chunk_id, "completed", fsm_result)
    return {"status": "completed", "records": len(validation_result.valid_records)}
```

## Caching Strategy

### Valkey Cache Usage

**Schema Caching**:
```python
# Key pattern: schema:{tenant_id}:{business_class}
# TTL: 24 hours
# Value: JSON serialized BusinessClassSchema

async def get_schema(tenant_id: str, business_class: str) -> BusinessClassSchema:
    cache_key = f"schema:{tenant_id}:{business_class}"
    cached = await valkey.get(cache_key)
    
    if cached:
        return BusinessClassSchema.from_json(cached)
    
    # Fetch from FSM API
    schema = await fsm_client.get_schema(business_class)
    await valkey.setex(cache_key, 86400, schema.to_json())
    return schema
```

**Reference Data Caching**:
```python
# Key pattern: ref:{tenant_id}:{business_class}:{record_id}
# TTL: 5 minutes
# Value: "exists" or "not_found"

async def check_reference_exists(
    tenant_id: str,
    business_class: str,
    record_id: str
) -> bool:
    cache_key = f"ref:{tenant_id}:{business_class}:{record_id}"
    cached = await valkey.get(cache_key)
    
    if cached:
        return cached == "exists"
    
    # Query FSM API
    exists = await fsm_client.record_exists(business_class, record_id)
    value = "exists" if exists else "not_found"
    await valkey.setex(cache_key, 300, value)
    return exists
```

**Session Storage**:
```python
# Key pattern: session:{user_id}
# TTL: 24 hours
# Value: JWT token and user metadata

async def store_session(user_id: str, token: str, metadata: Dict) -> None:
    cache_key = f"session:{user_id}"
    session_data = {"token": token, "metadata": metadata}
    await valkey.setex(cache_key, 86400, json.dumps(session_data))
```

## WebSocket Protocol

### Connection Management

```python
from fastapi import WebSocket
from typing import Dict, Set

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, Set[WebSocket]] = {}
    
    async def connect(self, job_id: str, websocket: WebSocket):
        await websocket.accept()
        if job_id not in self.active_connections:
            self.active_connections[job_id] = set()
        self.active_connections[job_id].add(websocket)
    
    def disconnect(self, job_id: str, websocket: WebSocket):
        self.active_connections[job_id].discard(websocket)
        if not self.active_connections[job_id]:
            del self.active_connections[job_id]
    
    async def broadcast_progress(self, job_id: str, message: Dict):
        if job_id in self.active_connections:
            for connection in self.active_connections[job_id]:
                await connection.send_json(message)
```

### Message Types

**Progress Update**:
```json
{
  "type": "progress_update",
  "job_id": "uuid",
  "current_chunk": 50,
  "total_chunks": 400,
  "successful_records": 250000,
  "failed_records": 1250,
  "estimated_time_remaining": 3600
}
```

**Chunk Completed**:
```json
{
  "type": "chunk_completed",
  "job_id": "uuid",
  "chunk_id": "uuid",
  "chunk_number": 50,
  "status": "completed",
  "records_processed": 5000,
  "validation_errors": 25
}
```

**Job Completed**:
```json
{
  "type": "job_completed",
  "job_id": "uuid",
  "total_records": 2000000,
  "successful_records": 1998750,
  "failed_records": 1250,
  "duration_seconds": 7200
}
```

**Error Notification**:
```json
{
  "type": "error",
  "job_id": "uuid",
  "chunk_id": "uuid",
  "error_message": "FSM API connection timeout",
  "error_type": "api_error"
}
```

## Error Handling Strategy

### Error Categories

1. **Validation Errors**: Record-level data quality issues
   - Captured and stored in database
   - Job continues processing
   - Consultant can download error report

2. **API Errors**: FSM API failures
   - Transient errors: Retry with exponential backoff (max 3 attempts)
   - Permanent errors: Mark chunk as failed, continue to next chunk
   - Rate limit errors: Introduce delay, retry

3. **System Errors**: Infrastructure failures
   - Database connection: Circuit breaker pattern, fail fast
   - Celery worker crash: Task automatically retried by Celery
   - Out of memory: Reduce chunk size recommendation

### Error Propagation

```python
class ConversionError(Exception):
    """Base exception for conversion errors"""
    pass

class ValidationError(ConversionError):
    """Record validation failed"""
    def __init__(self, record_number: int, field: str, message: str):
        self.record_number = record_number
        self.field = field
        self.message = message

class FSMAPIError(ConversionError):
    """FSM API call failed"""
    def __init__(self, status_code: int, response: Dict):
        self.status_code = status_code
        self.response = response
        self.is_transient = status_code in [429, 500, 502, 503, 504]

class SystemError(ConversionError):
    """Infrastructure failure"""
    pass
```

### Circuit Breaker for FSM API

```python
from circuitbreaker import circuit

@circuit(failure_threshold=5, recovery_timeout=60)
async def call_fsm_api(endpoint: str, data: Dict) -> Dict:
    """
    Call FSM API with circuit breaker protection.
    Opens circuit after 5 consecutive failures.
    Attempts recovery after 60 seconds.
    """
    async with httpx.AsyncClient() as client:
        response = await client.post(endpoint, json=data)
        response.raise_for_status()
        return response.json()
```

## Deployment Architecture

### Docker Compose Configuration

```yaml
version: '3.8'

services:
  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      - VITE_API_URL=http://backend:8000
      - VITE_WS_URL=ws://backend:8000/ws
    depends_on:
      - backend

  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://user:pass@postgres:5432/fsm_conversion
      - VALKEY_URL=redis://valkey:6379/0
      - JWT_SECRET=${JWT_SECRET}
      - ENCRYPTION_KEY=${ENCRYPTION_KEY}
    depends_on:
      - postgres
      - valkey
    command: uvicorn main:app --host 0.0.0.0 --port 8000

  celery_worker:
    build: ./backend
    environment:
      - DATABASE_URL=postgresql://user:pass@postgres:5432/fsm_conversion
      - VALKEY_URL=redis://valkey:6379/0
    depends_on:
      - postgres
      - valkey
    command: celery -A tasks worker --loglevel=info --concurrency=4

  postgres:
    image: postgres:15
    environment:
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
      - POSTGRES_DB=fsm_conversion
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  valkey:
    image: valkey/valkey:7.2
    ports:
      - "6379:6379"
    volumes:
      - valkey_data:/data

volumes:
  postgres_data:
  valkey_data:
```

### Environment Configuration

```bash
# .env.production
DATABASE_URL=postgresql://user:pass@postgres:5432/fsm_conversion
VALKEY_URL=redis://valkey:6379/0
JWT_SECRET=<generate-secure-random-key>
ENCRYPTION_KEY=<generate-fernet-key>
CORS_ORIGINS=https://fsm-conversion.infor.com
LOG_LEVEL=INFO
CELERY_BROKER_URL=redis://valkey:6379/0
CELERY_RESULT_BACKEND=redis://valkey:6379/1
```

## Security Considerations

### CORS Configuration

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://fsm-conversion.infor.com"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)
```

### Rate Limiting

```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@app.post("/api/jobs")
@limiter.limit("10/minute")
async def create_job(request: Request, config: JobConfig):
    # Limit job creation to 10 per minute per IP
    pass
```

### Input Validation

```python
from pydantic import BaseModel, validator, conint, constr

class JobConfigRequest(BaseModel):
    file_id: str
    tenant_id: str
    business_class: constr(min_length=1, max_length=255)
    chunk_size: conint(ge=1000, le=5000)
    validation_mode: Literal["strict", "lenient"]
    enable_reference_validation: bool
    
    @validator('file_id', 'tenant_id')
    def validate_uuid(cls, v):
        try:
            uuid.UUID(v)
        except ValueError:
            raise ValueError('Invalid UUID format')
        return v
```

### SQL Injection Prevention

```python
# Use parameterized queries with asyncpg
async def get_job(job_id: str) -> Job:
    query = "SELECT * FROM conversion_jobs WHERE id = $1"
    row = await db.fetchrow(query, job_id)
    return Job.from_row(row)
```

## Performance Optimization

### Database Connection Pooling

```python
from asyncpg import create_pool

pool = await create_pool(
    dsn=DATABASE_URL,
    min_size=10,
    max_size=50,
    command_timeout=60
)
```

### Batch Inserts for Validation Errors

```python
async def save_validation_errors_batch(
    chunk_id: str,
    errors: List[ValidationError]
) -> None:
    """Insert validation errors in single batch operation"""
    values = [
        (chunk_id, e.record_number, e.field_name, e.invalid_value, 
         e.error_type, e.error_message)
        for e in errors
    ]
    
    query = """
        INSERT INTO validation_errors 
        (chunk_id, record_number, field_name, invalid_value, error_type, error_message)
        VALUES ($1, $2, $3, $4, $5, $6)
    """
    
    async with pool.acquire() as conn:
        await conn.executemany(query, values)
```

### Query Optimization

```sql
-- Use indexes for common queries
CREATE INDEX CONCURRENTLY idx_conversion_jobs_consultant_status 
ON conversion_jobs(consultant_id, status) 
WHERE status IN ('processing', 'paused');

-- Use partial indexes for active jobs
CREATE INDEX CONCURRENTLY idx_chunks_active 
ON chunks(job_id, chunk_number) 
WHERE status IN ('pending', 'processing');
```

### Async I/O for FSM API Calls

```python
import asyncio
import httpx

async def validate_references_parallel(
    records: List[Dict],
    schema: BusinessClassSchema
) -> List[ValidationError]:
    """Validate all reference fields in parallel"""
    tasks = []
    for record in records:
        for field in schema.reference_fields:
            if field.name in record:
                task = check_reference_exists(
                    field.reference_to,
                    record[field.name]
                )
                tasks.append(task)
    
    results = await asyncio.gather(*tasks, return_exceptions=True)
    return process_validation_results(results)
```

## Testing Strategy

### Unit Tests

```python
# tests/test_validation_engine.py
import pytest
from validation_engine import ValidationEngineService

@pytest.mark.asyncio
async def test_validate_required_fields():
    schema = BusinessClassSchema(
        name="TestClass",
        fields=[FieldSchema(name="id", type="string", required=True)]
    )
    
    record = {"name": "test"}  # Missing required 'id' field
    
    engine = ValidationEngineService()
    errors = await engine.validate_required_fields(record, schema)
    
    assert len(errors) == 1
    assert errors[0].field_name == "id"
    assert errors[0].error_type == "required"
```

### Integration Tests

```python
# tests/test_conversion_flow.py
import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_full_conversion_flow(test_client: AsyncClient):
    # Upload file
    files = {"file": ("test.csv", test_csv_content, "text/csv")}
    response = await test_client.post("/api/files/upload", files=files)
    assert response.status_code == 200
    file_id = response.json()["file_id"]
    
    # Create job
    job_config = {
        "file_id": file_id,
        "tenant_id": test_tenant_id,
        "business_class": "GLTransactionInterface",
        "chunk_size": 1000,
        "validation_mode": "strict",
        "enable_reference_validation": False
    }
    response = await test_client.post("/api/jobs", json=job_config)
    assert response.status_code == 200
    job_id = response.json()["job_id"]
    
    # Start job
    response = await test_client.post(f"/api/jobs/{job_id}/start")
    assert response.status_code == 200
    
    # Poll for completion
    for _ in range(60):
        response = await test_client.get(f"/api/jobs/{job_id}")
        if response.json()["status"] == "completed":
            break
        await asyncio.sleep(1)
    
    assert response.json()["status"] == "completed"
```

### Load Tests

```python
# tests/load_test.py
from locust import HttpUser, task, between

class ConversionUser(HttpUser):
    wait_time = between(1, 3)
    
    def on_start(self):
        # Login
        response = self.client.post("/api/auth/login", json={
            "username": "test_user",
            "password": "test_pass"
        })
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    @task
    def create_conversion_job(self):
        # Simulate creating a conversion job
        self.client.post("/api/jobs", json={
            "file_id": "test-file-id",
            "tenant_id": "test-tenant-id",
            "business_class": "GLTransactionInterface",
            "chunk_size": 5000,
            "validation_mode": "strict",
            "enable_reference_validation": False
        }, headers=self.headers)
    
    @task(3)
    def check_job_progress(self):
        # Simulate checking job progress (more frequent)
        self.client.get(f"/api/jobs/{self.job_id}/progress", 
                       headers=self.headers)
```

### Performance Benchmarks

**Target Metrics**:
- File upload (10MB): < 5 seconds
- Job creation: < 500ms
- Chunk processing (5000 records): < 10 seconds
- Validation (5000 records): < 3 seconds
- FSM API load (5000 records): < 5 seconds
- Progress update latency: < 2 seconds
- Database query (job history): < 100ms
- WebSocket message delivery: < 100ms

**Load Test Scenarios**:
1. Single user, 2M records: Complete in < 2 hours
2. 10 concurrent users, 100K records each: No failures
3. 50 concurrent users, 10K records each: < 5% error rate
4. Sustained load: 100 jobs/hour for 8 hours

---

## Implementation Notes

### Phase 1: Core Infrastructure (Weeks 1-2)
- Database schema and migrations
- Authentication and JWT implementation
- File upload and parsing
- Basic API endpoints

### Phase 2: Processing Engine (Weeks 3-4)
- Celery task definitions
- Chunk processor implementation
- Validation engine
- FSM API integration

### Phase 3: Frontend (Weeks 5-6)
- React components
- WebSocket integration
- Progress dashboard
- Error reporting UI

### Phase 4: Advanced Features (Weeks 7-8)
- Reference data validation
- Field mapping configuration
- Checkpoint/resume functionality
- Error recovery workflows

### Phase 5: Testing & Deployment (Weeks 9-10)
- Unit and integration tests
- Load testing
- Docker containerization
- Production deployment

---

## Appendix: Technology Justifications

**FastAPI**: Chosen for async/await support, automatic OpenAPI documentation, and high performance (comparable to Node.js and Go).

**Celery + Valkey**: Industry-standard task queue with proven reliability at scale. Valkey chosen over Redis due to BSD license.

**PostgreSQL**: ACID compliance, excellent JSON support (JSONB), mature ecosystem, and proven reliability for audit trails.

**React + TypeScript**: Type safety reduces bugs, large ecosystem, excellent developer experience, and strong community support.

**JWT Authentication**: Stateless, scalable, industry standard, works well with microservices architecture.
