@echo off
title FSM DataBridge Launcher
color 0B
echo.
echo  ╔══════════════════════════════════════════════════════════╗
echo  ║                                                          ║
echo  ║          FSM DataBridge - Data Conversion Platform        ║
echo  ║                                                          ║
echo  ╚══════════════════════════════════════════════════════════╝
echo.

:: ─── Check for Git ───────────────────────────────────────────────
where git >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo  [!] Git is not installed.
    echo      Download from: https://git-scm.com/downloads
    echo.
    pause
    exit /b 1
)
echo  [OK] Git found

:: ─── Check for Python ────────────────────────────────────────────
where python >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo  [!] Python is not installed.
    echo      Download from: https://www.python.org/downloads/
    echo      Make sure to check "Add Python to PATH" during install.
    echo.
    pause
    exit /b 1
)
for /f "tokens=2" %%i in ('python --version 2^>^&1') do set PYVER=%%i
echo  [OK] Python %PYVER% found

:: ─── Check for Node.js ──────────────────────────────────────────
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo  [!] Node.js is not installed.
    echo      Download from: https://nodejs.org/ (LTS version)
    echo.
    pause
    exit /b 1
)
for /f "tokens=1" %%i in ('node --version 2^>^&1') do set NODEVER=%%i
echo  [OK] Node.js %NODEVER% found
echo.

:: ─── Pull latest updates ────────────────────────────────────────
echo  [..] Checking for updates...
git pull origin main 2>nul
if %ERRORLEVEL% equ 0 (
    echo  [OK] Repository up to date
) else (
    echo  [--] Could not check for updates (offline or no remote)
)
echo.

:: ─── Backend setup ──────────────────────────────────────────────
echo  [..] Setting up backend...

:: Check if .env exists, create from example if not
if not exist "backend\.env" (
    echo  [..] Creating backend .env file...
    python -c "from cryptography.fernet import Fernet; import secrets; key=Fernet.generate_key().decode(); jwt=secrets.token_hex(32); print(f'DATABASE_URL=sqlite:///./fsm_workbench.db\nJWT_SECRET_KEY={jwt}\nJWT_ALGORITHM=HS256\nJWT_EXPIRATION_HOURS=8\nENCRYPTION_KEY={key}')" > backend\.env 2>nul
    if %ERRORLEVEL% neq 0 (
        echo  [..] Installing cryptography first...
        pip install cryptography --quiet 2>nul
        python -c "from cryptography.fernet import Fernet; import secrets; key=Fernet.generate_key().decode(); jwt=secrets.token_hex(32); print(f'DATABASE_URL=sqlite:///./fsm_workbench.db\nJWT_SECRET_KEY={jwt}\nJWT_ALGORITHM=HS256\nJWT_EXPIRATION_HOURS=8\nENCRYPTION_KEY={key}')" > backend\.env
    )
    echo  [OK] .env file created with secure keys
)

:: Install Python dependencies
echo  [..] Installing Python dependencies...
pip install -r backend\requirements.txt --quiet 2>nul
if %ERRORLEVEL% neq 0 (
    echo  [..] Retrying with --only-binary flag...
    pip install -r backend\requirements.txt --only-binary=:all: --quiet
)
echo  [OK] Python dependencies installed

:: Initialize database if needed
if not exist "backend\fsm_workbench.db" (
    echo  [..] Initializing database...
    pushd backend
    python init_db.py
    popd
    echo  [OK] Database initialized
) else (
    echo  [OK] Database exists
)
echo.

:: ─── Frontend setup ─────────────────────────────────────────────
echo  [..] Setting up frontend...
if not exist "frontend\node_modules" (
    echo  [..] Installing Node.js dependencies (first time, may take a minute)...
    pushd frontend
    call npm install --legacy-peer-deps --silent 2>nul
    popd
    echo  [OK] Node.js dependencies installed
) else (
    echo  [OK] Node.js dependencies exist
)
echo.

:: ─── Start servers ──────────────────────────────────────────────
echo  ══════════════════════════════════════════════════════════════
echo.
echo   Starting FSM DataBridge...
echo.
echo   Backend API:  http://localhost:8000
echo   Frontend UI:  http://localhost:5173
echo.
echo   Open your browser to: http://localhost:5173
echo.
echo   Press Ctrl+C in either window to stop.
echo.
echo  ══════════════════════════════════════════════════════════════
echo.

:: Start backend in a new window
start "DataBridge Backend" cmd /k "cd backend && python -m uvicorn app.main:app --reload --host 0.0.0.0"

:: Wait for backend to start
timeout /t 3 /nobreak >nul

:: Start frontend in a new window
start "DataBridge Frontend" cmd /k "cd frontend && npm run dev"

:: Wait for frontend to start
timeout /t 3 /nobreak >nul

:: Open browser
start http://localhost:5173

echo  DataBridge is running. Close this window or press any key to exit.
echo  (The backend and frontend windows will keep running)
echo.
pause
