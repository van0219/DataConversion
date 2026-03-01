---
inclusion: always
---

# FSM Data Conversion Workspace Guide

## Workspace Purpose

This workspace contains the **FSM Conversion Workbench** - a complete web application for converting, validating, and loading data into Infor FSM (Financials and Supply Management) systems.

**Architecture**: Local-first web application (FastAPI + React + SQLite)  
**Users**: Infor FSM technical and functional consultants  
**Status**: Production-ready (87% complete, demo-ready, GitHub-ready)

## Workspace Evolution

### Phase 1: MCP Server (January 2026) - LEGACY
- Command-line tool with natural language interface
- 9 MCP tools for FSM operations
- Kiro AI integration
- Successfully tested with TAMICS10_AX1 tenant

### Phase 2: Web Application (March 2026) - CURRENT ⭐
- Complete browser-based application
- FastAPI backend + React frontend
- SQLite database with 10 tables
- Multi-account support
- Streaming architecture for millions of records
- Premium enterprise UI (black/red/white theme)
- Setup Data Management for reference data sync (12 FSM classes, 5,720 records)
- Local swagger files for reliable schema fetching
- Workspace organized and GitHub-ready

## AI Assistant Operating Principles

When working in this workspace:

1. **Web Application First**: The workspace is now a web application, not an MCP server
2. **Architecture Understanding**: Reference `FSM_Conversion_Workbench_Architecture.md` for system design
3. **Implementation Status**: Check `IMPLEMENTATION_STATUS.md` in root for current progress
4. **Testing**: Follow `TEST_RESULTS.md` for manual testing procedures
5. **Demo Preparation**: Use `DEMO_PREPARATION.md` for Wednesday demo setup

## Current Architecture

### Technology Stack
- **Backend**: FastAPI + SQLAlchemy + SQLite
- **Frontend**: React + TypeScript + Vite
- **Database**: 10 tables with account-level isolation
- **Security**: JWT auth, Fernet encryption, no eval()
- **Performance**: Streaming CSV processing, chunked validation

### Key Features
- Account management with encrypted FSM credentials
- Dynamic schema fetching from local swagger files (with FSM API fallback)
- Reference data snapshot sync (12 FSM setup classes, 5,720 records synced)
- Setup Data Management UI for configuring and syncing reference data
- Streaming file upload (handles millions of records)
- Intelligent auto-mapping with confidence scoring
- Real-time validation with progress tracking
- Error filtering and CSV export
- Batch loading to FSM
- Workspace organized with temp/ directories for cleanup
- GitHub-ready with comprehensive .gitignore and security measures

### Access URLs (When Running)
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

## Steering Files Reference

### NEW: FSM_Conversion_Workbench_Architecture.md ⭐
**Auto-included when**: architecture, web app, webapp, fastapi, react, implementation, structure, design, system, schema, setup, sync

**Use for**:
- Understanding web application architecture
- Technology stack details
- Backend/frontend structure
- Key design decisions
- Data flow and security features
- Performance optimizations
- Implementation status
- Schema fetching (local swagger files)
- Setup data management

**AI Action**: Primary reference for understanding the current system

### FSM_Fundamentals.md
**Auto-included when**: FSM architecture, modules, authentication, API integration mentioned

**Use for**:
- Understanding FSM terminology (GL, AP, AR, PO, IC modules)
- Multi-tenant architecture and business classes
- OAuth2 authentication flows
- API integration patterns

**AI Action**: Reference for FSM domain knowledge

### FSM_Business_Classes_Reference.md
**Auto-included when**: Business class names, field definitions, validation rules mentioned

**Use for**:
- Required fields for GLTransactionInterface, PayablesInvoice, Vendor, Customer
- Field types, formats, validation rules
- Business class relationships

**AI Action**: Reference for field requirements and validation rules

### FSM_Data_Conversion_Methodology.md
**Auto-included when**: Data conversion, field mapping, transformation, migration mentioned

**Use for**:
- Complete conversion lifecycle
- Field mapping strategies
- Validation and cleansing procedures
- Post-conversion reconciliation

**AI Action**: Reference for conversion best practices

### FSM_MCP_Server_Usage.md (LEGACY)
**Auto-included when**: MCP tools, convert, validate, load operations mentioned

**Use for**:
- Understanding the original MCP server implementation
- Comparing MCP vs web app architectures

**Note**: This documents the legacy MCP server. The workspace is now a web application.

### MCP_Tools_Implementation_Status.md (LEGACY)
**Auto-included when**: MCP status, MCP implementation mentioned

**Use for**:
- Understanding original MCP tool capabilities

