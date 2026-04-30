@echo off
title FSM DataBridge - Stopping
echo.
echo  Stopping FSM DataBridge...
echo.

:: Kill Python (backend)
taskkill /f /im python.exe /fi "WINDOWTITLE eq DataBridge Backend*" >nul 2>nul
taskkill /f /im uvicorn.exe >nul 2>nul

:: Kill Node (frontend)
taskkill /f /im node.exe /fi "WINDOWTITLE eq DataBridge Frontend*" >nul 2>nul

:: Kill any remaining processes on the ports
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8000 ^| findstr LISTENING') do taskkill /PID %%a /F >nul 2>nul
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5173 ^| findstr LISTENING') do taskkill /PID %%a /F >nul 2>nul

echo  [OK] DataBridge stopped.
echo.
pause
