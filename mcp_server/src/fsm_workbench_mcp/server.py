"""FSM Conversion Workbench MCP Server

Provides AI-powered automation for FSM data conversion workflows.
"""

import asyncio
import json
import logging
from pathlib import Path
from typing import Any, Optional
from mcp.server import Server
from mcp.types import Tool, TextContent
import httpx

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("fsm-workbench-mcp")


class FSMWorkbenchClient:
    """HTTP client for FSM Conversion Workbench API"""
    
    def __init__(self, base_url: str = "http://localhost:8000", token: Optional[str] = None):
        self.base_url = base_url.rstrip('/')
        self.token = token
        self.client = httpx.AsyncClient(timeout=300.0)  # 5 minute timeout
        
    def _get_headers(self) -> dict:
        """Get request headers with auth token"""
        headers = {"Content-Type": "application/json"}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        return headers
    
    async def close(self):
        """Close HTTP client"""
        await self.client.aclose()


# Initialize server
app = Server("fsm-workbench-mcp")
client: Optional[FSMWorkbenchClient] = None


@app.list_tools()
async def list_tools() -> list[Tool]:
    """List available MCP tools"""
    return [
        Tool(
            name="login",
            description="Login to FSM Workbench with account name and password (same as UI login)",
            inputSchema={
                "type": "object",
                "properties": {
                    "account_name": {"type": "string", "description": "Account name (e.g., 'Tamics10 AX1')"},
                    "password": {"type": "string", "description": "Account password"}
                },
                "required": ["account_name", "password"]
            }
        ),
        Tool(
            name="upload_file",
            description="Upload CSV file for conversion. Returns job_id, headers, and sample records.",
            inputSchema={
                "type": "object",
                "properties": {
                    "filepath": {"type": "string", "description": "Path to CSV file (relative or absolute)"},
                    "business_class": {"type": "string", "description": "FSM business class (e.g., GLTransactionInterface)"}
                },
                "required": ["filepath"]
            }
        ),
        Tool(
            name="get_schema",
            description="Fetch FSM schema for business class. Returns field definitions, types, and validation rules.",
            inputSchema={
                "type": "object",
                "properties": {
                    "business_class": {"type": "string", "description": "FSM business class name"}
                },
                "required": ["business_class"]
            }
        ),
        Tool(
            name="auto_map_fields",
            description="Auto-map CSV columns to FSM fields using intelligent matching. Returns mapping with confidence scores.",
            inputSchema={
                "type": "object",
                "properties": {
                    "job_id": {"type": "integer", "description": "Conversion job ID from upload"},
                    "business_class": {"type": "string", "description": "FSM business class name"}
                },
                "required": ["job_id", "business_class"]
            }
        ),
        Tool(
            name="validate_data",
            description="Run validation on uploaded file with schema and rule checks. Returns validation progress and results.",
            inputSchema={
                "type": "object",
                "properties": {
                    "job_id": {"type": "integer", "description": "Conversion job ID"},
                    "business_class": {"type": "string", "description": "FSM business class name"},
                    "mapping": {"type": "object", "description": "Field mapping (CSV column -> FSM field)"},
                    "enable_rules": {"type": "boolean", "description": "Enable validation rules", "default": True}
                },
                "required": ["job_id", "business_class", "mapping"]
            }
        ),
        Tool(
            name="get_validation_results",
            description="Get validation summary with error counts and top errors.",
            inputSchema={
                "type": "object",
                "properties": {
                    "job_id": {"type": "integer", "description": "Conversion job ID"}
                },
                "required": ["job_id"]
            }
        ),
        Tool(
            name="export_errors",
            description="Export validation errors as CSV file with original data plus Error Message column.",
            inputSchema={
                "type": "object",
                "properties": {
                    "job_id": {"type": "integer", "description": "Conversion job ID"},
                    "output_path": {"type": "string", "description": "Path to save error CSV file"}
                },
                "required": ["job_id", "output_path"]
            }
        ),
        Tool(
            name="load_to_fsm",
            description="Load valid records to FSM system. Skips invalid records automatically.",
            inputSchema={
                "type": "object",
                "properties": {
                    "job_id": {"type": "integer", "description": "Conversion job ID"},
                    "trigger_interface": {"type": "boolean", "description": "Trigger FSM interface after load", "default": True}
                },
                "required": ["job_id"]
            }
        ),
        Tool(
            name="sync_reference_data",
            description="Sync reference data for a specific FSM business class (e.g., Currency, Account, Vendor).",
            inputSchema={
                "type": "object",
                "properties": {
                    "business_class": {"type": "string", "description": "Setup business class name"}
                },
                "required": ["business_class"]
            }
        ),
        Tool(
            name="sync_all_reference_data",
            description="Sync all 12 FSM setup classes (Currency, Account, Vendor, etc.). Takes 2-3 minutes.",
            inputSchema={
                "type": "object",
                "properties": {}
            }
        ),
        Tool(
            name="run_full_conversion",
            description="Run complete conversion workflow: upload -> map -> validate -> report. One-step automation.",
            inputSchema={
                "type": "object",
                "properties": {
                    "filepath": {"type": "string", "description": "Path to CSV file"},
                    "business_class": {"type": "string", "description": "FSM business class name"},
                    "load_to_fsm": {"type": "boolean", "description": "Load valid records to FSM", "default": False}
                },
                "required": ["filepath", "business_class"]
            }
        ),
        Tool(
            name="list_jobs",
            description="List recent conversion jobs with status and metadata.",
            inputSchema={
                "type": "object",
                "properties": {
                    "limit": {"type": "integer", "description": "Number of jobs to return (default: 20)", "default": 20}
                }
            }
        )
    ]


