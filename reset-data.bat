@echo off
REM =====================================================
REM RESET DUMMY DATA - Complete cleanup and reimport
REM =====================================================

echo.
echo ================================================
echo   RESET DUMMY DATA
echo ================================================
echo.
echo This will:
echo  1. DELETE all attendance records
echo  2. DELETE all employees
echo  3. DELETE all devices (fingerprint only)
echo  4. IMPORT fresh dummy data
echo.
pause

echo.
echo [1/2] Cleaning up old data...
mysql -u root -padmin finger_db -e "SET FOREIGN_KEY_CHECKS=0; TRUNCATE TABLE attendance; DELETE FROM employees; DELETE FROM devices WHERE device_id LIKE 'FP-%%'; SET FOREIGN_KEY_CHECKS=1;"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ❌ ERROR: Failed to clean up data
    pause
    exit /b 1
)

echo ✅ Old data cleaned successfully
echo.
echo [2/2] Importing fresh dummy data...
mysql -u root -padmin finger_db < seeds\dummy.sql

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ❌ ERROR: Failed to import dummy data
    pause
    exit /b 1
)

echo.
echo ================================================
echo   ✅ SUCCESS!
echo ================================================
echo.
echo Dummy data imported successfully:
echo  - 10 Employees (5 Dosen + 5 Karyawan)
echo  - ~63 Attendance records (last 7 days)
echo  - 2 Fingerprint devices
echo.
echo Next step: Restart backend server with "npm run dev"
echo.
pause
