@echo off
REM test-clean.bat - Test Clean Architecture Implementation

echo ========================================
echo CLEAN ARCHITECTURE VALIDATION TEST
echo ========================================
echo.

node test-clean-architecture.js

if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo CLEAN ARCHITECTURE: VERIFIED ^& WORKING
    echo ========================================
) else (
    echo.
    echo ========================================
    echo CLEAN ARCHITECTURE: TESTS FAILED
    echo ========================================
    exit /b 1
)

pause
