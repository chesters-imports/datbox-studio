@echo off
REM Quiet launch (no console) — falls back to python if pythonw missing
cd /d "%~dp0"
where pythonw >nul 2>&1
if %ERRORLEVEL%==0 (
  start "" pythonw run-in-deck-host.py
) else (
  python run-in-deck-host.py
)
