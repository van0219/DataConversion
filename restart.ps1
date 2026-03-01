#!/usr/bin/env pwsh
# FSM Conversion Workbench - Restart Script
# Restarts both backend and frontend servers

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "FSM Conversion Workbench - Restarting..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Stop servers
Write-Host "🛑 Stopping servers..." -ForegroundColor Yellow
& .\stop.ps1

Write-Host ""
Write-Host "⏳ Waiting 2 seconds..." -ForegroundColor Gray
Start-Sleep -Seconds 2

Write-Host ""
Write-Host "🚀 Starting servers..." -ForegroundColor Green
& .\start.ps1
