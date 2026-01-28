@echo off
echo Running Backend Tests...
echo =======================

call bun run test-backend.js

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ✅ ALL TESTS PASSED
) else (
    echo.
    echo ❌ TESTS FAILED
)

pause
