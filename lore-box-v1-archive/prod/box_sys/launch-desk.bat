@echo off
REM loreBOX desk launcher — cute host for testers (B5)
cd /d "%~dp0"
start "loreBOX server" cmd /k python server.py
timeout /t 1 /nobreak >nul
start "" "http://datbox.lorebox.localhost:42929/"
