# FSM Workbench MCP Server - Quick Start

Get up and running with AI-powered FSM data conversion in 5 minutes.

## Step 1: Install the MCP Server

```bash
cd mcp_server
uv pip install -e .
```

## Step 2: Configure Kiro

Add to your MCP settings (`.kiro/settings/mcp.json`):

```json
{
  "mcpServers": {
    "fsm-workbench": {
      "command": "python",
      "args": ["-m", "fsm_workbench_mcp.server"],
      "cwd": "/absolute/path/to/mcp_server/src",
      "env": {
        "PYTHONPATH": "/absolute/path/to/mcp_server/src"
      }
    }
  }
}
```

**Important**: Replace `/absolute/path/to` with your actual workspace path.

## Step 3: Start the Backend

```bash
cd backend
python -m uvicorn app.main:app --reload
```

Backend should be running at http://localhost:8000

## Step 4: Restart Kiro

Restart Kiro to load the new MCP server.

## Step 5: Test It!

In Kiro chat, try these commands:

### Login
```
"Login to FSM Workbench with account 1 and password 'test123'"
```

### List Files
```
"What CSV files are in Import_Files?"
```

### Convert a File
```
"Convert GLTransactionInterface_20251128.csv"
```

### Full Workflow
```
"Process the demo file: upload, validate, and show me the results"
```

## Common Commands

### Reference Data
```
"Sync all reference data"
"Sync Currency reference data"
```

### Conversion Workflow
```
"Upload [filename]"
"Validate job [job_id]"
"Export errors for job [job_id] to errors.csv"
"Load job [job_id] to FSM"
```

### One-Step Conversion
```
"Run full conversion on [filename] and load to FSM"
```

## Troubleshooting

### MCP Server Not Found

Check that:
1. Path in mcp.json is absolute (not relative)
2. PYTHONPATH includes the src directory
3. You restarted Kiro after adding configuration

### Backend Not Running

```bash
cd backend
python -m uvicorn app.main:app --reload
```

Should see: `Application startup complete.`

### Authentication Failed

Make sure:
1. You called login first
2. Account ID and password are correct
3. Backend is running

## What's Next?

- Read full documentation: `README.md`
- Try example workflows
- Create custom automation scripts
- Integrate with your CI/CD pipeline

---

**Need Help?** Check the main README.md for detailed documentation.
