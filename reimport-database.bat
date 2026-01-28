@echo off
cls
echo ========================================
echo RE-IMPORT DATABASE (Department/Fakultas Removed)
echo ========================================
echo.

echo Step 1: Drop existing database...
mysql -u root -p < delete.sql
if errorlevel 1 (
    echo Warning: Database may not exist
)
echo.

echo Step 2: Create fresh database...
mysql -u root -p -e "CREATE DATABASE finger_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
if errorlevel 1 (
    echo ERROR: Failed to create database
    pause
    exit /b 1
)
echo.

echo Step 3: Import production schema (NO department/fakultas)...
mysql -u root -p finger_db < production.sql
if errorlevel 1 (
    echo ERROR: Failed to import schema
    pause
    exit /b 1
)
echo.

echo Step 4: Load sample data...
mysql -u root -p finger_db < dummy.sql
if errorlevel 1 (
    echo ERROR: Failed to load sample data
    pause
    exit /b 1
)
echo.

echo Step 5: Pull Prisma schema from database...
bunx prisma db pull
if errorlevel 1 (
    echo ERROR: Failed to pull Prisma schema
    pause
    exit /b 1
)
echo.

echo Step 6: Generate Prisma Client...
bunx prisma generate
if errorlevel 1 (
    echo ERROR: Failed to generate Prisma client
    pause
    exit /b 1
)
echo.

echo ========================================
echo SUCCESS! Database Re-imported!
echo ========================================
echo.
echo Changes:
echo - Removed 'department' field from employees
echo - Removed 'fakultas' field from employees
echo.
echo Database: finger_db (refreshed)
echo Schema: Prisma schema regenerated
echo.
echo Next: Test with: bun run test-prisma.js
echo.
pause
