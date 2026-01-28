-- =====================================================
-- FINGER ATTENDANCE SYSTEM - DUMMY DATA
-- Version: 1.0.0
-- Description: Sample data untuk testing (Dosen & Karyawan)
-- =====================================================

-- =====================================================
-- PENTING: Jalankan production.sql terlebih dahulu!
-- Script ini hanya menambahkan sample data
-- =====================================================

USE finger_db;

-- =====================================================
-- SAMPLE EMPLOYEES: 5 DOSEN + 5 KARYAWAN
-- =====================================================

-- 5 Dosen (NIP 18 digit - Standard PNS Indonesia)
INSERT INTO employees (nip, nama, jabatan, shift_id, status, tanggal_masuk, is_active) VALUES
('198805121234561001', 'Dr. Ahmad Hidayat, M.Kom', 'DOSEN', NULL, 'AKTIF', '2020-01-15', 1),
('198206151234572001', 'Dr. Siti Nurhaliza, M.T', 'DOSEN', NULL, 'AKTIF', '2019-08-01', 1),
('197503101234581001', 'Prof. Budi Santoso, Ph.D', 'DOSEN', NULL, 'AKTIF', '2018-03-10', 1),
('198902201234592001', 'Dr. Dewi Lestari, M.Pd', 'DOSEN', NULL, 'AKTIF', '2021-02-20', 1),
('198709011234601001', 'Dr. Eko Prasetyo, M.Si', 'DOSEN', NULL, 'AKTIF', '2020-09-01', 1);

-- 5 Karyawan (NIP 18 digit - Standard PNS Indonesia)
INSERT INTO employees (nip, nama, jabatan, shift_id, status, tanggal_masuk, is_active) VALUES
('199205101234612001', 'Rina Kusuma', 'KARYAWAN', 1, 'AKTIF', '2019-05-10', 1),
('199107151234621001', 'Andi Wijaya', 'KARYAWAN', 1, 'AKTIF', '2020-07-15', 1),
('199401051234632001', 'Maya Sari', 'KARYAWAN', 2, 'AKTIF', '2021-01-05', 1),
('199803251234641001', 'Budi Hartono', 'KARYAWAN', 1, 'AKTIF', '2019-03-25', 1),
('199512101234652001', 'Lina Wati', 'KARYAWAN', 1, 'AKTIF', '2020-12-10', 1);

-- =====================================================
-- SAMPLE DEVICE
-- =====================================================
INSERT INTO devices (device_id, device_name, ip_address, location, api_key_hash, is_active) VALUES
('FP-GEDUNG-A-001', 'ADMS Fingerprint - Gedung A Lantai 1', '192.168.1.100', 'Gedung A Lt.1 (Lobby Utama)', '$2b$10$abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJK', 1),
('FP-GEDUNG-B-001', 'ADMS Fingerprint - Gedung B Lantai 2', '192.168.1.101', 'Gedung B Lt.2 (Ruang Dosen)', '$2b$10$1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJK', 1);

-- =====================================================
-- SAMPLE ATTENDANCE DATA
-- Periode: 7 hari terakhir (termasuk hari ini)
-- =====================================================

-- Helper: Generate dates for last 7 days
SET @today = CURDATE();
SET @day1 = DATE_SUB(@today, INTERVAL 6 DAY);
SET @day2 = DATE_SUB(@today, INTERVAL 5 DAY);
SET @day3 = DATE_SUB(@today, INTERVAL 4 DAY);
SET @day4 = DATE_SUB(@today, INTERVAL 3 DAY);
SET @day5 = DATE_SUB(@today, INTERVAL 2 DAY);
SET @day6 = DATE_SUB(@today, INTERVAL 1 DAY);
SET @day7 = @today;

-- =====================================================
-- DOSEN ATTENDANCE (Flexible schedule - no late tracking)
-- =====================================================

