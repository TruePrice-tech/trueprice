# Register the daily SEO snapshot in Windows Task Scheduler.
# Run this ONCE in PowerShell as Administrator. After that the task fires daily.
#
# Usage:
#   PowerShell -ExecutionPolicy Bypass -File scripts\seo-dashboard\register-task.ps1
#
# Schedule: 6:30 AM local time, daily.
# Modify $StartTime below if you want a different time.

$TaskName  = "Woogoro-SEO-Snapshot"
$StartTime = "06:30"
$BatPath   = "c:\Users\lanea\OneDrive\Desktop\TrueP Misc\trueprice\scripts\seo-dashboard\run-daily.bat"

if (-not (Test-Path $BatPath)) {
    Write-Error "BAT file not found at: $BatPath"
    exit 1
}

# Remove any existing task with the same name so re-runs are idempotent.
$existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existing) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Write-Host "Removed existing task: $TaskName"
}

$Action    = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$BatPath`""
$Trigger   = New-ScheduledTaskTrigger -Daily -At $StartTime
$Settings  = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopIfGoingOnBatteries -AllowStartIfOnBatteries -RunOnlyIfNetworkAvailable
$Principal = New-ScheduledTaskPrincipal -UserId "$env:USERNAME" -LogonType Interactive -RunLevel Limited

Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $Action `
    -Trigger $Trigger `
    -Settings $Settings `
    -Principal $Principal `
    -Description "Runs Woogoro SEO health snapshot daily, commits + pushes results." | Out-Null

Write-Host "Registered task: $TaskName"
Write-Host "Schedule: daily at $StartTime local time"
Write-Host ""
Write-Host "To verify:    Get-ScheduledTask -TaskName $TaskName"
Write-Host "To run now:   Start-ScheduledTask -TaskName $TaskName"
Write-Host "To remove:    Unregister-ScheduledTask -TaskName $TaskName -Confirm:`$false"
Write-Host ""
Write-Host "Logs written to: scripts\seo-dashboard\last-run.log"
