# FSM DataBridge — Installation Guide

## Prerequisites

You need three things installed on your machine:

| Software | Version | Download |
|----------|---------|----------|
| **Python** | 3.10 or higher | [python.org/downloads](https://www.python.org/downloads/) |
| **Node.js** | 18 or higher (LTS) | [nodejs.org](https://nodejs.org/) |
| **Git** | Any recent version | [git-scm.com/downloads](https://git-scm.com/downloads) |

### Python Installation Notes
- During install, **check "Add Python to PATH"** (important!)
- Verify: open Command Prompt and type `python --version`

### Node.js Installation Notes
- Download the **LTS** version
- Verify: open Command Prompt and type `node --version`

### Git Installation Notes
- Use default settings during install
- Verify: open Command Prompt and type `git --version`

---

## First-Time Setup

### Step 1: Clone the Repository

Open Command Prompt and run:

```
git clone https://github.com/YOUR_ORG/DataConversion.git
cd DataConversion
```

### Step 2: Run the Launcher

Double-click **`launcher.bat`** in the DataConversion folder.

The launcher will automatically:
1. Verify Python, Node.js, and Git are installed
2. Pull the latest updates from GitHub
3. Install all Python dependencies
4. Generate secure encryption keys (first time only)
5. Initialize the database (first time only)
6. Install all frontend dependencies (first time only)
7. Start the backend and frontend servers
8. Open your browser to the app

### Step 3: Create Your Account

1. The app opens at **http://localhost:5173**
2. Click **"Create Account"**
3. Enter your FSM credentials (Base URL, OAuth URL, Tenant ID, Client ID, etc.)
4. Log in with your account

---

## Daily Usage

Just double-click **`launcher.bat`**. It will:
- Check for updates (pulls latest from GitHub)
- Start the servers
- Open your browser

That's it!

---

## Updating

Updates are automatic. Every time you run `launcher.bat`, it pulls the latest version from GitHub. Your local data (accounts, database, uploaded files) is preserved — only the app code is updated.

---

## Troubleshooting

### "Python is not installed"
- Download from [python.org](https://www.python.org/downloads/)
- **Important**: Check "Add Python to PATH" during installation
- Restart Command Prompt after installing

### "Node.js is not installed"
- Download LTS from [nodejs.org](https://nodejs.org/)
- Restart Command Prompt after installing

### "Git is not installed"
- Download from [git-scm.com](https://git-scm.com/downloads)
- Restart Command Prompt after installing

### Backend won't start
- Check if port 8000 is already in use
- Try: `netstat -ano | findstr :8000` to find the process
- Kill it: `taskkill /PID <pid> /F`

### Frontend won't start
- Check if port 5173 is already in use
- Try deleting `frontend/node_modules` and run launcher again

### Database errors
- Delete `backend/fsm_workbench.db` and run launcher again (this resets all data)

### pip install fails
- Try running Command Prompt as Administrator
- Or try: `pip install -r backend/requirements.txt --user`

---

## Architecture

```
DataBridge runs two local servers:

  Backend (Python/FastAPI)     →  http://localhost:8000
  Frontend (React/TypeScript)  →  http://localhost:5173

  Your browser connects to the frontend.
  The frontend talks to the backend API.
  The backend talks to your FSM environment.

  All data stays on your machine — nothing is sent to external servers
  except your FSM environment.
```

---

## Support

Contact: Van Anthony Silleza (FSM Technical Consultant)