@app.call_tool()
async def call_tool(name: str, arguments: Any) -> list[TextContent]:
    """Handle tool calls"""
    global client
    
    try:
        if name == "login":
            return await handle_login(arguments)
        
        # All other tools require authentication
        if not client or not client.token:
            return [TextContent(
                type="text",
                text="Error: Not authenticated. Please call 'login' or 'login_with_account_name' tool first."
            )]
        
        if name == "upload_file":
            return await handle_upload_file(arguments)
        elif name == "get_schema":
            return await handle_get_schema(arguments)
        elif name == "auto_map_fields":
            return await handle_auto_map(arguments)
        elif name == "validate_data":
            return await handle_validate(arguments)
        elif name == "get_validation_results":
            return await handle_get_results(arguments)
        elif name == "export_errors":
            return await handle_export_errors(arguments)
        elif name == "load_to_fsm":
            return await handle_load_to_fsm(arguments)
        elif name == "sync_reference_data":
            return await handle_sync_reference(arguments)
        elif name == "sync_all_reference_data":
            return await handle_sync_all(arguments)
        elif name == "run_full_conversion":
            return await handle_full_conversion(arguments)
        elif name == "list_jobs":
            return await handle_list_jobs(arguments)
        else:
            return [TextContent(type="text", text=f"Unknown tool: {name}")]
    
    except Exception as e:
        logger.error(f"Tool {name} failed: {e}", exc_info=True)
        return [TextContent(type="text", text=f"Error: {str(e)}")]