**Note**: For current web app status, see `IMPLEMENTATION_STATUS.md` in root directory.

### Workspace_Learning_Management.md
**Auto-included when**: Documentation, steering files, knowledge management mentioned

**Use for**:
- Creating/updating steering files
- Documentation standards
- Continuous improvement process

**AI Action**: Follow when updating workspace documentation

## Decision Trees for Common Tasks

### Task: Setup and Run the Application

```text
User wants to run the app → Check setup status
  ├─ First time? → Follow QUICK_START.md
  ├─ Dependencies installed? → Start servers
  └─ Need detailed setup? → Follow SETUP_GUIDE.md
```

**Action**: Install dependencies, initialize database, start servers  
**Reference**: `QUICK_START.md` or `SETUP_GUIDE.md` in root directory

### Task: Test the Application

```text
User wants to test → Check what to test
  ├─ Backend health? → Open http://localhost:8000/health
  ├─ API docs? → Open http://localhost:8000/docs
  ├─ Frontend? → Open http://localhost:5173
  └─ Full workflow? → Follow TEST_RESULTS.md
```

**Action**: Follow testing checklist  
**Reference**: `TEST_RESULTS.md` or `VERIFICATION_CHECKLIST.md`

### Task: Prepare for Demo

```text
User preparing demo → Check demo materials
  ├─ Setup environment? → Follow DEMO_PREPARATION.md
  ├─ Demo script? → Follow DEMO_SCRIPT.md
  └─ Demo data? → Use Import_Files/GLTransactionInterface_DEMO.csv
```

**Action**: Follow demo preparation checklist  
**Reference**: `DEMO_PREPARATION.md` and `DEMO_SCRIPT.md`

### Task: Understand Implementation Status

```text
User asks about progress → Check status documents
  ├─ Overall status? → Read FINAL_STATUS.md
  ├─ Detailed progress? → Read IMPLEMENTATION_STATUS.md
  └─ Latest session? → Read SESSION_SUMMARY.md
```

**Action**: Reference status documents  
**Reference**: Status documents in root directory

### Task: Prepare for GitHub

```text
User preparing for GitHub → Check readiness
  ├─ Verify security? → Run verify_github_ready.py
  ├─ Setup guide? → Follow GITHUB_SETUP.md
  ├─ Security info? → Read SECURITY.md
  └─ Ready status? → Check GITHUB_PREPARATION_COMPLETE.md
```

**Action**: Verify security, create repository, push code  
**Reference**: `GITHUB_SETUP.md`, `SECURITY.md`, `verify_github_ready.py`

### Task: Clean Up Workspace

```text
User wants to clean workspace → Check what to clean
  ├─ Temporary files? → Delete temp/ and backend/temp/
  ├─ Session summaries? → Already in temp/
  ├─ Test files? → Already in backend/temp/
  └─ Legacy code? → Already in temp/legacy_mcp_server/
```

**Action**: Delete temp directories safely  
**Reference**: `temp/README.md`, `backend/temp/README.md`

```text
Issue encountered → Identify issue type
  ├─ Setup issue? → Check SETUP_GUIDE.md troubleshooting
  ├─ Backend error? → Check backend terminal output
  ├─ Frontend error? → Check browser console
  └─ Database issue? → Reinitialize with init_db.py
```

**Action**: Follow troubleshooting guides  
**Reference**: `SETUP_GUIDE.md`, `QUICK_START.md`, `VERIFICATION_CHECKLIST.md`

## Workspace Conventions

### File Organization

```text
backend/                    - FastAPI application
  ├─ app/
  │   ├─ core/             - Database, security, config
  │   ├─ models/           - SQLAlchemy models (10 tables)
  │   ├─ services/         - Business logic
  │   └─ modules/          - API routers
  ├─ temp/                 - Temporary test files (can be deleted)
  ├─ uploads/              - User uploaded CSV files
  ├─ init_db.py            - Database initialization
  ├─ requirements.txt      - Python dependencies
  └─ .env                  - Environment variables (PROTECTED)

frontend/                   - React application
  ├─ src/
  │   ├─ pages/            - UI pages
  │   ├─ services/         - API client
  │   └─ App.tsx           - Main app component
  ├─ package.json          - Node dependencies
  └─ vite.config.ts        - Vite configuration

Import_Files/               - Source data files
  ├─ GLTransactionInterface_20251128.csv
  └─ GLTransactionInterface_DEMO.csv (with errors)

FSM_Swagger/                - FSM API schema definitions (13 files)
  └─ GLTransactionInterface.json

temp/                       - Temporary files (can be deleted)
  ├─ README.md             - Explains temp files
  ├─ Session summaries     - 13 status/summary files
  ├─ Debug scripts         - 7 test scripts
  └─ legacy_mcp_server/    - Legacy MCP code

.kiro/steering/             - AI assistant guidance documents
  ├─ FSM_Conversion_Workbench_Architecture.md
  ├─ FSM_Fundamentals.md
  ├─ FSM_Business_Classes_Reference.md
  ├─ FSM_Data_Conversion_Methodology.md
  └─ README.md (this file)

Root Documentation/         - Setup, demo, and status docs
  ├─ README.md             - Main documentation (updated)
  ├─ QUICK_START.md
  ├─ SETUP_GUIDE.md
  ├─ DEMO_PREPARATION.md
  ├─ DEMO_SCRIPT.md
  ├─ IMPLEMENTATION_STATUS.md
  ├─ TEST_RESULTS.md
  ├─ SECURITY.md           - Security guidelines
  ├─ GITHUB_SETUP.md       - GitHub setup guide
  └─ verify_github_ready.py - Security verification script
```

