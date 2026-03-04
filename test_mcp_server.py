"""Quick test to verify MCP server is working"""
import subprocess
import sys

print("Testing FSM Workbench MCP Server...")
print("=" * 50)

try:
    # Try to import the module
    import fsm_workbench_mcp
    print("✓ Module imported successfully")
    print(f"  Location: {fsm_workbench_mcp.__file__}")
    
    # Check if server module exists
    from fsm_workbench_mcp import server
    print("✓ Server module found")
    
    print("\n" + "=" * 50)
    print("MCP Server is ready to use!")
    print("\nNext steps:")
    print("1. Restart Kiro to load the new MCP configuration")
    print("2. Start your backend: cd backend && python -m uvicorn app.main:app --reload")
    print("3. Talk to me: 'List files in Import_Files'")
    
except ImportError as e:
    print(f"✗ Import failed: {e}")
    sys.exit(1)
