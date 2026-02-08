-- =====================================================
-- QUERY UNTUK MELIHAT ISI TABLE
-- Database: finger_db
-- =====================================================

-- 1. LIHAT SEMUA TABLE DI DATABASE
SHOW TABLES;

-- =====================================================
-- 2. LIHAT ISI TABLE EMPLOYEES
-- =====================================================

-- Semua employees
SELECT * FROM employees;

-- Dengan filter (hanya yang aktif)
SELECT * FROM employees WHERE is_active = 1;

-- Count by jabatan
SELECT 
  jabatan, 
  status,
  COUNT(*) as total
FROM employees
GROUP BY jabatan, status;

-- Detail per jabatan
SELECT 
  id,
  nip,
  nama,
  jabatan,
  status,
  tanggal_masuk,
  is_active
FROM employees
ORDER BY jabatan, nama;

-- =====================================================
-- 3. LIHAT ISI TABLE EMPLOYEE_DEVICE_MAPPING
-- =====================================================

-- Semua mapping
SELECT * FROM employee_device_mapping;

-- Join dengan employees untuk detail
SELECT 
  e.nip,
  e.nama,
  e.jabatan,
  m.device_user_id,
  m.device_pin,
  m.created_at
FROM employees e
LEFT JOIN employee_device_mapping m ON e.nip = m.nip
ORDER BY e.jabatan, CAST(m.device_pin AS UNSIGNED);

-- =====================================================
-- 4. LIHAT ISI TABLE ATTENDANCE (sample)
-- =====================================================

-- 10 attendance terakhir
SELECT * FROM attendance 
ORDER BY tanggal DESC, jam_masuk DESC 
LIMIT 10;

-- Attendance hari ini
SELECT 
  nip,
  nama,
  jabatan,
  jam_masuk,
  jam_keluar,
  status
FROM attendance 
WHERE tanggal = CURDATE()
ORDER BY jam_masuk;

-- Count attendance by date
SELECT 
  tanggal,
  jabatan,
  COUNT(*) as total_hadir
FROM attendance
WHERE tanggal >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
GROUP BY tanggal, jabatan
ORDER BY tanggal DESC, jabatan;

-- =====================================================
-- 5. LIHAT ISI TABLE DEVICES
-- =====================================================

SELECT * FROM devices;

-- =====================================================
-- 6. LIHAT ISI TABLE SHIFTS
-- =====================================================

SELECT * FROM shifts;

-- =====================================================
-- 7. STATISTIK KESELURUHAN
-- =====================================================

-- Total employees by jabatan
SELECT 
  'TOTAL EMPLOYEES' as metric,
  jabatan,
  COUNT(*) as count
FROM employees
WHERE is_active = 1
GROUP BY jabatan

UNION ALL

-- Total attendance records
SELECT 
  'TOTAL ATTENDANCE' as metric,
  'ALL' as jabatan,
  COUNT(*) as count
FROM attendance
WHERE is_deleted = 0

UNION ALL

-- Total devices
SELECT 
  'TOTAL DEVICES' as metric,
  'ALL' as jabatan,
  COUNT(*) as count
FROM devices;

-- =====================================================
-- 8. CARI PEGAWAI TERTENTU (contoh)
-- =====================================================

-- By NIP
SELECT * FROM employees WHERE nip = '850019763';

-- By nama (partial match)
SELECT * FROM employees WHERE nama LIKE '%Dede%';

-- By jabatan
SELECT * FROM employees WHERE jabatan = 'DOSEN';
SELECT * FROM employees WHERE jabatan = 'KARYAWAN';

-- =====================================================
-- 9. EXPORT DATA KE CSV (optional)
-- =====================================================

-- Export employees to CSV (run in mysql client with --batch flag)
-- mysql -u finger_user -pfinger finger_db -e "SELECT * FROM employees" > employees_export.csv
