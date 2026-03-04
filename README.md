# FSM Conversion Workbench

Complete web application for Infor FSM (Financials and Supply Management) data conversion, validation, and loading. Local-first architecture with FastAPI backend and React frontend.

## 🚀 Quick Start

### First Time Setup

1. **Install Backend Dependencies**
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

2. **Initialize Database**
   ```bash
   python init_db.py
   ```

3. **Install Frontend Dependencies**
   ```bash
   cd frontend
   npm install --legacy-peer-deps
   ```

### Running the Application

**Option 1: Using Scripts (Recommended)**
```bash
# Start both servers
.\start.ps1

# Check status
.\status.ps1

# Stop both servers
.\stop.ps1

# Restart both servers
.\restart.ps1
```

**Option 2: Manual Start**

1. **Start Backend Server** (Terminal 1)
   ```bash
   cd backend
   python -m uvicorn app.main:app --reload
   ```
   Backend runs at: http://localhost:8000

2. **Start Frontend Server** (Terminal 2)
   ```bash
   cd frontend
   npm run dev
   ```
   Frontend runs at: http://localhost:5173

3. **Open Browser**
   Navigate to: http://localhost:5173

## ✅ Current Status

**Production-Ready Core** (100% complete - 23/23 tasks)

### Completed Features
- ✅ User authentication (JWT-based)
- ✅ Account management with encrypted FSM credentials
- ✅ Schema fetching (local swagger files + FSM API fallback)
- ✅ Setup data management (12 FSM reference data classes with `_fields=_all&_limit=100000`)
- ✅ Reference data sync (5,720+ records synced successfully with complete field sets)
- ✅ File upload with streaming (handles millions of records)
- ✅ Auto-mapping with confidence scoring
- ✅ Real-time validation with progress tracking
- ✅ Error filtering and CSV export
- ✅ Batch loading to FSM
- ✅ Complete UI workflow

### Remaining (Optional)
- ⏳ Rule management UI
- ⏳ Enhanced dashboard
- ⏳ End-to-end testing

## 🎯 Key Features

### 1. Account Management
- Multi-account support with account-level data isolation
- Encrypted FSM credentials (Fernet encryption)
- OAuth2 authentication with FSM

### 2. Schema Management
- Local swagger files organized by purpose:
  - `FSM_Swagger/Setup/` - Reference data classes (12 folders with JSON Schema format)
  - `FSM_Swagger/Conversion/` - Conversion target classes (GLTransactionInterface, etc.)
- FSM API as fallback
- 91 fields for GLTransactionInterface
- SHA256 versioning for schema changes
- All setup classes use `_fields=_all&_limit=100000` for complete data capture

### 3. Setup Data Management
- 12 configured FSM reference data classes (all standardized with `_fields=_all&_limit=100000`)
- One-click sync from FSM
- Real-time sync progress display
- 5,720+ reference records synced successfully

### 4. Data Conversion Workflow
1. Upload CSV file (streaming for large files)
2. Auto-map fields (exact + fuzzy matching)
3. Validate data (schema + business rules)
4. Review errors with filtering
5. Load to FSM (batch processing)

### 5. Validation Engine
- Schema validation (required, type, enum, pattern, length, date)
- Business rule validation (REFERENCE_EXISTS, REQUIRED_OVERRIDE)
- Incremental error persistence (per chunk)
- Real-time progress tracking

## 📊 Supported Business Classes

### Currently Configured
- **GLTransactionInterface** - Journal entries (91 fields)

### Reference Data Classes (12)
1. GeneralLedgerChartAccount (838 records)
2. AccountingEntity (11 records)
3. Ledger (8 records)
4. Currency (166 records)
5. FinanceEnterpriseGroup (1 record)
6. Account (656 records)
7. FinanceDimension1 (53 records)
8. FinanceDimension2 (26 records)
9. FinanceDimension3 (400 records)
10. FinanceDimension4 (1 record)
11. FinanceDimension5 (3,466 records)
12. Project (94 records)

## 📁 Project Structure

```
backend/
├── app/
│   ├── core/              # Database, security, config, logging
│   ├── models/            # SQLAlchemy models (10 tables)
│   ├── services/          # Business logic (FSM client, validation, mapping)
│   └── modules/           # API routers (accounts, schema, snapshot, upload, validation, load)
├── init_db.py             # Database initialization
├── requirements.txt       # Python dependencies
└── .env                   # Environment variables (JWT_SECRET_KEY, ENCRYPTION_KEY)

frontend/
├── src/
│   ├── pages/             # Login, ConversionWorkflow, ValidationDashboard, SetupDataManagement
│   ├── services/          # API client (Axios with JWT interceptor)
│   └── App.tsx            # Main app with routing
├── package.json           # Node dependencies
└── vite.config.ts         # Vite configuration

FSM_Swagger/                # FSM API schema definitions
  ├─ Setup/                 # Reference data classes (12 files)
  └─ Conversion/            # Conversion target classes (GLTransactionInterface, etc.)
Import_Files/               # Sample data files
.kiro/steering/             # AI assistant guidance documents
```

## 🔧 Configuration

### Environment Variables (.env)
```bash
JWT_SECRET_KEY=your-secret-key-here
ENCRYPTION_KEY=your-encryption-key-here
DATABASE_URL=sqlite:///./fsm_workbench.db
```

