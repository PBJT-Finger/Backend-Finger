@echo off
echo Starting Finger Presence Backend (PRODUCTION MODE)...
echo ===================================================

:: Ensure dependencies are installed (optional check)
if not exist node_modules (
    echo node_modules not found. Installing dependencies...
    call npm ci
)

:: Run the application
echo Starting server...
npm start

pause
