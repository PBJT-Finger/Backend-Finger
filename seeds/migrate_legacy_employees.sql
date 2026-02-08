-- =====================================================
-- LEGACY EMPLOYEE DATA MIGRATION
-- Source: pegawai table (backup microSD)
-- Target: employees table (finger_db)
-- Total Records: 23 pegawai
-- =====================================================

USE finger_db;

-- =====================================================
-- MIGRATION STATISTICS
-- =====================================================
SELECT '🔄 Starting Legacy Employee Migration...' AS '';
SELECT '📦 Source: pegawai table (23 records)' AS '';
SELECT '🎯 Target: employees table' AS '';
SELECT '📌 Jabatan: 21 DOSEN + 2 KARYAWAN (Dede & Danil)' AS '';

-- =====================================================
-- INSERT LEGACY EMPLOYEES
-- Note: Using INSERT IGNORE to skip duplicates
-- =====================================================

INSERT IGNORE INTO employees (nip, nama, jabatan, shift_id, status, tanggal_masuk, is_active) VALUES
-- DOSEN (21 orang - semuanya kecuali Dede dan Danil)
('850019763', 'Slamet Riyadi, M.T', 'DOSEN', NULL, 'AKTIF', '2024-10-03', 1),
('850020771', 'Sendie Yuliarto Margen, M.T', 'DOSEN', NULL, 'AKTIF', '2024-10-03', 1),
('850070351', 'Lily Budinurani, M.Pd', 'DOSEN', NULL, 'AKTIF', '2024-10-03', 1),
('850110501', 'Ria Candra Dewi, M.Pd', 'DOSEN', NULL, 'AKTIF', '2024-10-03', 1),
('850019761', 'Atiek Nurindriani, M.Pd', 'DOSEN', NULL, 'AKTIF', '2024-10-03', 1),
('850018701', 'Aziz Azindani, M.Kom', 'DOSEN', NULL, 'AKTIF', '2024-10-03', 1),
('850020805', 'Ali Wardana, M.Pd', 'DOSEN', NULL, 'AKTIF', '2024-10-03', 1),
('850023057', 'Tunggal Ajining Prasetiadi, M.T', 'DOSEN', NULL, 'AKTIF', '2024-10-03', 1),
('850080388', 'Agung Nugroho, M.T', 'DOSEN', NULL, 'AKTIF', '2024-10-03', 1),
('850016624', 'Ismi Kusumaningroem, M.Pd', 'DOSEN', NULL, 'AKTIF', '2024-10-03', 1),
('850023059', 'Ilham Akhsani, S.Tr.Kom', 'DOSEN', NULL, 'AKTIF', '2024-10-03', 1),
('850110487', 'Budi Pribowo, SST', 'DOSEN', NULL, 'AKTIF', '2024-10-03', 1),
('850130906', 'Mizar Wahyu Ardani, ST', 'DOSEN', NULL, 'AKTIF', '2024-10-03', 1),
('850060330', 'Susanto, S.Pd', 'DOSEN', NULL, 'AKTIF', '2024-10-03', 1),
('850050295', 'Nurul Atiqoh, S.Pd', 'DOSEN', NULL, 'AKTIF', '2024-10-03', 1),
('850016595', 'Tri Looke Darwanto, S.Kom', 'DOSEN', NULL, 'AKTIF', '2024-10-03', 1),
('850020813', 'Robiatul Adawiyah, M.Kom', 'DOSEN', NULL, 'AKTIF', '2024-10-03', 1),
('850022029', 'M Hasan Fatoni, ST', 'DOSEN', NULL, 'AKTIF', '2024-10-03', 1),
('1018', 'Eko Supriyanto, ST', 'DOSEN', NULL, 'AKTIF', '2024-10-03', 1),
('1019', 'A Maulana Izzudin, S.Pd', 'DOSEN', NULL, 'AKTIF', '2024-10-03', 1),
('1020', 'Ayu Ningrum Purnamasari, S.Pd', 'DOSEN', NULL, 'AKTIF', '2024-10-03', 1),

-- KARYAWAN (2 orang - hanya Dede dan Danil)
('1021', 'Dede Harisma', 'KARYAWAN', 1, 'AKTIF', '2024-10-03', 1),
('1022', 'Danil Firmansyah', 'KARYAWAN', 1, 'AKTIF', '2024-10-03', 1);

-- =====================================================
-- MIGRATION VERIFICATION
-- =====================================================

SELECT '\n==================== MIGRATION COMPLETE ====================\n' AS '';

-- Count imported employees
SELECT 
  jabatan AS 'Position',
  COUNT(*) AS 'Total Employees'
FROM employees
WHERE tanggal_masuk = '2024-10-03'
GROUP BY jabatan;

-- Show sample imported data
SELECT '\n==================== SAMPLE IMPORTED DATA ====================\n' AS '';
SELECT 
  nip AS 'NIP',
  nama AS 'Name',
  jabatan AS 'Position',
  status AS 'Status',
  tanggal_masuk AS 'Join Date'
FROM employees
WHERE tanggal_masuk = '2024-10-03'
ORDER BY jabatan, nama
LIMIT 10;

-- Overall statistics
SELECT '\n==================== OVERALL STATISTICS ====================\n' AS '';
SELECT 
  jabatan,
  status,
  COUNT(*) as total
FROM employees
GROUP BY jabatan, status
ORDER BY jabatan, status;

SELECT '\n✅ Legacy employee migration completed!' AS '';
SELECT '📊 Total migrated: 23 pegawai (21 DOSEN + 2 KARYAWAN)' AS '';
