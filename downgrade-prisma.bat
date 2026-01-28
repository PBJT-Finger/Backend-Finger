@echo off
cls
echo ========================================
echo FIX: Downgrade Prisma to v6.x (Stable)
echo ========================================
echo.

echo Uninstalling Prisma 7.x...
call bun remove prisma @prisma/client
echo.

echo Installing Prisma 6.x (stable)...
call bun add @prisma/client@6
call bun add -D prisma@6
echo.

echo Checking version...
call bunx prisma --version
echo.

echo Pulling schema from MySQL...
call bunx prisma db pull
if errorlevel 1 (
    echo ERROR: Failed to pull schema
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
echo SUCCESS! Prisma 6.x Ready!
echo ========================================
echo.
echo Database: finger_db (MySQL)
echo Schema: prisma/schema.prisma (6 models)
echo Client: Generated successfully
echo.
echo Next: Test with: bun run test-prisma.js
echo.
pause
