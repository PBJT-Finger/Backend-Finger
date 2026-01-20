@echo off
REM Script to import password reset migration
REM Run this script to add password_resets table to the database

echo ========================================
echo Password Reset Migration Script
echo ========================================
echo.

REM Load environment variables
set DB_NAME=finger_db
set DB_USER=finger_user
set DB_PASSWORD=finger

echo Database: %DB_NAME%
echo User: %DB_USER%
echo.

echo Running migration_002_password_reset.sql...
mysql -u %DB_USER% -p%DB_PASSWORD% %DB_NAME% < migration_002_password_reset.sql

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo ^✓ Migration completed successfully!
    echo ========================================
    echo.
    echo The password_resets table has been created.
    echo You can now use:
    echo   - POST /api/auth/register
    echo   - POST /api/auth/forgot-password
    echo   - POST /api/auth/verify-code
    echo   - POST /api/auth/reset-password
    echo.
) else (
    echo.
    echo ========================================
    echo ^✗ Migration failed!
    echo ========================================
    echo Check your database credentials and connection.
    echo.
)

pause
