-- =====================================================
-- Backend Finger - FRESH INSTALL Schema
-- Version: 1.0.0 (Fixed)
-- Description: Create tables untuk fresh installation
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
-- 5. CREATE ATTENDANCE TABLE (ADDED FOR FRESH INSTALL)
-- =====================================================
CREATE TABLE IF NOT EXISTS attendance (
  id INT PRIMARY KEY AUTO_INCREMENT,
  nip VARCHAR(50) NOT NULL COMMENT 'Nomor Induk Pegawai',
  nama VARCHAR(255) NOT NULL COMMENT 'Nama pegawai',
  jabatan ENUM('DOSEN', 'KARYAWAN') NOT NULL COMMENT 'Jabatan',
  tanggal DATE NOT NULL COMMENT 'Tanggal absensi',
  jam_masuk TIME NULL COMMENT 'Waktu check-in',
  jam_keluar TIME NULL COMMENT 'Waktu check-out',
  status VARCHAR(50) DEFAULT 'HADIR' COMMENT 'Status kehadiran',
  keterangan TEXT COMMENT 'Catatan tambahan',
  is_deleted BOOLEAN DEFAULT FALSE COMMENT 'Soft delete flag',
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_nip (nip),
  INDEX idx_tanggal (tanggal),
  INDEX idx_is_deleted (is_deleted),
  INDEX idx_nip_tanggal (nip, tanggal)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Data absensi pegawai';

-- =====================================================
-- 6. CREATE DEVICES TABLE (ADMS Fingerprint Devices)
-- =====================================================
CREATE TABLE IF NOT EXISTS devices (
  id INT PRIMARY KEY AUTO_INCREMENT,
  device_name VARCHAR(100) NOT NULL COMMENT 'Nama device',
  device_id VARCHAR(100) UNIQUE NOT NULL COMMENT 'Device ID unik',
  location VARCHAR(255) COMMENT 'Lokasi device',
  api_key_hash VARCHAR(255) NOT NULL COMMENT 'Hashed API key',
  is_active BOOLEAN DEFAULT TRUE COMMENT 'Status aktif',
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_device_id (device_id),
  INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='ADMS fingerprint devices';

-- =====================================================
-- 7. CREATE ADMINS TABLE (Admin Users)
-- =====================================================
CREATE TABLE IF NOT EXISTS admins (
  id INT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(50) UNIQUE NOT NULL COMMENT 'Username admin',
  password_hash VARCHAR(255) NOT NULL COMMENT 'Hashed password',
  email VARCHAR(100) COMMENT 'Email admin',
  full_name VARCHAR(255) COMMENT 'Nama lengkap',
  role VARCHAR(50) DEFAULT 'ADMIN' COMMENT 'Role admin',
  is_active BOOLEAN DEFAULT TRUE COMMENT 'Status aktif',
  last_login TIMESTAMP NULL COMMENT 'Login terakhir',
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_username (username),
  INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Admin users';

-- =====================================================
-- 8. ADD FOREIGN KEY CONSTRAINTS
-- =====================================================
ALTER TABLE employees 
  ADD CONSTRAINT fk_employee_shift 
  FOREIGN KEY (shift_id) REFERENCES shifts(id) 
  ON DELETE SET NULL;

-- =====================================================
-- 9. SEED SHIFTS DATA
-- =====================================================
INSERT INTO shifts (nama_shift, jam_masuk, toleransi_menit, deskripsi) VALUES
('Shift Pagi', '08:00:00', 0, 'Shift pagi untuk staff - masuk jam 08:00'),
('Shift Malam', '16:00:00', 0, 'Shift malam untuk staff - masuk jam 16:00')
ON DUPLICATE KEY UPDATE nama_shift = VALUES(nama_shift);

-- =====================================================
-- 10. SEED HOLIDAYS DATA (Indonesian National Holidays)
-- =====================================================

-- FIXED DATE HOLIDAYS (Same date every year)
INSERT INTO holidays (nama_libur, holiday_type, bulan, hari, tipe, tahun_mulai, deskripsi) VALUES
-- National Holidays
('Tahun Baru Masehi', 'FIXED', 1, 1, 'NASIONAL', 2026, 'Tahun Baru 1 Januari'),
('Hari Buruh Internasional', 'FIXED', 5, 1, 'NASIONAL', 2026, 'May Day'),
('Hari Lahir Pancasila', 'FIXED', 6, 1, 'NASIONAL', 2026, 'Hari Kesaktian Pancasila'),
('Hari Kemerdekaan RI', 'FIXED', 8, 17, 'NASIONAL', 2026, 'HUT Kemerdekaan Indonesia'),
('Hari Raya Natal', 'FIXED', 12, 25, 'NASIONAL', 2026, 'Christmas Day')
ON DUPLICATE KEY UPDATE nama_libur = VALUES(nama_libur);

-- LUNAR/HIJRI HOLIDAYS (Islamic Calendar - dates vary each year)
INSERT INTO holidays (nama_libur, holiday_type, hijri_month, hijri_day, tipe, tahun_mulai, deskripsi) VALUES
('Tahun Baru Islam', 'LUNAR', 1, 1, 'NASIONAL', 2026, '1 Muharram'),
('Maulid Nabi Muhammad SAW', 'LUNAR', 3, 12, 'NASIONAL', 2026, '12 Rabiul Awal'),
('Isra Miraj Nabi Muhammad SAW', 'LUNAR', 7, 27, 'NASIONAL', 2026, '27 Rajab'),
('Hari Raya Idul Fitri', 'LUNAR', 10, 1, 'NASIONAL', 2026, '1 Syawal'),
('Hari Raya Idul Fitri (Hari Kedua)', 'LUNAR', 10, 2, 'NASIONAL', 2026, '2 Syawal'),
('Hari Raya Idul Adha', 'LUNAR', 12, 10, 'NASIONAL', 2026, '10 Dzulhijjah')
ON DUPLICATE KEY UPDATE nama_libur = VALUES(nama_libur);

-- FORMULA-BASED HOLIDAYS
INSERT INTO holidays (nama_libur, holiday_type, formula_code, tipe, tahun_mulai, deskripsi) VALUES
('Wafat Yesus Kristus', 'FORMULA', 'GOOD_FRIDAY', 'NASIONAL', 2026, 'Good Friday - Jumat sebelum Easter'),
('Kenaikan Yesus Kristus', 'FORMULA', 'ASCENSION', 'NASIONAL', 2026, '39 hari setelah Easter'),
('Hari Raya Nyepi', 'FORMULA', 'NYEPI', 'NASIONAL', 2026, 'Tahun Baru Saka (Bali)'),
('Hari Raya Waisak', 'FORMULA', 'VESAK', 'NASIONAL', 2026, 'Hari Raya Waisak')
ON DUPLICATE KEY UPDATE nama_libur = VALUES(nama_libur);

-- =====================================================
-- 11. SEED HOLIDAY CACHE (Pre-calculate for 2026-2027)
-- =====================================================

-- 2026 Holidays
INSERT INTO holiday_cache (tanggal, nama_libur, tipe, tahun) VALUES
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
('2027-12-25', 'Hari Raya Natal', 'NASIONAL', 2027)
ON DUPLICATE KEY UPDATE nama_libur = VALUES(nama_libur);

-- =====================================================
-- FRESH INSTALL COMPLETE
-- =====================================================
-- Tables created: 7 tables (employees, shifts, holidays, holiday_cache, attendance, devices, admins)
-- Seed data: 2 shifts, Indonesian national holidays, holiday cache for 2026-2027
-- Ready for application use!
-- =====================================================
