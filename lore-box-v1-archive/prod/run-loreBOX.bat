@echo off
REM loreBOX ROM — double-click to open in The Deck Host
cd /d "%~dp0"
python run-in-deck-host.py
if errorlevel 1 pause
