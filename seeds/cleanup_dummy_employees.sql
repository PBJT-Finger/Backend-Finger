-- =====================================================
-- CLEANUP DUMMY EMPLOYEES - SQL SCRIPT
-- Delete 11 dummy employees (6 DOSEN + 5 KARYAWAN)
-- Keep only 23 migrated employees
-- =====================================================

USE finger_db;

-- =====================================================
-- 1. SHOW CURRENT STATE
-- =====================================================

SELECT '📊 BEFORE CLEANUP - Current Employees:' AS '';
SELECT jabatan, COUNT(*) as total
FROM employees
WHERE is_active = 1
GROUP BY jabatan;

-- =====================================================
-- 2. DELETE DUMMY EMPLOYEES
-- =====================================================

-- Delete attendance records for dummy employees first
DELETE FROM attendance WHERE nip IN (
  -- DOSEN (6 dummy)
  '198805121234561001',
  '198206151234572001',
  '198512181234563001',
  '198703201234564001',
  '198909221234565001',
  '199011251234566001',
  -- KARYAWAN (5 dummy)
  '198801152000121001',
  '199002172000122001',
  '198905192000123001',
  '199103212000124001',
  '198806232000125001'
);

SELECT CONCAT('✅ Deleted ', ROW_COUNT(), ' attendance records') AS '';

-- Delete dummy employees
DELETE FROM employees WHERE nip IN (
  -- DOSEN (6 dummy)
  '198805121234561001', -- Dr. Ahmad Hidayat, M.Kom
  '198206151234572001', -- Dr. Siti Nurhaliza, M.T
  '198512181234563001', -- Dr. Budi Prasetyo, M.Kom
  '198703201234564001', -- Dr. Ratna Sari, M.T
  '198909221234565001', -- Dr. Eko Wijaya, M.Kom
  '199011251234566001', -- Dr. Dewi Lestari, M.T
  -- KARYAWAN (5 dummy)
  '198801152000121001', -- Andi Wijaya
  '199002172000122001', -- Budi Santoso
  '198905192000123001', -- Citra Dewi
  '199103212000124001', -- Dani Firmansyah
  '198806232000125001'  -- Eka Putri
);

SELECT CONCAT('✅ Deleted ', ROW_COUNT(), ' employees') AS '';

-- =====================================================
-- 3. VERIFY FINAL STATE
-- =====================================================

SELECT '\n📊 AFTER CLEANUP - Remaining Employees:' AS '';
SELECT jabatan, COUNT(*) as total
FROM employees
WHERE is_active = 1
GROUP BY jabatan;

-- Should show:
-- DOSEN: 21 (only from migration)
-- KARYAWAN: 2 (only Dede & Danil)

-- Verify migrated employees intact
SELECT '\n✅ Migrated Employees (2024-10-03):' AS '';
SELECT COUNT(*) as total_migrated
FROM employees
WHERE tanggal_masuk = '2024-10-03';

-- Expected: 23

-- Show sample migrated employees
SELECT '\n📋 Sample Migrated Employees:' AS '';
SELECT 
  nip,
  nama,
  jabatan
FROM employees
WHERE tanggal_masuk = '2024-10-03'
ORDER BY jabatan, nama
LIMIT 10;

SELECT '\n✅ Cleanup completed successfully!' AS '';
