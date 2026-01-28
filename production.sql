-- =====================================================
-- FINGER ATTENDANCE SYSTEM - PRODUCTION SCHEMA
-- Version: 4.0.0 (Prisma Migration Ready)
-- Description: Clean production schema without sample data
-- =====================================================

-- =====================================================
-- IMPORTANT: Run this script on a FRESH MySQL instance
-- This script does NOT drop existing databases
-- To clean up first, use delete.sql
-- =====================================================

USE finger_db;

-- =====================================================
-- TABLE 1: EMPLOYEES
-- =====================================================
CREATE TABLE IF NOT EXISTS employees (
  id INT PRIMARY KEY AUTO_INCREMENT,
  nip VARCHAR(50) UNIQUE NOT NULL COMMENT 'Nomor Induk Pegawai (18 digits)',
  nama VARCHAR(255) NOT NULL COMMENT 'Nama lengkap pegawai',
  jabatan ENUM('DOSEN', 'KARYAWAN') NOT NULL COMMENT 'Jabatan pegawai',
  
  -- Shift assignment (for KARYAWAN only)
  shift_id INT NULL COMMENT 'NULL untuk DOSEN (flexible schedule)',
  
  -- Status
  status ENUM('AKTIF', 'CUTI', 'RESIGN', 'NON_AKTIF') DEFAULT 'AKTIF' COMMENT 'Status pegawai',
  tanggal_masuk DATE COMMENT 'Tanggal mulai bekerja',
  is_active BOOLEAN DEFAULT TRUE COMMENT 'Status aktif',
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Indexes for performance
  INDEX idx_nip (nip),
  INDEX idx_jabatan (jabatan),
  INDEX idx_shift (shift_id),
  INDEX idx_status (status),
  INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Master data pegawai (dosen dan karyawan)';

-- =====================================================
-- TABLE 2: SHIFTS
-- =====================================================
CREATE TABLE IF NOT EXISTS shifts (
  id INT PRIMARY KEY AUTO_INCREMENT,
  nama_shift VARCHAR(50) NOT NULL COMMENT 'Nama shift (e.g., Shift Pagi, Shift Sore)',
  jam_masuk TIME NOT NULL COMMENT 'Jam mulai shift',
  jam_keluar TIME NOT NULL COMMENT 'Jam selesai shift',
  deskripsi TEXT COMMENT 'Deskripsi shift',
  is_active BOOLEAN DEFAULT TRUE COMMENT 'Status aktif shift',
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Master data shift kerja untuk KARYAWAN';

-- =====================================================
-- TABLE 3: ATTENDANCE (OPTIMIZED)
-- =====================================================
CREATE TABLE IF NOT EXISTS attendance (
  id INT PRIMARY KEY AUTO_INCREMENT,
  
  -- Employee identification (denormalized for performance)
  user_id VARCHAR(50) NOT NULL COMMENT 'User ID (sama dengan NIP)',
  nip VARCHAR(50) NOT NULL COMMENT 'Nomor Induk Pegawai',
  nama VARCHAR(255) NOT NULL COMMENT 'Nama pegawai (denormalized)',
  jabatan ENUM('DOSEN', 'KARYAWAN') NOT NULL COMMENT 'Jabatan (denormalized)',
  
  -- Attendance data
  tanggal DATE NOT NULL COMMENT 'Tanggal absensi',
  jam_masuk TIME NULL COMMENT 'Waktu check-in pertama',
  jam_keluar TIME NULL COMMENT 'Waktu check-out terakhir',
  
  -- Device info
  device_id VARCHAR(100) NULL COMMENT 'ID device fingerprint',
  cloud_id VARCHAR(100) NULL COMMENT 'Cloud system identifier dari fingerprint device',
  verification_method VARCHAR(50) DEFAULT 'SIDIK_JARI' COMMENT 'Metode verifikasi (SIDIK_JARI, KARTU, WAJAH)',
  
  -- Status tracking (simplified)
  status VARCHAR(50) DEFAULT 'HADIR' COMMENT 'Status kehadiran (HADIR, TERLAMBAT)',
  
  -- Soft delete
  is_deleted BOOLEAN DEFAULT FALSE COMMENT 'Soft delete flag',
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Performance indexes
  INDEX idx_user_id (user_id),
  INDEX idx_nip (nip),
  INDEX idx_tanggal (tanggal),
  INDEX idx_jabatan (jabatan),
  INDEX idx_device_id (device_id),
  INDEX idx_cloud_id (cloud_id),
  INDEX idx_verification_method (verification_method),
  INDEX idx_status (status),
  INDEX idx_is_deleted (is_deleted),
  INDEX idx_nip_tanggal (nip, tanggal),
  INDEX idx_tanggal_jabatan (tanggal, jabatan)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Data absensi harian pegawai';

-- =====================================================
-- TABLE 4: DEVICES (FIXED)
-- =====================================================
CREATE TABLE IF NOT EXISTS devices (
  id INT PRIMARY KEY AUTO_INCREMENT,
  device_name VARCHAR(100) NOT NULL COMMENT 'Nama device (human-readable)',
  device_id VARCHAR(100) UNIQUE NOT NULL COMMENT 'Device ID unik (technical identifier)',
  ip_address VARCHAR(45) COMMENT 'IP address device (IPv4/IPv6)',
  location VARCHAR(255) COMMENT 'Lokasi fisik device',
  api_key_hash VARCHAR(255) COMMENT 'Hashed API key untuk autentikasi device',
  is_active BOOLEAN DEFAULT TRUE COMMENT 'Status aktif device',
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_device_id (device_id),
  INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='ADMS fingerprint devices registry';

-- =====================================================
-- TABLE 5: ADMINS
-- =====================================================
CREATE TABLE IF NOT EXISTS admins (
  id INT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(50) UNIQUE NOT NULL COMMENT 'Username admin (deprecated, use email)',
  password_hash VARCHAR(255) NOT NULL COMMENT 'Hashed password (bcrypt)',
  email VARCHAR(100) UNIQUE NOT NULL COMMENT 'Email admin (primary login)',
  full_name VARCHAR(255) COMMENT 'Nama lengkap admin',
  role VARCHAR(50) DEFAULT 'ADMIN' COMMENT 'Role admin',
  is_active BOOLEAN DEFAULT TRUE COMMENT 'Status aktif',
  last_login TIMESTAMP NULL COMMENT 'Login terakhir',
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_username (username),
  INDEX idx_email (email),
  INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Admin users untuk autentikasi sistem';

-- =====================================================
-- TABLE 6: PASSWORD_RESETS
-- =====================================================
CREATE TABLE IF NOT EXISTS password_resets (
  id INT PRIMARY KEY AUTO_INCREMENT,
  admin_id INT NOT NULL,
  email VARCHAR(255) NOT NULL,
  code VARCHAR(6) NOT NULL COMMENT '6-digit verification code',
  reset_token VARCHAR(255) DEFAULT NULL COMMENT 'Temporary token setelah verifikasi code',
  expires_at DATETIME NOT NULL COMMENT 'Code expiration time (15 menit)',
  used_at DATETIME DEFAULT NULL COMMENT 'Timestamp saat digunakan',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_admin_id (admin_id),
  INDEX idx_email (email),
  INDEX idx_code (code),
  INDEX idx_reset_token (reset_token),
  INDEX idx_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Password reset tokens dan verification codes';

-- =====================================================
-- FOREIGN KEY CONSTRAINTS
-- =====================================================
ALTER TABLE employees 
  ADD CONSTRAINT fk_employee_shift 
  FOREIGN KEY (shift_id) REFERENCES shifts(id) 
  ON DELETE SET NULL;

ALTER TABLE password_resets
  ADD CONSTRAINT fk_password_resets_admin 
  FOREIGN KEY (admin_id) REFERENCES admins(id) 
  ON DELETE CASCADE;

-- =====================================================
-- SEED DEFAULT DATA
-- =====================================================

-- Default Shifts
INSERT INTO shifts (nama_shift, jam_masuk, jam_keluar, deskripsi, is_active) VALUES
('Shift Pagi', '08:00:00', '15:00:00', 'Shift pagi untuk karyawan - 08:00 s/d 15:00', 1),
('Shift Sore', '16:00:00', '21:00:00', 'Shift sore untuk karyawan - 16:00 s/d 21:00', 1)
ON DUPLICATE KEY UPDATE nama_shift = VALUES(nama_shift);

-- Default Admin User
-- Email: admin@kampus.ac.id
-- Password: Admin123 (hash generated with bcrypt rounds=12)
INSERT INTO admins (username, email, password_hash, full_name, role, is_active) VALUES
('admin', 'admin@kampus.ac.id', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYzpLaEg9KK', 'System Administrator', 'ADMIN', 1)
ON DUPLICATE KEY UPDATE email = VALUES(email);

-- =====================================================
-- PRODUCTION SCHEMA COMPLETE
-- =====================================================
SELECT '✅ Production schema created successfully!' AS Status;
SELECT '📊 6 Tables: employees, shifts, attendance, devices, admins, password_resets' AS Tables;
SELECT '� Default Admin: admin@kampus.ac.id / Admin123' AS Credentials;
SELECT '� Weekend: Sunday ONLY (no holiday logic)' AS Weekend;
SELECT '🚀 Ready for Prisma migration!' AS NextStep;

-- =====================================================
-- PRODUCTION SCHEMA INFO
-- =====================================================
-- ✅ No DROP DATABASE (safe for existing data)
-- ✅ 6 Tables created with optimized indexes
-- ✅ Foreign keys configured
-- ✅ 2 default shifts seeded
-- ✅ Default admin account created
-- ✅ No email/phone in employees table
-- ✅ No keterangan in attendance table
-- ✅ Device table has device_name and api_key_hash
-- ✅ Status field: HADIR / TERLAMBAT only
-- ✅ No holiday tables (weekends only)
-- 
-- USAGE:
-- mysql -u root -p < production.sql
-- 
-- For sample data, run: dummy.sql
-- To clean database, run: delete.sql first
-- =====================================================
