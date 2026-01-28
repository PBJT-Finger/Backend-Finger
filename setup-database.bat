@echo off
echo ========================================
echo Database Setup Script
echo ========================================
echo.

echo Step 1: Dropping existing database...
mysql -u root -p < delete.sql
if errorlevel 1 (
    echo Warning: Database may not exist, continuing...
)
echo.

echo Step 2: Creating fresh database...
mysql -u root -p -e "CREATE DATABASE finger_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
if errorlevel 1 (
    echo Database already exists, continuing...
)
echo.

echo Step 3: Importing production schema...
mysql -u root -p finger_db < production.sql
if errorlevel 1 (
    echo ERROR: Failed to import production schema!
    pause
    exit /b 1
)
echo.

echo Step 4: Loading sample data...
mysql -u root -p finger_db < dummy.sql
if errorlevel 1 (
    echo ERROR: Failed to load sample data!
    pause
    exit /b 1
)
echo.

echo ========================================
echo SUCCESS! Database setup complete!
echo ========================================
echo.
echo Database: finger_db
echo Tables: 6 (employees, shifts, attendance, devices, admins, password_resets)
echo Sample Data: 10 employees ^+ 63 attendance records
echo.
pause
