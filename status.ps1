#!/usr/bin/env pwsh
# FSM Conversion Workbench - Status Script
# Shows the status of backend and frontend servers

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "FSM Conversion Workbench - Status" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check backend (port 8000)
Write-Host "Backend Server:" -ForegroundColor White
$backendPort = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue

if ($backendPort) {
    $backendPID = $backendPort.OwningProcess
    $backendProcess = Get-Process -Id $backendPID -ErrorAction SilentlyContinue
    
    Write-Host "   ✅ Running" -ForegroundColor Green
    Write-Host "      PID: $backendPID" -ForegroundColor Gray
    if ($backendProcess) {
        Write-Host "      CPU: $([math]::Round($backendProcess.CPU, 2))s" -ForegroundColor Gray
        Write-Host "      Memory: $([math]::Round($backendProcess.WorkingSet64 / 1MB, 2)) MB" -ForegroundColor Gray
    }
    Write-Host "   URL: http://localhost:8000" -ForegroundColor Cyan
    Write-Host "   API Docs: http://localhost:8000/docs" -ForegroundColor Cyan
} else {
    Write-Host "   ❌ Not running" -ForegroundColor Red
}

Write-Host ""

# Check frontend (port 5173)
Write-Host "Frontend Server:" -ForegroundColor White
$frontendPort = Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue

if ($frontendPort) {
    $frontendPID = $frontendPort.OwningProcess
    $frontendProcess = Get-Process -Id $frontendPID -ErrorAction SilentlyContinue
    
    Write-Host "   ✅ Running" -ForegroundColor Green
    Write-Host "      PID: $frontendPID" -ForegroundColor Gray
    if ($frontendProcess) {
        Write-Host "      CPU: $([math]::Round($frontendProcess.CPU, 2))s" -ForegroundColor Gray
        Write-Host "      Memory: $([math]::Round($frontendProcess.WorkingSet64 / 1MB, 2)) MB" -ForegroundColor Gray
    }
    Write-Host "   URL: http://localhost:5173" -ForegroundColor Cyan
} else {
    Write-Host "   ❌ Not running" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Test connectivity
if ($backendPort) {
    Write-Host "Testing backend connectivity..." -ForegroundColor Gray
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:8000/health" -TimeoutSec 2 -ErrorAction Stop
        Write-Host "   ✅ Backend is responding" -ForegroundColor Green
    } catch {
        Write-Host "   ⚠️  Backend is running but not responding" -ForegroundColor Yellow
    }
}

if ($frontendPort) {
    Write-Host "Testing frontend connectivity..." -ForegroundColor Gray
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:5173" -TimeoutSec 2 -ErrorAction Stop
        Write-Host "   ✅ Frontend is responding" -ForegroundColor Green
    } catch {
        Write-Host "   ⚠️  Frontend is running but not responding" -ForegroundColor Yellow
    }
}

Write-Host ""
