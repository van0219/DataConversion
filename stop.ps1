#!/usr/bin/env pwsh
# FSM Conversion Workbench - Stop Script
# Stops both backend and frontend servers

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "FSM Conversion Workbench - Stopping..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$stoppedCount = 0

# Stop all PowerShell jobs
Write-Host "Stopping Background Jobs..." -ForegroundColor Yellow
$jobs = Get-Job -ErrorAction SilentlyContinue
if ($jobs) {
    foreach ($job in $jobs) {
        Write-Host "   Stopping job: $($job.Id) - $($job.State)" -ForegroundColor Gray
        Stop-Job -Id $job.Id -ErrorAction SilentlyContinue
        Remove-Job -Id $job.Id -Force -ErrorAction SilentlyContinue
        $stoppedCount++
    }
}

# Stop backend processes on port 8000
Write-Host ""
Write-Host "Stopping Backend Server (port 8000)..." -ForegroundColor Yellow
$backendPort = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue
if ($backendPort) {
    $backendPID = $backendPort.OwningProcess
    Write-Host "   Stopping process: $backendPID" -ForegroundColor Gray
    Stop-Process -Id $backendPID -Force -ErrorAction SilentlyContinue
    $stoppedCount++
    Write-Host "   Backend stopped" -ForegroundColor Green
} else {
    Write-Host "   Backend is not running on port 8000" -ForegroundColor Gray
}

# Kill ALL Python/uvicorn processes (to catch orphaned workers)
Write-Host ""
Write-Host "Stopping All Python/Uvicorn Processes..." -ForegroundColor Yellow
$pythonProcesses = Get-Process python -ErrorAction SilentlyContinue
if ($pythonProcesses) {
    foreach ($proc in $pythonProcesses) {
        Write-Host "   Stopping Python process: $($proc.Id)" -ForegroundColor Gray
        Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
        $stoppedCount++
    }
    Write-Host "   All Python processes stopped" -ForegroundColor Green
} else {
    Write-Host "   No Python processes running" -ForegroundColor Gray
}

# Stop frontend processes on port 5173
Write-Host ""
Write-Host "Stopping Frontend Server (port 5173)..." -ForegroundColor Yellow
$frontendPort = Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue
if ($frontendPort) {
    $frontendPID = $frontendPort.OwningProcess
    Write-Host "   Stopping process: $frontendPID" -ForegroundColor Gray
    Stop-Process -Id $frontendPID -Force -ErrorAction SilentlyContinue
    $stoppedCount++
    Write-Host "   Frontend stopped" -ForegroundColor Green
} else {
    Write-Host "   Frontend is not running" -ForegroundColor Gray
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan

if ($stoppedCount -gt 0) {
    Write-Host "Stopped $stoppedCount process(es)" -ForegroundColor Green
} else {
    Write-Host "No servers were running" -ForegroundColor Gray
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "To start the servers again, run: .\start.ps1" -ForegroundColor Yellow
Write-Host ""
