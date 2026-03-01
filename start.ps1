#!/usr/bin/env pwsh
# FSM Conversion Workbench - Start Script
# Starts both backend and frontend servers in background

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "FSM Conversion Workbench - Starting..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if backend is already running
$backendRunning = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue

if ($backendRunning) {
    Write-Host "⚠️  Backend is already running on port 8000" -ForegroundColor Yellow
} else {
    Write-Host "🚀 Starting Backend Server..." -ForegroundColor Green
    $backendJob = Start-Job -ScriptBlock {
        Set-Location $using:PWD
        Set-Location backend
        python -m uvicorn app.main:app --reload
    }
    Write-Host "   Job ID: $($backendJob.Id)" -ForegroundColor Gray
    Write-Host "   Backend: http://localhost:8000" -ForegroundColor Gray
    Write-Host "   API Docs: http://localhost:8000/docs" -ForegroundColor Gray
    Start-Sleep -Seconds 3
}

# Check if frontend is already running
$frontendRunning = Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue

if ($frontendRunning) {
    Write-Host "⚠️  Frontend is already running on port 5173" -ForegroundColor Yellow
} else {
    Write-Host ""
    Write-Host "🚀 Starting Frontend Server..." -ForegroundColor Green
    $frontendJob = Start-Job -ScriptBlock {
        Set-Location $using:PWD
        Set-Location frontend
        npm run dev
    }
    Write-Host "   Job ID: $($frontendJob.Id)" -ForegroundColor Gray
    Write-Host "   Frontend: http://localhost:5173" -ForegroundColor Gray
    Start-Sleep -Seconds 3
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ Servers Started in Background!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Access the application at: http://localhost:5173" -ForegroundColor White
Write-Host ""
Write-Host "To view logs: .\logs.ps1" -ForegroundColor Yellow
Write-Host "To stop servers: .\stop.ps1" -ForegroundColor Yellow
Write-Host "To check status: .\status.ps1" -ForegroundColor Yellow
Write-Host ""