-- Dr. Ahmad Hidayat (7 hari lengkap)
INSERT INTO attendance (user_id, nip, nama, jabatan, tanggal, jam_masuk, jam_keluar, device_id, verification_method, status, is_deleted) VALUES
('198805121234561001', '198805121234561001', 'Dr. Ahmad Hidayat, M.Kom', 'DOSEN', @day1, '08:15:00', '16:30:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('198805121234561001', '198805121234561001', 'Dr. Ahmad Hidayat, M.Kom', 'DOSEN', @day2, '08:20:00', '16:25:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('198805121234561001', '198805121234561001', 'Dr. Ahmad Hidayat, M.Kom', 'DOSEN', @day3, '08:10:00', '17:00:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('198805121234561001', '198805121234561001', 'Dr. Ahmad Hidayat, M.Kom', 'DOSEN', @day4, '08:05:00', '16:15:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('198805121234561001', '198805121234561001', 'Dr. Ahmad Hidayat, M.Kom', 'DOSEN', @day5, '08:12:00', '16:45:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('198805121234561001', '198805121234561001', 'Dr. Ahmad Hidayat, M.Kom', 'DOSEN', @day6, '08:18:00', '16:20:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('198805121234561001', '198805121234561001', 'Dr. Ahmad Hidayat, M.Kom', 'DOSEN', @day7, '08:08:00', NULL, 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0);

-- Dr. Siti Nurhaliza (6 hari - 1 hari tidak hadir)
INSERT INTO attendance (user_id, nip, nama, jabatan, tanggal, jam_masuk, jam_keluar, device_id, verification_method, status, is_deleted) VALUES
('198206151234572001', '198206151234572001', 'Dr. Siti Nurhaliza, M.T', 'DOSEN', @day1, '07:55:00', '16:10:00', 'FP-GEDUNG-B-001', 'SIDIK_JARI', 'HADIR', 0),
('198206151234572001', '198206151234572001', 'Dr. Siti Nurhaliza, M.T', 'DOSEN', @day2, '08:00:00', '16:15:00', 'FP-GEDUNG-B-001', 'SIDIK_JARI', 'HADIR', 0),
-- Day 3: No attendance
('198206151234572001', '198206151234572001', 'Dr. Siti Nurhaliza, M.T', 'DOSEN', @day4, '08:10:00', '16:30:00', 'FP-GEDUNG-B-001', 'SIDIK_JARI', 'HADIR', 0),
('198206151234572001', '198206151234572001', 'Dr. Siti Nurhaliza, M.T', 'DOSEN', @day5, '08:05:00', '16:40:00', 'FP-GEDUNG-B-001', 'SIDIK_JARI', 'HADIR', 0),
('198206151234572001', '198206151234572001', 'Dr. Siti Nurhaliza, M.T', 'DOSEN', @day6, '08:15:00', '16:25:00', 'FP-GEDUNG-B-001', 'SIDIK_JARI', 'HADIR', 0),
('198206151234572001', '198206151234572001', 'Dr. Siti Nurhaliza, M.T', 'DOSEN', @day7, '08:12:00', NULL, 'FP-GEDUNG-B-001', 'SIDIK_JARI', 'HADIR', 0);

-- Prof. Budi Santoso (7 hari lengkap)
INSERT INTO attendance (user_id, nip, nama, jabatan, tanggal, jam_masuk, jam_keluar, device_id, verification_method, status, is_deleted) VALUES
('197503101234581001', '197503101234581001', 'Prof. Budi Santoso, Ph.D', 'DOSEN', @day1, '07:50:00', '16:05:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('197503101234581001', '197503101234581001', 'Prof. Budi Santoso, Ph.D', 'DOSEN', @day2, '07:55:00', '16:10:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('197503101234581001', '197503101234581001', 'Prof. Budi Santoso, Ph.D', 'DOSEN', @day3, '08:00:00', '16:20:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('197503101234581001', '197503101234581001', 'Prof. Budi Santoso, Ph.D', 'DOSEN', @day4, '07:58:00', '16:15:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('197503101234581001', '197503101234581001', 'Prof. Budi Santoso, Ph.D', 'DOSEN', @day5, '08:02:00', '16:25:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('197503101234581001', '197503101234581001', 'Prof. Budi Santoso, Ph.D', 'DOSEN', @day6, '08:05:00', '16:18:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('197503101234581001', '197503101234581001', 'Prof. Budi Santoso, Ph.D', 'DOSEN', @day7, '08:03:00', NULL, 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0);

-- Dr. Dewi Lestari (5 hari - 2 hari tidak hadir)
INSERT INTO attendance (user_id, nip, nama, jabatan, tanggal, jam_masuk, jam_keluar, device_id, verification_method, status, is_deleted) VALUES
('198902201234592001', '198902201234592001', 'Dr. Dewi Lestari, M.Pd', 'DOSEN', @day1, '08:10:00', '16:30:00', 'FP-GEDUNG-B-001', 'SIDIK_JARI', 'HADIR', 0),
('198902201234592001', '198902201234592001', 'Dr. Dewi Lestari, M.Pd', 'DOSEN', @day2, '08:15:00', '16:35:00', 'FP-GEDUNG-B-001', 'SIDIK_JARI', 'HADIR', 0),
-- Day 3-4: No attendance
('198902201234592001', '198902201234592001', 'Dr. Dewi Lestari, M.Pd', 'DOSEN', @day5, '08:20:00', '16:40:00', 'FP-GEDUNG-B-001', 'SIDIK_JARI', 'HADIR', 0),
('198902201234592001', '198902201234592001', 'Dr. Dewi Lestari, M.Pd', 'DOSEN', @day6, '08:12:00', '16:28:00', 'FP-GEDUNG-B-001', 'SIDIK_JARI', 'HADIR', 0),
('198902201234592001', '198902201234592001', 'Dr. Dewi Lestari, M.Pd', 'DOSEN', @day7, '08:18:00', NULL, 'FP-GEDUNG-B-001', 'SIDIK_JARI', 'HADIR', 0);

-- Dr. Eko Prasetyo (6 hari)
INSERT INTO attendance (user_id, nip, nama, jabatan, tanggal, jam_masuk, jam_keluar, device_id, verification_method, status, is_deleted) VALUES
('198709011234601001', '198709011234601001', 'Dr. Eko Prasetyo, M.Si', 'DOSEN', @day1, '08:08:00', '16:22:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('198709011234601001', '198709011234601001', 'Dr. Eko Prasetyo, M.Si', 'DOSEN', @day2, '08:12:00', '16:18:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('198709011234601001', '198709011234601001', 'Dr. Eko Prasetyo, M.Si', 'DOSEN', @day3, '08:15:00', '16:35:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
-- Day 4: No attendance
('198709011234601001', '198709011234601001', 'Dr. Eko Prasetyo, M.Si', 'DOSEN', @day5, '08:10:00', '16:25:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('198709011234601001', '198709011234601001', 'Dr. Eko Prasetyo, M.Si', 'DOSEN', @day6, '08:20:00', '16:30:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('198709011234601001', '198709011234601001', 'Dr. Eko Prasetyo, M.Si', 'DOSEN', @day7, '08:05:00', NULL, 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0);

-- =====================================================
-- KARYAWAN ATTENDANCE (Shift-based with TERLAMBAT tracking)
-- Shift Pagi: 08:00, toleransi 0 menit
-- Shift Malam: 15:00, toleransi 0 menit
-- =====================================================

-- Rina Kusuma (Shift Pagi - 3 kali terlambat)
INSERT INTO attendance (user_id, nip, nama, jabatan, tanggal, jam_masuk, jam_keluar, device_id, verification_method, status, is_deleted) VALUES
('199205101234612001', '199205101234612001', 'Rina Kusuma', 'KARYAWAN', @day1, '07:58:00', '16:05:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('199205101234612001', '199205101234612001', 'Rina Kusuma', 'KARYAWAN', @day2, '08:15:00', '16:12:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'TERLAMBAT', 0),
('199205101234612001', '199205101234612001', 'Rina Kusuma', 'KARYAWAN', @day3, '08:00:00', '16:08:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'TERLAMBAT', 0),
('199205101234612001', '199205101234612001', 'Rina Kusuma', 'KARYAWAN', @day4, '07:55:00', '16:00:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('199205101234612001', '199205101234612001', 'Rina Kusuma', 'KARYAWAN', @day5, '08:10:00', '16:15:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'TERLAMBAT', 0),
('199205101234612001', '199205101234612001', 'Rina Kusuma', 'KARYAWAN', @day6, '07:59:00', '16:02:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('199205101234612001', '199205101234612001', 'Rina Kusuma', 'KARYAWAN', @day7, '07:57:00', NULL, 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0);

-- Andi Wijaya (Shift Pagi - 3 kali terlambat)
INSERT INTO attendance (user_id, nip, nama, jabatan, tanggal, jam_masuk, jam_keluar, device_id, verification_method, status, is_deleted) VALUES
('199107151234621001', '199107151234621001', 'Andi Wijaya', 'KARYAWAN', @day1, '08:00:00', '16:10:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'TERLAMBAT', 0),
('199107151234621001', '199107151234621001', 'Andi Wijaya', 'KARYAWAN', @day2, '08:05:00', '16:15:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'TERLAMBAT', 0),
('199107151234621001', '199107151234621001', 'Andi Wijaya', 'KARYAWAN', @day3, '07:58:00', '16:08:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('199107151234621001', '199107151234621001', 'Andi Wijaya', 'KARYAWAN', @day4, '07:55:00', '16:00:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('199107151234621001', '199107151234621001', 'Andi Wijaya', 'KARYAWAN', @day5, '08:00:00', '16:12:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'TERLAMBAT', 0),
('199107151234621001', '199107151234621001', 'Andi Wijaya', 'KARYAWAN', @day6, '07:59:00', '16:05:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('199107151234621001', '199107151234621001', 'Andi Wijaya', 'KARYAWAN', @day7, '08:02:00', NULL, 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'TERLAMBAT', 0);

-- Maya Sari (Shift Sore - 16:00)
INSERT INTO attendance (user_id, nip, nama, jabatan, tanggal, jam_masuk, jam_keluar, device_id, verification_method, status, is_deleted) VALUES
('199401051234632001', '199401051234632001', 'Maya Sari', 'KARYAWAN', @day1, '15:58:00', '21:05:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('199401051234632001', '199401051234632001', 'Maya Sari', 'KARYAWAN', @day2, '15:55:00', '21:00:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('199401051234632001', '199401051234632001', 'Maya Sari', 'KARYAWAN', @day3, '16:00:00', '21:10:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'TERLAMBAT', 0),
('199401051234632001', '199401051234632001', 'Maya Sari', 'KARYAWAN', @day4, '15:59:00', '21:02:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('199401051234632001', '199401051234632001', 'Maya Sari', 'KARYAWAN', @day5, '16:05:00', '21:08:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'TERLAMBAT', 0),
('199401051234632001', '199401051234632001', 'Maya Sari', 'KARYAWAN', @day6, '15:57:00', '21:15:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('199401051234632001', '199401051234632001', 'Maya Sari', 'KARYAWAN', @day7, '15:58:00', NULL, 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0);

-- Budi Hartono (Shift Pagi - 5 kali terlambat)
INSERT INTO attendance (user_id, nip, nama, jabatan, tanggal, jam_masuk, jam_keluar, device_id, verification_method, status, is_deleted) VALUES
('199803251234641001', '199803251234641001', 'Budi Hartono', 'KARYAWAN', @day1, '08:05:00', '16:10:00', 'FP-GEDUNG-B-001', 'SIDIK_JARI', 'TERLAMBAT', 0),
('199803251234641001', '199803251234641001', 'Budi Hartono', 'KARYAWAN', @day2, '08:20:00', '16:25:00', 'FP-GEDUNG-B-001', 'SIDIK_JARI', 'TERLAMBAT', 0),
('199803251234641001', '199803251234641001', 'Budi Hartono', 'KARYAWAN', @day3, '08:00:00', '16:05:00', 'FP-GEDUNG-B-001', 'SIDIK_JARI', 'TERLAMBAT', 0),
('199803251234641001', '199803251234641001', 'Budi Hartono', 'KARYAWAN', @day4, '07:58:00', '16:00:00', 'FP-GEDUNG-B-001', 'SIDIK_JARI', 'HADIR', 0),
('199803251234641001', '199803251234641001', 'Budi Hartono', 'KARYAWAN', @day5, '08:15:00', '16:12:00', 'FP-GEDUNG-B-001', 'SIDIK_JARI', 'TERLAMBAT', 0),
('199803251234641001', '199803251234641001', 'Budi Hartono', 'KARYAWAN', @day6, '08:00:00', '16:08:00', 'FP-GEDUNG-B-001', 'SIDIK_JARI', 'TERLAMBAT', 0),
('199803251234641001', '199803251234641001', 'Budi Hartono', 'KARYAWAN', @day7, '08:01:00', NULL, 'FP-GEDUNG-B-001', 'SIDIK_JARI', 'TERLAMBAT', 0);

-- Lina Wati (Shift Pagi - 1 hari tidak hadir)
INSERT INTO attendance (user_id, nip, nama, jabatan, tanggal, jam_masuk, jam_keluar, device_id, verification_method, status, is_deleted) VALUES
('199512101234652001', '199512101234652001', 'Lina Wati', 'KARYAWAN', @day1, '07:58:00', '16:02:00', 'FP-GEDUNG-B-001', 'SIDIK_JARI', 'HADIR', 0),
('199512101234652001', '199512101234652001', 'Lina Wati', 'KARYAWAN', @day2, '08:00:00', '16:05:00', 'FP-GEDUNG-B-001', 'SIDIK_JARI', 'HADIR', 0),
('199512101234652001', '199512101234652001', 'Lina Wati', 'KARYAWAN', @day3, '07:59:00', '16:10:00', 'FP-GEDUNG-B-001', 'SIDIK_JARI', 'HADIR', 0),
-- Day 4: No attendance
('199512101234652001', '199512101234652001', 'Lina Wati', 'KARYAWAN', @day5, '08:00:00', '16:00:00', 'FP-GEDUNG-B-001', 'SIDIK_JARI', 'HADIR', 0),
('199512101234652001', '199512101234652001', 'Lina Wati', 'KARYAWAN', @day6, '07:57:00', '16:08:00', 'FP-GEDUNG-B-001', 'SIDIK_JARI', 'HADIR', 0),
('199512101234652001', '199512101234652001', 'Lina Wati', 'KARYAWAN', @day7, '08:00:00', NULL, 'FP-GEDUNG-B-001', 'SIDIK_JARI', 'HADIR', 0);

-- =====================================================
-- DUMMY DATA SUMMARY
-- =====================================================
SELECT '✅ Sample data inserted successfully!' AS Status;
SELECT '👥 Employees: 5 Dosen + 5 Karyawan' AS Employees;
SELECT '📅 Attendance: 7 hari terakhir (including today)' AS Period;
SELECT '🔍 Device: 2 fingerprint devices' AS Devices;
SELECT '📊 DOSEN: Status selalu HADIR (flexible schedule)' AS DosenRule;
SELECT '📊 KARYAWAN: Status HADIR/TERLAMBAT (based on shift)' AS KaryawanRule;

-- =====================================================
-- DATA STATISTICS
-- =====================================================
-- Total Employees: 10 (5 Dosen + 5 Karyawan)
-- Total Attendance Records: ~63 records
-- Date Range: Last 7 days
-- 
-- DOSEN Attendance:
-- - Dr. Ahmad: 7/7 days (100%)
-- - Dr. Siti: 6/7 days (85%)
-- - Prof. Budi: 7/7 days (100%)
-- - Dr. Dewi: 5/7 days (71%)
-- - Dr. Eko: 6/7 days (85%)
--
-- KARYAWAN Attendance:
-- - Rina (Shift Pagi): 7/7 days, 2 terlambat
-- - Andi (Shift Pagi): 7/7 days, 1 terlambat
-- - Maya (Shift Malam): 7/7 days, 0 terlambat
-- - Budi (Shift Pagi): 7/7 days, 3 terlambat
-- - Lina (Shift Pagi): 6/7 days, 0 terlambat
-- =====================================================
