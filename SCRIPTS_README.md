# Server Management Scripts

Simple PowerShell scripts to manage the FSM Conversion Workbench servers in the background.

## Available Scripts

### Start Servers
```powershell
.\start.ps1
```
Starts both backend and frontend servers as background jobs.
- No separate windows
- Runs in background
- Backend: http://localhost:8000
- Frontend: http://localhost:5173

### Stop Servers
```powershell
.\stop.ps1
```
Stops all running backend and frontend servers by port number.

### Check Status
```powershell
.\status.ps1
```
Shows the current status of both servers including:
- Running status (checks ports 8000 and 5173)
- Process IDs
- CPU and memory usage
- Connectivity test

### View Logs
```powershell
.\logs.ps1
```
Shows recent output from background jobs.

### Restart Servers
```powershell
.\restart.ps1
```
Stops and then starts both servers.

## Quick Reference

| Command | Description |
|---------|-------------|
| `.\start.ps1` | Start both servers in background |
| `.\stop.ps1` | Stop both servers |
| `.\status.ps1` | Check server status |
| `.\logs.ps1` | View server logs |
| `.\restart.ps1` | Restart both servers |

## First Time Setup

Before using these scripts, ensure you've completed the initial setup:

```powershell
# Backend setup
cd backend
pip install -r requirements.txt
python init_db.py
cd ..

# Frontend setup
cd frontend
npm install --legacy-peer-deps
cd ..
```

## Troubleshooting

### Scripts won't run
If you get an execution policy error, run:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Servers won't stop
If `stop.ps1` doesn't work, manually kill processes:
```powershell
# Find and kill backend
Get-Process python | Where-Object {$_.CommandLine -like "*uvicorn*"} | Stop-Process -Force

# Find and kill frontend
Get-Process node | Where-Object {$_.CommandLine -like "*vite*"} | Stop-Process -Force
```

### Port already in use
If ports 8000 or 5173 are already in use:
```powershell
# Check what's using port 8000
netstat -ano | findstr :8000

# Check what's using port 5173
netstat -ano | findstr :5173

# Kill process by PID
Stop-Process -Id <PID> -Force
```

## Manual Start (Alternative)

If you prefer to start servers manually:

**Backend** (Terminal 1):
```powershell
cd backend
python -m uvicorn app.main:app --reload
```

**Frontend** (Terminal 2):
```powershell
cd frontend
npm run dev
```

## Notes

- Scripts open servers in separate PowerShell windows
- Backend runs with `--reload` for auto-restart on code changes
- Frontend runs in development mode with hot module replacement
- Use `Ctrl+C` in each window to stop servers manually
- Or use `.\stop.ps1` to stop all servers at once

---

**Tip**: Add these scripts to your PATH or create shortcuts for even faster access!
