@echo off
REM Daily SEO snapshot — runs all collectors, commits + pushes.
REM Wired to Windows Task Scheduler. Edit run-daily-register.ps1 to change schedule.

cd /d "c:\Users\lanea\OneDrive\Desktop\TrueP Misc\trueprice"

REM Run snapshot. Skip lighthouse if it errors (it spawns a python server which
REM may not be reachable on a system that just woke up).
node scripts\seo-dashboard\run-snapshot.js > scripts\seo-dashboard\last-run.log 2>&1
if errorlevel 1 (
  echo SEO snapshot failed — see last-run.log >> scripts\seo-dashboard\last-run.log
  exit /b 1
)

REM Stage + commit + push only if there are changes.
git add data\seo-snapshot.json data\seo-history\ >> scripts\seo-dashboard\last-run.log 2>&1
git diff --cached --quiet
if errorlevel 1 (
  REM There are staged changes
  for /f "tokens=2 delims==" %%I in ('"wmic os get localdatetime /value"') do set today=%%I
  set today=%today:~0,4%-%today:~4,2%-%today:~6,2%
  git commit -m "SEO dashboard: daily snapshot %today%" >> scripts\seo-dashboard\last-run.log 2>&1
  git push origin main >> scripts\seo-dashboard\last-run.log 2>&1
  echo Committed and pushed daily snapshot >> scripts\seo-dashboard\last-run.log
) else (
  echo No changes to commit >> scripts\seo-dashboard\last-run.log
)

echo Done at %date% %time% >> scripts\seo-dashboard\last-run.log
