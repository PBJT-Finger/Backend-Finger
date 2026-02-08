@echo off
chcp 65001 >nul
echo ================================================
echo   MIGRASI DATA PEGAWAI - PRISMA VERSION
echo ================================================
echo.
echo Script ini akan mengimport 23 pegawai:
echo   - 21 DOSEN
echo   - 2 KARYAWAN (Dede Harisma ^& Danil Firmansyah)
echo.
echo Method: Prisma Client (Type-safe ^& Production-ready)
echo.
pause

echo.
echo [1/2] Importing employee data via Prisma...
node scripts/migrate-legacy-employees.js

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ✅ Employee migration completed!
) else (
    echo.
    echo ❌ Employee migration failed!
    echo Please check the error messages above.
    pause
    exit /b 1
)

echo.
echo [2/2] Creating device mapping table and seeding data...
node scripts/seed-device-mapping.js

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ✅ Device mapping completed!
) else (
    echo.
    echo ❌ Device mapping failed!
    pause
    exit /b 1
)

echo.
echo ================================================
echo   MIGRATION COMPLETED SUCCESSFULLY! ✅
echo ================================================
echo.
echo Database updated with:
echo   - 23 employees (21 DOSEN + 2 KARYAWAN)
echo   - 23 device mappings (PIN 1000-1022)
echo.
echo Next steps:
echo 1. ✅ Verify data: npm run verify-migration
echo 2. Register fingerprints on Revo W-202BNC device
echo 3. Configure ADMS software
echo 4. Test attendance sync
echo.
pause
