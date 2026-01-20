-- =====================================================
-- Backend Finger - Database Migration Script
-- Version: 1.0.0
-- Description: Create new tables for flexible attendance system
-- =====================================================

-- =====================================================
-- 1. CREATE EMPLOYEES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS employees (
  id INT PRIMARY KEY AUTO_INCREMENT,
  nip VARCHAR(50) UNIQUE NOT NULL COMMENT 'Nomor Induk Pegawai',
  nama VARCHAR(255) NOT NULL COMMENT 'Nama lengkap pegawai',
  jabatan ENUM('DOSEN', 'KARYAWAN') NOT NULL COMMENT 'Jabatan pegawai',
  
  -- Organizational info
  department VARCHAR(100) COMMENT 'Departemen/Unit kerja',
  fakultas VARCHAR(100) COMMENT 'Fakultas',
  email VARCHAR(100) COMMENT 'Email pegawai',
  phone VARCHAR(20) COMMENT 'Nomor telepon',
  
  -- Shift assignment (for KARYAWAN only)
  shift_id INT NULL COMMENT 'NULL untuk DOSEN (flexible schedule)',
  
  -- Status
  status ENUM('AKTIF', 'CUTI', 'RESIGN', 'NON_AKTIF') DEFAULT 'AKTIF' COMMENT 'Status pegawai',
  tanggal_masuk DATE COMMENT 'Tanggal mulai bekerja',
  is_active BOOLEAN DEFAULT TRUE COMMENT 'Status aktif',
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Indexes
  INDEX idx_nip (nip),
  INDEX idx_jabatan (jabatan),
  INDEX idx_shift (shift_id),
  INDEX idx_status (status),
  INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Master data pegawai (dosen dan karyawan)';

-- =====================================================
-- 2. CREATE SHIFTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS shifts (
  id INT PRIMARY KEY AUTO_INCREMENT,
  nama_shift VARCHAR(50) NOT NULL COMMENT 'Nama shift (e.g., Shift Pagi, Shift Malam)',
  jam_masuk TIME NOT NULL COMMENT 'Jam masuk yang diharapkan',
  toleransi_menit INT DEFAULT 0 COMMENT 'Grace period dalam menit',
  deskripsi TEXT COMMENT 'Deskripsi shift',
  is_active BOOLEAN DEFAULT TRUE COMMENT 'Status aktif shift',
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Master data shift kerja';

-- =====================================================
-- 3. CREATE HOLIDAYS TABLE (Master Rules)
-- =====================================================
CREATE TABLE IF NOT EXISTS holidays (
  id INT PRIMARY KEY AUTO_INCREMENT,
  
  -- Holiday identification
  nama_libur VARCHAR(255) NOT NULL COMMENT 'Nama hari libur',
  deskripsi TEXT COMMENT 'Deskripsi lengkap',
  
  -- Type of calculation
  holiday_type ENUM('FIXED', 'LUNAR', 'FORMULA') NOT NULL 
    COMMENT 'FIXED: tanggal tetap, LUNAR: kalender Hijriyah, FORMULA: rumus perhitungan',
  
  -- For FIXED holidays (e.g., New Year, Independence Day)
  bulan TINYINT NULL COMMENT '1-12, digunakan untuk hari libur tanggal tetap',
  hari TINYINT NULL COMMENT '1-31, digunakan untuk hari libur tanggal tetap',
  
  -- For LUNAR holidays (Hijri calendar - Idul Fitri, Idul Adha, etc.)
  hijri_month TINYINT NULL COMMENT '1-12 bulan Hijriyah',
  hijri_day TINYINT NULL COMMENT '1-30 hari Hijriyah',
  
  -- For FORMULA holidays (e.g., Easter, Nyepi)
  formula_code VARCHAR(50) NULL COMMENT 'Kode untuk menghitung tanggal',
  
  -- Metadata
  tipe ENUM('NASIONAL', 'CUTI_BERSAMA', 'HARI_RAYA', 'KAMPUS') NOT NULL,
  tahun_mulai INT DEFAULT 2026 COMMENT 'Tahun mulai libur ini berlaku',
  tahun_akhir INT NULL COMMENT 'NULL = perpetual (berlaku selamanya)',
  is_active BOOLEAN DEFAULT TRUE COMMENT 'Status aktif',
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_holiday_type (holiday_type),
  INDEX idx_tipe (tipe),
  INDEX idx_is_active (is_active),
  INDEX idx_tahun_range (tahun_mulai, tahun_akhir)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Master rules untuk perhitungan hari libur perpetual';

-- =====================================================
-- 4. CREATE HOLIDAY CACHE TABLE (Pre-calculated)
-- =====================================================
CREATE TABLE IF NOT EXISTS holiday_cache (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tanggal DATE NOT NULL COMMENT 'Tanggal libur yang sudah dihitung',
  nama_libur VARCHAR(255) NOT NULL COMMENT 'Nama hari libur',
  tipe ENUM('NASIONAL', 'CUTI_BERSAMA', 'HARI_RAYA', 'KAMPUS') NOT NULL,
  tahun YEAR NOT NULL COMMENT 'Tahun libur',
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE INDEX idx_tanggal (tanggal),
  INDEX idx_tahun (tahun),
  INDEX idx_tipe (tipe)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Cache pre-calculated hari libur untuk performa query';

-- =====================================================
-- 5. ADD FOREIGN KEY CONSTRAINTS
-- =====================================================
ALTER TABLE employees 
  ADD CONSTRAINT fk_employee_shift 
  FOREIGN KEY (shift_id) REFERENCES shifts(id) 
  ON DELETE SET NULL;

-- =====================================================
-- 6. SEED SHIFTS DATA
-- =====================================================
INSERT INTO shifts (nama_shift, jam_masuk, toleransi_menit, deskripsi) VALUES
('Shift Pagi', '08:00:00', 0, 'Shift pagi untuk staff - masuk jam 08:00'),
('Shift Malam', '16:00:00', 0, 'Shift malam untuk staff - masuk jam 16:00');

-- =====================================================
-- 7. SEED HOLIDAYS DATA (Indonesian National Holidays)
-- =====================================================

-- FIXED DATE HOLIDAYS (Same date every year)
INSERT INTO holidays (nama_libur, holiday_type, bulan, hari, tipe, tahun_mulai, deskripsi) VALUES
-- National Holidays
('Tahun Baru Masehi', 'FIXED', 1, 1, 'NASIONAL', 2026, 'Tahun Baru 1 Januari'),
('Hari Buruh Internasional', 'FIXED', 5, 1, 'NASIONAL', 2026, 'May Day'),
('Hari Lahir Pancasila', 'FIXED', 6, 1, 'NASIONAL', 2026, 'Hari Kesaktian Pancasila'),
('Hari Kemerdekaan RI', 'FIXED', 8, 17, 'NASIONAL', 2026, 'HUT Kemerdekaan Indonesia'),
('Hari Raya Natal', 'FIXED', 12, 25, 'NASIONAL', 2026, 'Christmas Day');

-- LUNAR/HIJRI HOLIDAYS (Islamic Calendar - dates vary each year)
-- Note: These need to be calculated annually based on Hijri calendar
INSERT INTO holidays (nama_libur, holiday_type, hijri_month, hijri_day, tipe, tahun_mulai, deskripsi) VALUES
('Tahun Baru Islam', 'LUNAR', 1, 1, 'NASIONAL', 2026, '1 Muharram'),
('Maulid Nabi Muhammad SAW', 'LUNAR', 3, 12, 'NASIONAL', 2026, '12 Rabiul Awal'),
('Isra Miraj Nabi Muhammad SAW', 'LUNAR', 7, 27, 'NASIONAL', 2026, '27 Rajab'),
('Hari Raya Idul Fitri', 'LUNAR', 10, 1, 'NASIONAL', 2026, '1 Syawal'),
('Hari Raya Idul Fitri (Hari Kedua)', 'LUNAR', 10, 2, 'NASIONAL', 2026, '2 Syawal'),
('Hari Raya Idul Adha', 'LUNAR', 12, 10, 'NASIONAL', 2026, '10 Dzulhijjah');

-- FORMULA-BASED HOLIDAYS
INSERT INTO holidays (nama_libur, holiday_type, formula_code, tipe, tahun_mulai, deskripsi) VALUES
('Wafat Yesus Kristus', 'FORMULA', 'GOOD_FRIDAY', 'NASIONAL', 2026, 'Good Friday - Jumat sebelum Easter'),
('Kenaikan Yesus Kristus', 'FORMULA', 'ASCENSION', 'NASIONAL', 2026, '39 hari setelah Easter'),
('Hari Raya Nyepi', 'FORMULA', 'NYEPI', 'NASIONAL', 2026, 'Tahun Baru Saka (Bali)'),
('Hari Raya Waisak', 'FORMULA', 'VESAK', 'NASIONAL', 2026, 'Hari Raya Waisak');

-- =====================================================
-- 8. SEED HOLIDAY CACHE (Pre-calculate for 2026-2035)
-- =====================================================

-- Fixed holidays for 2026-2035 (will be auto-generated)
-- This is a sample for 2026, the rest should be generated by the cron job

-- 2026 Fixed Holidays
INSERT INTO holiday_cache (tanggal, nama_libur, tipe, tahun) VALUES
-- 2026
('2026-01-01', 'Tahun Baru Masehi', 'NASIONAL', 2026),
('2026-02-17', 'Isra Miraj Nabi Muhammad SAW', 'NASIONAL', 2026),
('2026-03-22', 'Hari Raya Nyepi (Tahun Baru Saka)', 'NASIONAL', 2026),
('2026-03-27', 'Wafat Yesus Kristus', 'NASIONAL', 2026),
('2026-03-31', 'Idul Fitri (perkiraan)', 'NASIONAL', 2026),
('2026-04-01', 'Idul Fitri Hari Kedua (perkiraan)', 'NASIONAL', 2026),
('2026-05-01', 'Hari Buruh Internasional', 'NASIONAL', 2026),
('2026-05-05', 'Kenaikan Yesus Kristus', 'NASIONAL', 2026),
('2026-05-21', 'Hari Raya Waisak', 'NASIONAL', 2026),
('2026-06-01', 'Hari Lahir Pancasila', 'NASIONAL', 2026),
('2026-06-07', 'Idul Adha (perkiraan)', 'NASIONAL', 2026),
('2026-06-27', 'Tahun Baru Islam 1448 H (perkiraan)', 'NASIONAL', 2026),
('2026-08-17', 'Hari Kemerdekaan Republik Indonesia', 'NASIONAL', 2026),
('2026-09-05', 'Maulid Nabi Muhammad SAW (perkiraan)', 'NASIONAL', 2026),
('2026-12-25', 'Hari Raya Natal', 'NASIONAL', 2026),

-- 2027 
('2027-01-01', 'Tahun Baru Masehi', 'NASIONAL', 2027),
('2027-05-01', 'Hari Buruh Internasional', 'NASIONAL', 2027),
('2027-06-01', 'Hari Lahir Pancasila', 'NASIONAL', 2027),
('2027-08-17', 'Hari Kemerdekaan Republik Indonesia', 'NASIONAL', 2027),
('2027-12-25', 'Hari Raya Natal', 'NASIONAL', 2027);

-- Note: Lunar calendar dates for 2027-2035 will be calculated by cron job

-- =====================================================
-- 9. MIGRATE EXISTING ATTENDANCE DATA TO EMPLOYEES
-- =====================================================
INSERT INTO employees (nip, nama, jabatan, status, is_active)
SELECT DISTINCT 
  nip, 
  nama, 
  CASE 
    WHEN jabatan = 'DOSEN' THEN 'DOSEN'
    WHEN jabatan = 'KARYAWAN' THEN 'KARYAWAN'
    ELSE 'KARYAWAN'
  END as jabatan,
  'AKTIF' as status,
  TRUE as is_active
FROM attendance
WHERE is_deleted = FALSE
  AND nip IS NOT NULL
  AND nama IS NOT NULL
ON DUPLICATE KEY UPDATE 
  nama = VALUES(nama),
  updated_at = CURRENT_TIMESTAMP;

-- =====================================================
-- 10. UPDATE EMPLOYEE SHIFT ASSIGNMENTS
-- =====================================================
-- By default, assign KARYAWAN to Shift Pagi
-- DOSEN will have NULL shift (flexible)
UPDATE employees 
SET shift_id = (SELECT id FROM shifts WHERE nama_shift = 'Shift Pagi' LIMIT 1)
WHERE jabatan = 'KARYAWAN' 
  AND shift_id IS NULL;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- Tables created: employees, shifts, holidays, holiday_cache
-- Seed data: 2 shifts, Indonesian national holidays
-- Migrated: Existing attendance data to employees table
-- Next steps:
-- 1. Run backend server to test models
-- 2. Implement HolidayService for cache generation
-- 3. Setup cron job for annual holiday cache update
-- =====================================================
