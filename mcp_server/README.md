# FSM Conversion Workbench MCP Server

AI-powered automation for FSM data conversion workflows. This MCP server allows AI assistants to interact with the FSM Conversion Workbench programmatically, enabling natural language control of the entire conversion process.

## Features

- **Natural Language Control**: Just describe what you want, AI handles the API calls
- **Complete Workflow Automation**: Upload → Map → Validate → Load in one command
- **Reference Data Management**: Sync FSM setup classes automatically
- **Error Handling**: Intelligent error detection and reporting
- **Progress Monitoring**: Real-time status updates during validation
- **Batch Processing**: Process multiple files easily

## Installation

### Prerequisites

- Python 3.10 or higher
- FSM Conversion Workbench backend running on http://localhost:8000
- uv package manager (recommended) or pip

### Install with uv (Recommended)

```bash
cd mcp_server
uv pip install -e .
```

### Install with pip

```bash
cd mcp_server
pip install -e .
```

## Configuration

Add to your MCP settings file (`~/.kiro/settings/mcp.json` or workspace `.kiro/settings/mcp.json`):

```json
{
  "mcpServers": {
    "fsm-workbench": {
      "command": "python",
      "args": ["-m", "fsm_workbench_mcp.server"],
      "cwd": "/path/to/mcp_server/src",
      "env": {
        "PYTHONPATH": "/path/to/mcp_server/src"
      }
    }
  }
}
```

Or with uvx:

```json
{
  "mcpServers": {
    "fsm-workbench": {
      "command": "uvx",
      "args": ["--from", "/path/to/mcp_server", "fsm-workbench-mcp"]
    }
  }
}
```

## Available Tools

### Authentication

#### `login`
Login to FSM Workbench and get authentication token.

**Parameters**:
- `account_id` (integer): Account ID to login with
- `password` (string): Account password

**Example**:
```
"Login with account 1 and password 'test123'"
```

### File Operations

#### `list_files`
List CSV files in Import_Files directory or specified path.

**Parameters**:
- `directory` (string, optional): Directory path (default: "Import_Files")

**Example**:
```
"List files in Import_Files"
```

#### `upload_file`
Upload CSV file for conversion.

**Parameters**:
- `filepath` (string): Path to CSV file
- `business_class` (string, optional): FSM business class

**Example**:
```
"Upload GLTransactionInterface_20251128.csv"
```

### Schema Operations

#### `get_schema`
Fetch FSM schema for business class.

**Parameters**:
- `business_class` (string): FSM business class name

**Example**:
```
"Get schema for GLTransactionInterface"
```

### Mapping Operations

#### `auto_map_fields`
Auto-map CSV columns to FSM fields using intelligent matching.

**Parameters**:
- `job_id` (integer): Conversion job ID from upload
- `business_class` (string): FSM business class name

**Example**:
```
"Auto-map fields for job 123"
```

### Validation Operations

#### `validate_data`
Run validation on uploaded file with schema and rule checks.

**Parameters**:
- `job_id` (integer): Conversion job ID
- `business_class` (string): FSM business class name
- `mapping` (object): Field mapping (CSV column -> FSM field)
- `enable_rules` (boolean, optional): Enable validation rules (default: true)

**Example**:
```
"Validate job 123 with the auto-mapped fields"
```

#### `get_validation_results`
Get validation summary with error counts and top errors.

**Parameters**:
- `job_id` (integer): Conversion job ID

**Example**:
```
"Get validation results for job 123"
```

#### `export_errors`
Export validation errors as CSV file with original data plus Error Message column.

**Parameters**:
- `job_id` (integer): Conversion job ID
- `output_path` (string): Path to save error CSV file

**Example**:
```
"Export errors for job 123 to errors.csv"
```

### Loading Operations

#### `load_to_fsm`
Load valid records to FSM system. Skips invalid records automatically.

**Parameters**:
- `job_id` (integer): Conversion job ID
- `trigger_interface` (boolean, optional): Trigger FSM interface after load (default: true)

**Example**:
```
"Load job 123 to FSM"
```

### Reference Data Operations

#### `sync_reference_data`
Sync reference data for a specific FSM business class.

**Parameters**:
- `business_class` (string): Setup business class name (e.g., Currency, Account, Vendor)

**Example**:
```
"Sync Currency reference data"
```

#### `sync_all_reference_data`
Sync all 12 FSM setup classes. Takes 2-3 minutes.

**Example**:
```
"Sync all reference data"
```

### Workflow Automation

#### `run_full_conversion`
Run complete conversion workflow: upload -> map -> validate -> report.

