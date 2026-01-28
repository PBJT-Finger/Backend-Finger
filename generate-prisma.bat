@echo off
echo ========================================
echo Prisma Schema Generation
echo ========================================
echo.

echo Step 1: Pull schema from database...
call bunx prisma db pull
if errorlevel 1 (
    echo ERROR: Failed to pull schema from database
    echo.
    echo Troubleshooting:
    echo 1. Check MySQL is running
    echo 2. Verify DATABASE_URL in .env is correct
    echo 3. Ensure finger_db database exists
    pause
    exit /b 1
)
echo.

echo Step 2: Generate Prisma Client...
call bunx prisma generate
if errorlevel 1 (
    echo ERROR: Failed to generate Prisma Client
    pause
    exit /b 1
)
echo.

echo ========================================
echo SUCCESS! Prisma schema generated!
echo ========================================
echo.
echo Next step: Run test-prisma.js to verify connection
echo Command: bun run test-prisma.js
echo.
pause
