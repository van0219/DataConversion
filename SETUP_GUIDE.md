# FSM Conversion Workbench - Setup Guide

## Quick Start

### Backend Setup

1. Install Python dependencies:
```bash
cd backend
pip install -r requirements.txt
```

2. Initialize the database:
```bash
python init_db.py
```

3. Start the FastAPI server:
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at: `http://localhost:8000`
API documentation: `http://localhost:8000/docs`

### Frontend Setup

1. Install Node.js dependencies:
```bash
cd frontend
npm install
```

2. Start the development server:
```bash
npm run dev
```

The UI will be available at: `http://localhost:5173`

## First Time Usage

### 1. Create an Account

- Open the frontend at `http://localhost:5173`
- Click "Create New Account"
- Fill in the form:
  - Account Name: e.g., `Demo_TRN`
  - Project Name: Your project name
  - Tenant ID: Your FSM tenant ID
  - FSM Base URL: Your FSM environment URL
  - FSM Client ID: OAuth2 client ID
  - FSM Client Secret: OAuth2 client secret
  - App Password: Password for this workbench (min 8 chars)

### 2. Login

- Select your account from the dropdown
- Enter your app password
- Click "Login"

### 3. Run a Conversion

1. Click "New Conversion" from the dashboard
2. Enter the business class (e.g., `GLTransactionInterface`)
3. Upload your CSV file
4. Review auto-generated field mappings
5. Adjust mappings as needed
6. Click "Start Validation"
7. Review validation results
8. Export errors (if any) or proceed to load
9. Click "Load to FSM" to send valid records

## Architecture Overview

### Backend (FastAPI + SQLite)

- **Core**: Database, security, logging, configuration
- **Models**: SQLAlchemy models for all tables
- **Services**: Business logic (FSM client, streaming, mapping, validation, rules)
- **Modules**: API routers (accounts, schema, snapshot, upload, mapping, validation, load)

### Frontend (React + TypeScript)

- **Pages**: Login, Dashboard, ConversionWorkflow, ValidationDashboard
- **Services**: API client with JWT authentication
- **Styling**: Black/Red/White premium theme

### Key Features

1. **Streaming Architecture**: Processes millions of records without loading entire file into memory
2. **Auto-Mapping**: Intelligent field mapping with confidence scoring (exact, high, medium, low)
3. **Schema Validation**: Dynamic validation against FSM OpenAPI schemas
4. **Rule Engine**: REFERENCE_EXISTS and REQUIRED_OVERRIDE rules (extensible for more)
5. **Incremental Error Persistence**: Errors saved as they're found
6. **Batch Loading**: Chunked loading to FSM with progress tracking
7. **Account Isolation**: Complete data isolation per account

## Database Schema

- `accounts`: Account credentials (encrypted)
- `schemas`: FSM business class schemas with versioning
- `snapshot_records`: Consolidated snapshot table for reference data
- `snapshot_registry`: Snapshot sync metadata
- `conversion_jobs`: Job tracking
- `validation_errors`: Validation error details
- `load_results`: Load operation results
- `mapping_templates`: Saved field mappings
- `validation_rule_templates`: Reusable validation rules
- `validation_rule_assignments`: Rule assignments per account

## Environment Variables

Create `.env` file in backend folder:

```env
DATABASE_URL=sqlite:///./fsm_workbench.db
SECRET_KEY=your-secret-key-here
ENCRYPTION_KEY=your-fernet-key-here
```

Generate encryption key:
```python
from cryptography.fernet import Fernet
print(Fernet.generate_key().decode())
```

## Demo Data

Sample GLTransactionInterface CSV in `Import_Files/GLTransactionInterface_20251128.csv`

## Troubleshooting

### Backend won't start
- Check Python version (3.9+)
- Verify all dependencies installed: `pip install -r requirements.txt`
- Check database initialized: `python init_db.py`

### Frontend won't start
- Check Node.js version (16+)
- Delete `node_modules` and reinstall: `rm -rf node_modules && npm install`
- Check port 5173 is available

### Authentication fails
- Verify FSM credentials are correct
- Check FSM environment is accessible
- Review logs in terminal

### Validation errors
- Check field mappings are correct
- Verify source data format matches FSM requirements
- Review error export CSV for details

## Production Deployment

For production use:

1. Use PostgreSQL instead of SQLite
2. Set strong SECRET_KEY and ENCRYPTION_KEY
3. Enable HTTPS
4. Configure proper CORS origins
5. Set up proper logging and monitoring
6. Use production WSGI server (gunicorn/uvicorn workers)
7. Build frontend for production: `npm run build`

## Support

For issues or questions, contact the development team.
