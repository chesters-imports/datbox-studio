@echo off
REM desk only — browser at http://127.0.0.1:42929/
cd /d "%~dp0\box_sys"
start "" http://127.0.0.1:42929/
python server.py
if errorlevel 1 pause
