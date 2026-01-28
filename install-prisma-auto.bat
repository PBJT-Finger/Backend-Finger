@echo off
echo ========================================
echo Prisma Installation Script
echo ========================================
echo.

echo Step 1: Installing @prisma/client...
call bun add @prisma/client
if errorlevel 1 (
    echo ERROR: Failed to install @prisma/client
    pause
    exit /b 1
)
echo.

echo Step 2: Installing prisma CLI (dev dependency)...
call bun add -D prisma
if errorlevel 1 (
    echo ERROR: Failed to install prisma CLI
    pause
    exit /b 1
)
echo.

echo Step 3: Initializing Prisma...
call bunx prisma init
if errorlevel 1 (
    echo ERROR: Failed to initialize Prisma
    pause
    exit /b 1
)
echo.

echo ========================================
echo SUCCESS! Prisma installed!
echo ========================================
echo.
echo Next steps:
echo 1. Update .env with DATABASE_URL
echo 2. Run: bunx prisma db pull
echo 3. Run: bunx prisma generate
echo.
pause
