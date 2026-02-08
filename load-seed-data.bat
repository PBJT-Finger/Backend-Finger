@echo off
REM =====================================================
REM Load Consolidated Seed Data
REM =====================================================

echo.
echo =====================================================
echo  Loading Consolidated Seed Data
echo =====================================================
echo.

cd /d "%~dp0"

echo [INFO] Loading seed_data.sql...
mysql -u root -p finger_db < seeds\seed_data.sql

echo.
echo =====================================================
echo  Seed data loaded successfully!
echo =====================================================
echo.
echo Database: finger_db
echo Data includes:
echo - 6 Dosen + 5 Karyawan employees
echo - 2 Fingerprint devices
echo - Attendance data from Jan 3 - Feb 4, 2026
echo - Daily, Weekly, and Monthly attendance records
echo.

pause