async def handle_login(args: dict) -> list[TextContent]:
    """Handle login tool"""
    global client
    
    account_name = args.get("account_name")
    password = args.get("password")
    
    if not account_name or not password:
        return [TextContent(type="text", text="Error: account_name and password are required")]
    
    # Create client
    temp_client = FSMWorkbenchClient()
    
    try:
        # Use standard login endpoint (same as UI)
        response = await temp_client.client.post(
            f"{temp_client.base_url}/api/accounts/login",
            json={"account_name": account_name, "password": password}
        )
        response.raise_for_status()
        
        data = response.json()
        token = data.get("access_token")
        account_info = data.get("account", {})
        
        if not token:
            return [TextContent(type="text", text="Error: No token received from login")]
        
        # Set global client with token
        client = FSMWorkbenchClient(token=token)
        
        return [TextContent(
            type="text",
            text=f"✓ Logged in successfully as {account_info.get('account_name', account_name)}\n"
                 f"  Project: {account_info.get('project_name', 'N/A')}\n"
                 f"  Tenant: {account_info.get('tenant_id', 'N/A')}"
        )]
    
    except httpx.HTTPStatusError as e:
        return [TextContent(type="text", text=f"Login failed: {e.response.text}")]
    except Exception as e:
        return [TextContent(type="text", text=f"Login error: {str(e)}")]


async def handle_login_with_name(args: dict) -> list[TextContent]:
    """Handle login with account name tool"""
    global client
    
    account_name = args["account_name"]
    
    # Create temporary client to query database
    temp_client = FSMWorkbenchClient()
    
    try:
        # Query database for account by username
        response = await temp_client.client.get(
            f"{temp_client.base_url}/api/accounts/list"
        )
        response.raise_for_status()
        
        accounts = response.json()
        
        # Find account by username (case-insensitive)
        matching_account = None
        for account in accounts:
            if account.get("account_name", "").upper() == account_name.upper():
                matching_account = account
                break
        
        if not matching_account:
            return [TextContent(
                type="text",
                text=f"✗ Account '{account_name}' not found in database.\n\n"
                     f"Please sign up first by:\n"
                     f"1. Opening the web app at http://localhost:5173\n"
                     f"2. Creating a new account with your FSM credentials\n"
                     f"3. Then try logging in again with: 'login using {account_name}'"
            )]
        
        # Get account ID
        account_id = matching_account.get("id")
        
        # Use MCP login endpoint to get token directly
        login_response = await temp_client.client.post(
            f"{temp_client.base_url}/api/accounts/mcp-login/{account_id}"
        )
        login_response.raise_for_status()
        
        data = login_response.json()
        token = data.get("access_token")
        account_info = data.get("account", {})
        
        if not token:
            return [TextContent(type="text", text="Error: No token received from login")]
        
        # Set global client with token
        client = FSMWorkbenchClient(token=token)
        
        return [TextContent(
            type="text",
            text=f"✓ Logged in successfully as {account_info.get('account_name', account_name)}\n"
                 f"  Account ID: {account_id}\n"
                 f"  Project: {account_info.get('project_name', 'N/A')}\n"
                 f"  Tenant: {account_info.get('tenant_id', 'N/A')}"
        )]
    
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            return [TextContent(
                type="text",
                text=f"✗ Account '{account_name}' not found in database.\n\n"
                     f"Please sign up first by opening http://localhost:5173"
            )]
        return [TextContent(type="text", text=f"Login failed: {e.response.text}")]
    except Exception as e:
        return [TextContent(type="text", text=f"Error: {str(e)}")]


async def handle_upload_file(args: dict) -> list[TextContent]:
    """Handle file upload tool"""
    filepath = Path(args["filepath"])
    business_class = args.get("business_class")
    
    if not filepath.exists():
        return [TextContent(type="text", text=f"Error: File not found: {filepath}")]
    
    try:
        # Read file
        with open(filepath, 'rb') as f:
            files = {"file": (filepath.name, f, "text/csv")}
            data = {}
            if business_class:
                data["business_class"] = business_class
            
            response = await client.client.post(
                f"{client.base_url}/api/upload",
                files=files,
                data=data,
                headers={"Authorization": f"Bearer {client.token}"}
            )
            response.raise_for_status()
        
        result = response.json()
        
        output = f"""✓ File uploaded successfully

Job ID: {result['job_id']}
Filename: {result['filename']}
Business Class: {result['business_class']}
Estimated Records: {result['estimated_records']}
Headers ({len(result['headers'])}): {', '.join(result['headers'][:10])}{'...' if len(result['headers']) > 10 else ''}

Sample Records:
{json.dumps(result['sample_records'][:3], indent=2)}
"""
        
        return [TextContent(type="text", text=output)]
    
    except Exception as e:
        return [TextContent(type="text", text=f"Upload failed: {str(e)}")]


