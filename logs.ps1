#!/usr/bin/env pwsh
# FSM Conversion Workbench - Logs Script
# Shows logs from background jobs

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "FSM Conversion Workbench - Logs" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$jobs = Get-Job -ErrorAction SilentlyContinue

if (-not $jobs) {
    Write-Host "ℹ️  No background jobs running" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Servers may be running but not as PowerShell jobs." -ForegroundColor Yellow
    Write-Host "Use .\status.ps1 to check if servers are running." -ForegroundColor Yellow
    Write-Host ""
    exit
}

Write-Host "Active Jobs:" -ForegroundColor White
foreach ($job in $jobs) {
    Write-Host "  Job $($job.Id): $($job.State)" -ForegroundColor Gray
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Recent Output (last 50 lines per job):" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

foreach ($job in $jobs) {
    Write-Host ""
    Write-Host "--- Job $($job.Id) ---" -ForegroundColor Yellow
    
    $output = Receive-Job -Id $job.Id -Keep -ErrorAction SilentlyContinue
    
    if ($output) {
        $output | Select-Object -Last 50 | ForEach-Object {
            Write-Host $_ -ForegroundColor Gray
        }
    } else {
        Write-Host "  (No output yet)" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C to exit" -ForegroundColor Yellow
Write-Host "To stop servers: .\stop.ps1" -ForegroundColor Yellow
Write-Host ""