### Naming Conventions

**Demo Data Files**: Include business class name for auto-detection
- `GLTransactionInterface_DEMO.csv` → Auto-detects GLTransactionInterface
- `PayablesInvoice_data.csv` → Auto-detects PayablesInvoice

**Database Files**: SQLite database in backend folder
- `backend/fsm_workbench.db` → Main database
- `backend/uploads/` → Uploaded CSV files (named with job_id)

**Environment Files**: Configuration in .env
- `backend/.env` → JWT keys, encryption keys, database URL

### Code Style

**Python**: PEP 8, type hints, async/await for API endpoints  
**TypeScript**: Strict mode, type safety enforced  
**React**: Functional components with hooks  
**Styling**: Inline styles with black/red/white theme

## Common Patterns

### Pattern: Complete Conversion Workflow

```text
1. User Login
   ↓
2. Upload CSV File
   ├─ File saved with job_id as filename
   ├─ Headers and sample records extracted
   └─ Conversion job created
   ↓
3. Auto-Map Fields
   ├─ Fetch FSM schema
   ├─ Exact match + fuzzy match (Levenshtein)
   └─ Return confidence scores
   ↓
4. Validate Data (Streaming)
   ├─ Stream CSV in chunks (1000 records)
   ├─ Schema validation
   ├─ Rule validation
   ├─ Persist errors incrementally
   └─ Update job status
   ↓
5. Review Errors
   ├─ Display top 10 errors
   ├─ Filter by type/field
   └─ Export as CSV
   ↓
6. Load to FSM (Optional)
   ├─ Skip invalid rows
   ├─ Batch create (100 records)
   └─ Store results per chunk
```

### Pattern: Testing the Application

```text
1. Install Dependencies
   ├─ Backend: pip install -r requirements.txt
   └─ Frontend: npm install --legacy-peer-deps

2. Initialize Database
   └─ python init_db.py

3. Start Servers
   ├─ Backend: python -m uvicorn app.main:app --reload
   └─ Frontend: npm run dev

4. Test Workflow
   ├─ Create account
   ├─ Login
   ├─ Upload demo file
   ├─ Review mappings
   ├─ Start validation
   └─ View errors
```

## Troubleshooting Guide

### Setup Issues

**Dependencies won't install**
- Python: Use `--only-binary=:all:` flag
- Node: Use `--legacy-peer-deps` flag

**Database initialization fails**
- Check .env file exists with JWT_SECRET_KEY and ENCRYPTION_KEY
- Run `python init_db.py` from backend folder

**Server won't start**
- Backend: Use `python -m uvicorn` instead of `uvicorn`
- Frontend: Check port 5173 is available

### Runtime Issues

**Authentication fails**
- Check FSM credentials are correct
- Verify FSM environment is accessible
- Check backend logs for OAuth2 errors

**File upload fails**
- Check file is CSV format
- Verify uploads/ folder exists
- Check backend logs for errors