async def handle_get_schema(args: dict) -> list[TextContent]:
    """Handle get schema tool"""
    business_class = args["business_class"]
    
    try:
        response = await client.client.post(
            f"{client.base_url}/api/schema/fetch",
            json={"business_class": business_class},
            headers=client._get_headers()
        )
        response.raise_for_status()
        
        result = response.json()
        schema = result.get("schema", {})
        
        output = f"""✓ Schema fetched successfully

Business Class: {business_class}
Total Fields: {len(schema.get('properties', {}))}
Required Fields: {len(schema.get('required', []))}

Required Fields:
{', '.join(schema.get('required', [])[:10])}

Sample Fields:
"""
        
        # Show first 5 fields with details
        for field_name, field_def in list(schema.get('properties', {}).items())[:5]:
            field_type = field_def.get('type', 'unknown')
            output += f"\n- {field_name}: {field_type}"
            if 'enum' in field_def:
                output += f" (enum: {len(field_def['enum'])} values)"
        
        return [TextContent(type="text", text=output)]
    
    except Exception as e:
        return [TextContent(type="text", text=f"Schema fetch failed: {str(e)}")]


async def handle_auto_map(args: dict) -> list[TextContent]:
    """Handle auto-map tool"""
    job_id = args["job_id"]
    business_class = args["business_class"]
    
    try:
        response = await client.client.post(
            f"{client.base_url}/api/mapping/auto-map",
            json={"job_id": job_id, "business_class": business_class},
            headers=client._get_headers()
        )
        response.raise_for_status()
        
        result = response.json()
        mapping = result.get("mapping", {})
        
        # Count by confidence
        exact = sum(1 for m in mapping.values() if m.get('confidence') == 'exact')
        high = sum(1 for m in mapping.values() if m.get('confidence') == 'high')
        medium = sum(1 for m in mapping.values() if m.get('confidence') == 'medium')
        low = sum(1 for m in mapping.values() if m.get('confidence') == 'low')
        unmapped = sum(1 for m in mapping.values() if m.get('confidence') == 'unmapped')
        
        output = f"""✓ Auto-mapping complete

Total Fields: {len(mapping)}
- Exact matches: {exact}
- High confidence: {high}
- Medium confidence: {medium}
- Low confidence: {low}
- Unmapped: {unmapped}

Sample Mappings:
"""
        
        for csv_col, fsm_mapping in list(mapping.items())[:10]:
            fsm_field = fsm_mapping.get('fsm_field', 'unmapped')
            confidence = fsm_mapping.get('confidence', 'unknown')
            output += f"\n{csv_col} -> {fsm_field} ({confidence})"
        
        return [TextContent(type="text", text=output)]
    
    except Exception as e:
        return [TextContent(type="text", text=f"Auto-mapping failed: {str(e)}")]


