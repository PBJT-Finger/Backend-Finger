-- =====================================================
-- FINGER ATTENDANCE SYSTEM - DATABASE CLEANUP
-- Version: 1.0.0
-- Description: Script untuk menghapus database finger_db
-- =====================================================

-- =====================================================
-- ⚠️ WARNING: DESTRUCTIVE OPERATION ⚠️
-- 
-- Script ini akan menghapus SELURUH database finger_db
-- beserta semua data di dalamnya!
-- 
-- BACKUP DULU sebelum menjalankan script ini!
-- 
-- Cara backup:
-- mysqldump -u root -p finger_db > backup_finger_db_$(date +%Y%m%d_%H%M%S).sql
-- =====================================================

-- Show current databases before deletion
SELECT '📋 Current databases:' AS Info;
SHOW DATABASES LIKE 'finger%';

-- Confirmation message
SELECT '⚠️  CAUTION: About to drop database finger_db' AS Warning;
SELECT '💾 Make sure you have backed up your data!' AS Reminder;
SELECT '⏳ Proceeding in 3 seconds...' AS Countdown;

-- Drop database
DROP DATABASE IF EXISTS finger_db;

-- Verify deletion
SELECT '✅ Database finger_db has been deleted!' AS Status;
SELECT '📋 Remaining databases:' AS Info;
SHOW DATABASES LIKE 'finger%';

-- =====================================================
-- WHAT WAS DELETED:
-- =====================================================
-- ❌ Database: finger_db
-- ❌ All tables (6 tables):
--    - employees
--    - shifts
--    - attendance
--    - devices
--    - admins
--    - password_resets
-- ❌ All data (employees, attendance records, etc.)
-- ❌ All indexes
-- ❌ All foreign key constraints
-- 
-- =====================================================
-- TO RECREATE DATABASE:
-- =====================================================
-- Step 1: Create fresh database
-- CREATE DATABASE finger_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- 
-- Step 2: Run production schema
-- mysql -u root -p < production.sql
-- 
-- Step 3 (Optional): Load sample data
-- mysql -u root -p < dummy.sql
-- =====================================================

-- =====================================================
-- USAGE EXAMPLES:
-- =====================================================
-- 
-- Option 1: Direct execution
-- mysql -u root -p < delete.sql
-- 
-- Option 2: From MySQL prompt
-- mysql> source delete.sql;
-- 
-- Option 3: Single command
-- mysql -u root -p -e "DROP DATABASE IF EXISTS finger_db;"
-- 
-- =====================================================