**Sync fails**
- Verify FSM credentials are correct
- Check OAuth URL format (must end with /as/)
- Use SAAK directly as username (not tenant_id#saak)
- Verify endpoint URLs in setup_business_classes table
- Check backend logs for detailed errors
- Verify FSM environment is accessible

**GitHub preparation**
- Run verify_github_ready.py to check security
- Ensure .env, .db, and .ionapi files are excluded
- Check SECURITY.md for guidelines
- Follow GITHUB_SETUP.md for deployment

## File Inclusion Strategy

**Always Included**: README.md (this file) - Provides navigation and workspace context

**Auto Included**: Steering files load automatically when keywords match
- FSM_Conversion_Workbench_Architecture.md (NEW)
- FSM_Fundamentals.md
- FSM_Business_Classes_Reference.md
- FSM_Data_Conversion_Methodology.md
- FSM_MCP_Server_Usage.md (legacy)
- MCP_Tools_Implementation_Status.md (legacy)
- Workspace_Learning_Management.md

**Benefit**: Optimizes token usage while ensuring relevant guidance is always available

## Steering File Maintenance

### When to Update

**Trigger**: Architecture changes, new features added, implementation progress, lessons learned

**Process**:
1. Identify which steering file needs update
2. Follow content structure in Workspace_Learning_Management.md
3. Update cross-references if needed
4. Add entry to version history
5. Test with sample queries to verify auto-inclusion works

### Update Targets by Change Type

| Change Type | Update File |
| ----------- | ----------- |
| Architecture change | FSM_Conversion_Workbench_Architecture.md |
| New FSM module/business class | FSM_Fundamentals.md, FSM_Business_Classes_Reference.md |
| New conversion pattern | FSM_Data_Conversion_Methodology.md |
| Implementation progress | Update root status documents |
| Documentation process | Workspace_Learning_Management.md |
| Navigation/index | README.md (this file) |

## Version History

### March 1, 2026 - Workspace Cleanup & GitHub Preparation ⭐

- **Workspace Cleanup**:
  - Created temp/ directory (26 files moved)
  - Created backend/temp/ directory (6 files moved)
  - Deleted 3 redundant documentation files
  - Updated README.md for web application
  - Organized workspace structure
- **GitHub Preparation**:
  - Created .gitignore files (root, backend, frontend)
  - Protected sensitive data (.env, .db, .ionapi)
  - Created SECURITY.md with security guidelines
  - Created GITHUB_SETUP.md with deployment guide
  - Created verify_github_ready.py verification script
  - All security checks passed (7/7)
- **Sync Functionality Fix**:
  - Fixed OAuth URL construction (missing slash)
  - Fixed base URL for setup data endpoints
  - Added response format handling (list with _fields wrapper)
  - Improved transaction handling with batch commits
  - Successfully synced 5,720 records across 12 classes
- **Status**: 87% complete (20/23 tasks), demo-ready, GitHub-ready

### March 1, 2026 - Setup Data Management & Schema Enhancements ⭐

- **Added**: Setup Data Management feature
  - New table: `setup_business_classes` with 12 FSM classes (corrected from 16)
  - New UI page: SetupDataManagement.tsx with real-time sync progress
  - Sync functionality for reference data (5,720 records synced)
  - CRUD operations for setup classes
- **Enhanced**: Schema fetching
  - Local swagger files as primary source (`FSM_Swagger/` folder, 13 files)
  - FSM API as fallback
  - GLTransactionInterface: 91 fields successfully parsed
- **Updated**: FSM_Conversion_Workbench_Architecture.md with new patterns
- **Updated**: README.md with current features
- **Status**: 87% complete (20/23 tasks), demo-ready

### March 1, 2026 - Web Application Update ⭐

- **Added**: FSM_Conversion_Workbench_Architecture.md (new steering file)
- **Updated**: README.md to reflect web application architecture
- **Marked**: MCP server files as legacy
- **Added**: Current architecture overview and decision trees
- **Updated**: File organization and conventions
- **Added**: Testing and troubleshooting guides
- **Status**: Web application is demo-ready (17/23 tasks complete)

### January 5, 2026

- **Created**: MCP_Tools_Implementation_Status.md
- **Updated**: All steering files with production validation results

### January 2026

- **Created**: Initial steering file collection
  - FSM_Fundamentals.md
  - FSM_Business_Classes_Reference.md
  - FSM_MCP_Server_Usage.md
  - FSM_Data_Conversion_Methodology.md
  - Workspace_Learning_Management.md

## Authors

**Van Anthony Silleza** - Infor FSM Technical Consultant  
FSM domain expertise, business requirements, production validation

**Kiro AI Assistant** - Development & Documentation  
Architecture, implementation, testing, documentation

*Collaborative development - January-March 2026*

---

**Current Status**: Web application is production-ready and GitHub-ready!  
**Next Steps**: Push to GitHub, prepare for demo  
**Demo Ready**: Wednesday, March 4, 2026

**Recent Additions**:
- ✅ Setup Data Management UI (12 FSM classes, 5,720 records synced)
- ✅ Local swagger file support for schema fetching (13 files)
- ✅ Sync functionality with real-time progress display
- ✅ Account-level credential management with encryption
- ✅ Workspace cleanup and organization (temp/ directories)
- ✅ GitHub preparation (security verified, 7/7 checks passed)
- ✅ Comprehensive .gitignore and security documentation