async def handle_validate(args: dict) -> list[TextContent]:
    """Handle validate tool"""
    job_id = args["job_id"]
    business_class = args["business_class"]
    mapping = args["mapping"]
    enable_rules = args.get("enable_rules", True)
    
    try:
        # Start validation
        response = await client.client.post(
            f"{client.base_url}/api/validation/start",
            json={
                "job_id": job_id,
                "business_class": business_class,
                "mapping": mapping,
                "enable_rules": enable_rules
            },
            headers=client._get_headers()
        )
        response.raise_for_status()
        
        # Poll for progress
        output = "✓ Validation started\n\nProgress:\n"
        
        while True:
            await asyncio.sleep(2)
            
            progress_response = await client.client.get(
                f"{client.base_url}/api/validation/{job_id}/progress",
                headers=client._get_headers()
            )
            progress_response.raise_for_status()
            
            progress = progress_response.json()
            status = progress.get("status")
            processed = progress.get("processed_records", 0)
            total = progress.get("total_records", 0)
            
            if status == "validated":
                output += f"\n✓ Validation complete: {processed}/{total} records processed"
                break
            elif status == "failed":
                output += f"\n✗ Validation failed"
                break
            else:
                output += f"\n  Processing: {processed}/{total} records..."
        
        # Get summary
        summary_response = await client.client.get(
            f"{client.base_url}/api/validation/{job_id}/summary",
            headers=client._get_headers()
        )
        summary_response.raise_for_status()
        
        summary = summary_response.json()
        
        output += f"""

Results:
- Valid records: {summary.get('valid_records', 0)}
- Invalid records: {summary.get('invalid_records', 0)}
- Total errors: {summary.get('error_count', 0)}

Top Errors:
"""
        
        for error in summary.get('top_errors', [])[:5]:
            output += f"\n- {error['field_name']}: {error['error_type']} ({error['count']} occurrences)"
        
        return [TextContent(type="text", text=output)]
    
    except Exception as e:
        return [TextContent(type="text", text=f"Validation failed: {str(e)}")]


async def handle_get_results(args: dict) -> list[TextContent]:
    """Handle get validation results tool"""
    job_id = args["job_id"]
    
    try:
        response = await client.client.get(
            f"{client.base_url}/api/validation/{job_id}/summary",
            headers=client._get_headers()
        )
        response.raise_for_status()
        
        summary = response.json()
        
        output = f"""Validation Results for Job {job_id}

Status: {summary.get('status', 'unknown')}
Total Records: {summary.get('total_records', 0)}
Valid Records: {summary.get('valid_records', 0)}
Invalid Records: {summary.get('invalid_records', 0)}
Total Errors: {summary.get('error_count', 0)}

Top Errors:
"""
        
        for error in summary.get('top_errors', []):
            output += f"\n- {error['field_name']}: {error['error_type']} ({error['count']} occurrences)"
        
        return [TextContent(type="text", text=output)]
    
    except Exception as e:
        return [TextContent(type="text", text=f"Failed to get results: {str(e)}")]


async def handle_export_errors(args: dict) -> list[TextContent]:
    """Handle export errors tool"""
    job_id = args["job_id"]
    output_path = Path(args["output_path"])
    
    try:
        response = await client.client.get(
            f"{client.base_url}/api/validation/{job_id}/errors/export",
            headers=client._get_headers()
        )
        response.raise_for_status()
        
        # Save CSV content
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(response.text)
        
        return [TextContent(
            type="text",
            text=f"✓ Errors exported successfully to: {output_path}"
        )]
    
    except Exception as e:
        return [TextContent(type="text", text=f"Export failed: {str(e)}")]


async def handle_load_to_fsm(args: dict) -> list[TextContent]:
    """Handle load to FSM tool"""
    job_id = args["job_id"]
    trigger_interface = args.get("trigger_interface", True)
    
    try:
        response = await client.client.post(
            f"{client.base_url}/api/load/start",
            json={"job_id": job_id, "trigger_interface": trigger_interface},
            headers=client._get_headers()
        )
        response.raise_for_status()
        
        result = response.json()
        
        output = f"""✓ Load to FSM complete

Total Records Loaded: {result.get('total_loaded', 0)}
Successful: {result.get('successful', 0)}
Failed: {result.get('failed', 0)}
"""
        
        return [TextContent(type="text", text=output)]
    
    except Exception as e:
        return [TextContent(type="text", text=f"Load failed: {str(e)}")]


