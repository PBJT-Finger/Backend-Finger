@echo off
REM =====================================================
REM Import Schema ke Database finger_db
REM =====================================================

echo =====================================================
echo Import Schema SQL ke finger_db
echo =====================================================
echo.

REM Cek apakah MySQL tersedia
where mysql >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] MySQL tidak ditemukan di PATH!
    echo.
    echo Coba tambahkan MySQL ke PATH:
    echo   SET PATH=%%PATH%%;C:\Program Files\MySQL\MySQL Server 8.0\bin
    echo.
    echo Atau gunakan MySQL Workbench untuk import schema.sql
    echo.
    pause
    exit /b 1
)

echo [INFO] MySQL ditemukan!
echo.

REM Cek apakah database finger_db sudah ada
echo [1/3] Cek database finger_db...
mysql -u root -p -e "USE finger_db;" 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] Database finger_db belum ada!
    echo [ACTION] Membuat database finger_db terlebih dahulu...
    echo.
    echo Masukkan password MySQL root:
    mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS finger_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
    
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Gagal membuat database!
        pause
        exit /b 1
    )
    echo [SUCCESS] Database finger_db berhasil dibuat!
) else (
    echo [OK] Database finger_db sudah ada
)

echo.
echo [2/3] Import schema.sql ke database...
echo Masukkan password MySQL root:
mysql -u root -p finger_db < schema.sql

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Gagal import schema!
    pause
    exit /b 1
)

echo.
echo [SUCCESS] Schema berhasil diimport!
echo.

echo [3/3] Verifikasi tabel...
echo Masukkan password MySQL root:
mysql -u root -p finger_db -e "SHOW TABLES;"

echo.
echo =====================================================
echo SETUP SELESAI!
echo =====================================================
echo.
echo Database: finger_db
echo Total Tabel: 8 tabel
echo.
echo Tabel yang dibuat:
echo   1. employees
echo   2. shifts
echo   3. holidays
echo   4. holiday_cache
echo   5. attendance
echo   6. devices
echo   7. admins
echo   8. users
echo.
echo Langkah selanjutnya:
echo   npm run dev
echo.
pause
