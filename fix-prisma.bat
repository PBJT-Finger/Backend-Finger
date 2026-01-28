@echo off
cls
echo ========================================
echo FIX: Prisma MySQL Setup
echo ========================================
echo.

echo Deleting old config file...
if exist prisma.config.ts (
    del /F /Q prisma.config.ts
    echo ✓ Deleted prisma.config.ts
) else (
    echo ✓ prisma.config.ts already deleted
)
echo.

echo Current schema.prisma should show:
echo   provider = "mysql"
echo   url = env("DATABASE_URL")
echo.

echo Pulling schema from MySQL database...
call bunx prisma db pull
if errorlevel 1 (
    echo.
    echo ERROR: Failed to pull schema
    echo.
    echo Please check:
    echo 1. MySQL is running
    echo 2. Database finger_db exists  
    echo 3. .env has: DATABASE_URL="mysql://root:admin@localhost:3306/finger_db"
    echo.
    pause
    exit /b 1
)
echo.

echo Generating Prisma Client...
call bunx prisma generate
if errorlevel 1 (
    echo ERROR: Failed to generate client
    pause
    exit /b 1
)
echo.

echo ========================================
echo SUCCESS! Prisma Ready!
echo ========================================
echo.
echo Next: Test connection with: bun run test-prisma.js
echo.
pause