**Parameters**:
- `filepath` (string): Path to CSV file
- `business_class` (string): FSM business class name
- `load_to_fsm` (boolean, optional): Load valid records to FSM (default: false)

**Example**:
```
"Convert GLTransactionInterface_20251128.csv and load to FSM"
```

## Usage Examples

### Example 1: Simple Conversion

```
User: "Convert the GL file in Import_Files"

AI: [Calls list_files, upload_file, auto_map, validate]
"Uploaded GLTransactionInterface_20251128.csv
- 1,000 records found
- Auto-mapped 15/18 fields (3 unmapped)
- Validation: 950 valid, 50 invalid
- Top error: Currency 'USD' not found (25 records)

Would you like me to export the errors?"
```

### Example 2: Full Workflow with Loading

```
User: "Process the demo file and load to FSM"

AI: [Calls run_full_conversion with load_to_fsm=true]
"Starting conversion...
✓ Uploaded GLTransactionInterface_DEMO.csv
✓ Fetched schema (91 fields)
✓ Auto-mapped fields (confidence: 95%)
✓ Validated 20 records
  - 18 valid
  - 2 invalid (date format errors)
✓ Loaded 18 records to FSM
  - Batch 1: 18 created successfully

Conversion complete!"
```

### Example 3: Reference Data Sync

```
User: "Sync all reference data"

AI: [Calls sync_all_reference_data]
"Syncing 12 FSM setup classes...
✓ Currency: 156 records
✓ Account: 1,234 records
✓ Vendor: 567 records
...
Total: 5,720 records synced"
```

### Example 4: Error Investigation

```
User: "What errors are in job 123?"

AI: [Calls get_validation_results]
"Validation Results for Job 123

Status: validated
Total Records: 1,000
Valid Records: 950
Invalid Records: 50
Total Errors: 75

Top Errors:
- Currency: REFERENCE_EXISTS (25 occurrences)
- Account: REFERENCE_EXISTS (20 occurrences)
- PostingDate: PATTERN (15 occurrences)
- Amount: TYPE (10 occurrences)
- Description: REQUIRED (5 occurrences)"
```

## Architecture

The MCP server acts as a bridge between AI assistants and the FSM Conversion Workbench API:

```
AI Assistant (Kiro)
    ↓
MCP Server (this)
    ↓
FSM Workbench API (FastAPI)
    ↓
FSM System (Infor)
```

### Components

- **FSMWorkbenchClient**: HTTP client for API communication
- **Tool Handlers**: Individual functions for each MCP tool
- **Progress Monitoring**: Polling mechanism for long-running operations
- **Error Handling**: Comprehensive error detection and reporting

## Development

### Project Structure

```
mcp_server/
├── src/
│   └── fsm_workbench_mcp/
│       ├── __init__.py
│       └── server.py          # Main MCP server implementation
├── pyproject.toml             # Project configuration
└── README.md                  # This file
```

### Running Tests

```bash
# Install dev dependencies
uv pip install -e ".[dev]"

# Run tests
pytest
```

### Debugging

Enable debug logging:

```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

## Troubleshooting

### "Not authenticated" Error

Make sure to call the `login` tool first before using any other tools:

```
"Login with account 1 and password 'test123'"
```

### Connection Refused

Ensure the FSM Conversion Workbench backend is running:

```bash
cd backend
python -m uvicorn app.main:app --reload
```

### File Not Found

Use absolute paths or paths relative to the workspace root:

```
"Upload Import_Files/GLTransactionInterface_20251128.csv"
```

## Security

- **Authentication**: JWT tokens with 8-hour expiration
- **Credentials**: Never logged or exposed
- **API Access**: All requests require valid authentication
- **Local Only**: Server connects to localhost:8000 by default

## Performance

- **Streaming**: Large files processed in chunks (1000 records)
- **Async**: All API calls are asynchronous
- **Timeout**: 5-minute timeout for long operations
- **Progress**: Real-time progress updates during validation

## Limitations

- Requires FSM Conversion Workbench backend running locally
- Single account session at a time
- No concurrent job processing
- File size limited by backend configuration

## Future Enhancements

- Multi-account support
- Concurrent job processing
- Scheduled conversions
- Webhook notifications
- Advanced error analysis
- Batch file processing
- Custom validation rules via MCP

## Support

For issues or questions:
- Check backend logs: `backend/app/core/logging.py`
- Check MCP server logs: Enable debug logging
- Review API documentation: http://localhost:8000/docs

## License

Proprietary - FSM Conversion Workbench

## Authors

- Van Anthony Silleza - FSM Consultant
- Kiro AI Assistant - Implementation

---

**Version**: 1.0.0  
**Last Updated**: March 4, 2026  
**Status**: Production Ready
