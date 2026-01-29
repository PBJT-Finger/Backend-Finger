@echo off
echo ================================================
echo   BACKEND RESTART SCRIPT
echo ================================================
echo.

cd /d "c:\Users\user\Downloads\Finger\Backend-Finger"

echo [1] Stopping existing processes on port 5000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5000') do (
    taskkill /F /PID %%a 2>nul
)
timeout /t 2 /nobreak >nul

echo.
echo [2] Starting backend server...
echo.
start cmd /k "npm run dev"

timeout /t 3 /nobreak >nul

echo.
echo [3] Checking if server started...
powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://localhost:5000/finger-api/docs' -Method GET -TimeoutSec 5; Write-Host 'SUCCESS: Backend is running!' -ForegroundColor Green } catch { Write-Host 'WAITING: Server still starting...' -ForegroundColor Yellow }"

echo.
echo ================================================
echo   Script completed!
echo   Backend should be running in a new window
echo ================================================
pause