### FSM Connection
Configure in the web UI:
- Base URL: https://mingle-ionapi.inforcloudsuite.com
- OAuth URL: https://mingle-sso.inforcloudsuite.com:443/{TENANT_ID}/as/
- Tenant ID: Your FSM tenant
- Client ID, Client Secret, SAAK, SASK

## 🚨 Troubleshooting

### Backend Won't Start
```bash
# Use python -m uvicorn instead of uvicorn directly
cd backend
python -m uvicorn app.main:app --reload
```

### Database Issues
```bash
# Reinitialize database
cd backend
python init_db.py
```

### Frontend Issues
```bash
# Clear node_modules and reinstall
cd frontend
rm -rf node_modules
npm install --legacy-peer-deps
```

### Authentication Fails
- Verify FSM credentials are correct
- Check OAuth URL format (must end with /as/)
- Use SAAK directly as username (not tenant_id#saak)

### Sync Fails
- Verify FSM environment is accessible
- Check backend logs for detailed errors
- Verify endpoint URLs in setup_business_classes table

## 📈 Performance

- **CSV Streaming**: 1,000 records per chunk
- **Validation**: Real-time progress updates
- **FSM Loading**: 100 records per batch
- **Database**: Batch commits every 100 records
- **Sync**: Successfully synced 5,720 records across 12 classes

## 📚 Documentation

### User Guides
- **QUICK_START.md** - Fast setup guide
- **SETUP_GUIDE.md** - Detailed installation
- **USER_GUIDE.md** - Complete user manual
- **DEMO_SCRIPT.md** - Demo walkthrough

### Technical Documentation
- **README_WEBAPP.md** - Web app architecture
- **IMPLEMENTATION_STATUS.md** - Current progress
- **TEST_RESULTS.md** - Testing procedures
- **VERIFICATION_CHECKLIST.md** - QA checklist

### Steering Files (.kiro/steering/)
- **FSM_Conversion_Workbench_Architecture.md** - System architecture
- **FSM_Fundamentals.md** - FSM domain knowledge
- **FSM_Business_Classes_Reference.md** - Field definitions
- **FSM_Data_Conversion_Methodology.md** - Best practices
- **README.md** - Workspace navigation guide

## 🎓 API Documentation

When backend is running, visit:
- **Interactive API Docs**: http://localhost:8000/docs
- **Alternative Docs**: http://localhost:8000/redoc
- **Health Check**: http://localhost:8000/health

## 🔮 Future Enhancements

- Additional business classes (PayablesInvoice, Vendor, Customer)
- Rule management UI
- Enhanced dashboard with analytics
- Automated testing suite
- Docker containerization
- Multi-tenant deployment

## 🧹 Workspace Organization

### Active Files
- Root documentation (README.md, QUICK_START.md, etc.)
- Backend application (backend/)
- Frontend application (frontend/)
- FSM swagger files organized by purpose:
  - FSM_Swagger/Setup/ - Reference data classes
  - FSM_Swagger/Conversion/ - Conversion target classes
- Sample data (Import_Files/)
- Steering files (.kiro/steering/)

### Temporary Files (temp/)
- Session summaries and status reports
- Debug scripts and test files
- Legacy MCP server code
- Can be safely deleted

## 📝 Recent Updates (March 1, 2026)

### Validation Mapping Format Fix
- ✅ Fixed validation endpoint "string indices" error
- ✅ Corrected mapping format sent from frontend to backend
- ✅ Validation pipeline now fully functional
- ✅ Successfully validates records and identifies errors
- ✅ Error summary and CSV export working

### Token Refresh Implementation
- ✅ Automatic token refresh on 401 errors
- ✅ 8-hour access tokens, 30-day refresh tokens
- ✅ Request queuing during refresh
- ✅ Seamless user experience

### Upload & Mapping Enhancements
- ✅ Fixed FormData handling in upload endpoint
- ✅ Fixed Content-Type header issues
- ✅ Added searchable dropdown for manual field mapping
- ✅ Equal-width column layout with proper alignment

### Setup Data Sync Fix
- ✅ Fixed OAuth URL construction
- ✅ Fixed base URL for setup data endpoints
- ✅ Added response format handling (list with _fields wrapper)
- ✅ Improved transaction handling with batch commits
- ✅ Successfully synced all 12 setup classes (5,720+ records with complete field sets)
- ✅ All endpoints standardized with `_fields=_all&_limit=100000`

### Schema Fetching Enhancement
- ✅ Local swagger files as primary source
- ✅ FSM API as fallback
- ✅ 91 fields parsed for GLTransactionInterface

### Setup Data Management
- ✅ New UI page for managing reference data
- ✅ Real-time sync progress display
- ✅ CRUD operations for setup classes (with endpoint standardization)
- ✅ Sync history tracking
- ✅ All 12 classes use `_fields=_all&_limit=100000` for complete data

---

**Status**: Production-ready core, demo-ready  
**Test Environment**: TAMICS10_AX1 tenant  
**Last Tested**: March 1, 2026

## Authors

**Van Anthony Silleza** - *Infor FSM Technical Consultant*  
FSM domain expertise, business requirements, production validation

**Kiro AI Assistant** - *Development & Documentation*  
Architecture, implementation, testing, documentation

*Collaborative development - January-March 2026*