async def handle_sync_reference(args: dict) -> list[TextContent]:
    """Handle sync reference data tool"""
    business_class = args["business_class"]
    
    try:
        response = await client.client.post(
            f"{client.base_url}/api/snapshot/sync",
            json={"business_class": business_class},
            headers=client._get_headers()
        )
        response.raise_for_status()
        
        result = response.json()
        
        output = f"""✓ Reference data synced

Business Class: {business_class}
Records Synced: {result.get('records_synced', 0)}
"""
        
        return [TextContent(type="text", text=output)]
    
    except Exception as e:
        return [TextContent(type="text", text=f"Sync failed: {str(e)}")]


async def handle_sync_all(args: dict) -> list[TextContent]:
    """Handle sync all reference data tool"""
    try:
        response = await client.client.post(
            f"{client.base_url}/api/snapshot/sync-all",
            headers=client._get_headers()
        )
        response.raise_for_status()
        
        result = response.json()
        
        output = "✓ All reference data synced\n\n"
        
        for class_result in result.get('results', []):
            output += f"- {class_result['business_class']}: {class_result['records_synced']} records\n"
        
        return [TextContent(type="text", text=output)]
    
    except Exception as e:
        return [TextContent(type="text", text=f"Sync all failed: {str(e)}")]


async def handle_full_conversion(args: dict) -> list[TextContent]:
    """Handle full conversion workflow using backend orchestrator"""
    filepath = args["filepath"]
    business_class = args["business_class"]
    load_to_fsm = args.get("load_to_fsm", False)
    
    try:
        # Call workflow orchestrator endpoint
        response = await client.client.post(
            f"{client.base_url}/api/workflows/full-conversion",
            json={
                "file_path": filepath,
                "business_class": business_class,
                "load_to_fsm": load_to_fsm,
                "enable_rules": True
            },
            headers=client._get_headers()
        )
        response.raise_for_status()
        
        result = response.json()
        
        output = f"""✓ Full conversion workflow started

Job ID: {result['job_id']}
Business Class: {result['business_class']}
Filename: {result['filename']}
Status: {result['status']}

Steps Completed:
"""
        
        for step in result.get('steps_completed', []):
            output += f"  ✓ {step.capitalize()}\n"
        
        output += f"\nUse 'get_validation_progress' with job_id {result['job_id']} to track progress."
        
        return [TextContent(type="text", text=output)]
    
    except Exception as e:
        return [TextContent(type="text", text=f"Full conversion failed: {str(e)}")]


async def handle_list_jobs(args: dict) -> list[TextContent]:
    """Handle list jobs tool"""
    limit = args.get("limit", 20)
    
    try:
        response = await client.client.get(
            f"{client.base_url}/api/upload/jobs/recent?limit={limit}",
            headers=client._get_headers()
        )
        response.raise_for_status()
        
        data = response.json()
        jobs = data.get("jobs", [])
        
        if not jobs:
            return [TextContent(type="text", text="No conversion jobs found")]
        
        output = f"Recent Conversion Jobs ({len(jobs)}):\n\n"
        
        for job in jobs:
            status_emoji = {
                "pending": "⏳",
                "validating": "🔄",
                "validated": "✅",
                "loading": "📤",
                "completed": "🎉",
                "failed": "❌"
            }.get(job.get("status", ""), "❓")
            
            output += f"{status_emoji} Job #{job.get('id')} - {job.get('filename')}\n"
            output += f"   Business Class: {job.get('business_class')}\n"
            output += f"   Status: {job.get('status')}\n"
            output += f"   Records: {job.get('total_records', 0)} total, "
            output += f"{job.get('valid_records', 0)} valid, {job.get('invalid_records', 0)} invalid\n"
            output += f"   Created: {job.get('created_at', 'N/A')}\n\n"
        
        return [TextContent(type="text", text=output)]
    
    except Exception as e:
        return [TextContent(type="text", text=f"Failed to list jobs: {str(e)}")]


async def main():
    """Main entry point"""
    from mcp.server.stdio import stdio_server
    
    async with stdio_server() as (read_stream, write_stream):
        await app.run(
            read_stream,
            write_stream,
            app.create_initialization_options()
        )


if __name__ == "__main__":
    asyncio.run(main())
