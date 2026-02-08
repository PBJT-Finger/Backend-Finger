-- =====================================================
-- FINGER ATTENDANCE SYSTEM - CONSOLIDATED SEED DATA
-- Version: 2.0.0
-- Description: Complete seed data with daily, weekly, and monthly attendance
-- =====================================================

USE finger_db;

-- =====================================================
-- CLEAN UP EXISTING DATA
-- =====================================================
-- Delete existing test data first to avoid duplicate key errors
DELETE FROM attendance WHERE tanggal BETWEEN '2026-01-03' AND '2026-02-04';
DELETE FROM employees WHERE nip IN (
    '198805121234561001', '198206151234572001', '197512251234583001',
    '199001101234594001', '198703051234605001', '198405151234616001',
    '198801152000121001', '199205202000132001', '198710182000143001',
    '199108252000154001', '198903102000165001'
);
DELETE FROM devices WHERE device_id IN ('FP-GEDUNG-A-001', 'FP-GEDUNG-B-001');

-- =====================================================
-- SAMPLE EMPLOYEES: 6 DOSEN + 5 KARYAWAN
-- =====================================================

-- 6 Dosen (NIP 18 digit - Standard PNS Indonesia)
INSERT INTO employees (nip, nama, jabatan, shift_id, status, tanggal_masuk, is_active) VALUES
('198805121234561001', 'Dr. Ahmad Hidayat, M.Kom', 'DOSEN', NULL, 'AKTIF', '2020-01-15', 1),
('198206151234572001', 'Dr. Siti Nurhaliza, M.T', 'DOSEN', NULL, 'AKTIF', '2019-08-01', 1),
('197512251234583001', 'Prof. Budi Santoso, Ph.D', 'DOSEN', NULL, 'AKTIF', '2018-03-10', 1),
('199001101234594001', 'Dr. Dewi Lestari, S.Kom, M.T', 'DOSEN', NULL, 'AKTIF', '2021-02-20', 1),
('198703051234605001', 'Dr. Rina Wijaya, M.Sc', 'DOSEN', NULL, 'AKTIF', '2020-05-15', 1),
('198405151234616001', 'Dr. Hendra Gunawan, M.M', 'DOSEN', NULL, 'AKTIF', '2019-09-01', 1);

-- 5 Karyawan (NIP 18 digit - Standard PNS Indonesia)
INSERT INTO employees (nip, nama, jabatan, shift_id, status, tanggal_masuk, is_active) VALUES
('198801152000121001', 'Andi Wijaya', 'KARYAWAN', 1, 'AKTIF', '2019-05-10', 1),
('199205202000132001', 'Sri Rahayu', 'KARYAWAN', 1, 'AKTIF', '2020-07-15', 1),
('198710182000143001', 'Budi Santoso', 'KARYAWAN', 1, 'AKTIF', '2021-01-05', 1),
('199108252000154001', 'Dewi Kusuma', 'KARYAWAN', 1, 'AKTIF', '2019-03-25', 1),
('198903102000165001', 'Agus Permana', 'KARYAWAN', 1, 'AKTIF', '2020-12-10', 1);

-- =====================================================
-- SAMPLE DEVICES
-- =====================================================
INSERT INTO devices (device_id, device_name, ip_address, location, api_key_hash, is_active) VALUES
('FP-GEDUNG-A-001', 'ADMS Fingerprint - Gedung A Lantai 1', '192.168.1.100', 'Gedung A Lt.1 (Lobby Utama)', '$2b$10$abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJK', 1),
('FP-GEDUNG-B-001', 'ADMS Fingerprint - Gedung B Lantai 2', '192.168.1.101', 'Gedung B Lt.2 (Ruang Dosen)', '$2b$10$1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJK', 1);

-- =====================================================
-- ATTENDANCE DATA - 1 MONTH (Jan 3 - Feb 4, 2026)
-- Realistic attendance with varied patterns
-- =====================================================

-- ==================== WEEK 1: Jan 3-9, 2026 ====================

-- Friday Jan 3 - Start of year
INSERT INTO attendance (user_id, nip, nama, jabatan, tanggal, jam_masuk, jam_keluar, device_id, verification_method, status, is_deleted) VALUES
('198805121234561001', '198805121234561001', 'Dr. Ahmad Hidayat, M.Kom', 'DOSEN', '2026-01-03', '08:10:00', '16:25:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('197512251234583001', '197512251234583001', 'Prof. Budi Santoso, Ph.D', 'DOSEN', '2026-01-03', '07:55:00', '17:05:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('198801152000121001', '198801152000121001', 'Andi Wijaya', 'KARYAWAN', '2026-01-03', '07:50:00', '16:10:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('199205202000132001', '199205202000132001', 'Sri Rahayu', 'KARYAWAN', '2026-01-03', '08:05:00', '16:15:00', 'FP-GEDUNG-B-001', 'SIDIK_JARI', 'HADIR', 0);

-- Monday Jan 6
INSERT INTO attendance (user_id, nip, nama, jabatan, tanggal, jam_masuk, jam_keluar, device_id, verification_method, status, is_deleted) VALUES
('198805121234561001', '198805121234561001', 'Dr. Ahmad Hidayat, M.Kom', 'DOSEN', '2026-01-06', '08:05:00', '16:30:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('198206151234572001', '198206151234572001', 'Dr. Siti Nurhaliza, M.T', 'DOSEN', '2026-01-06', '08:10:00', '16:20:00', 'FP-GEDUNG-B-001', 'SIDIK_JARI', 'HADIR', 0),
('197512251234583001', '197512251234583001', 'Prof. Budi Santoso, Ph.D', 'DOSEN', '2026-01-06', '08:00:00', '17:10:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('199001101234594001', '199001101234594001', 'Dr. Dewi Lestari, S.Kom, M.T', 'DOSEN', '2026-01-06', '08:15:00', '16:45:00', 'FP-GEDUNG-B-001', 'SIDIK_JARI', 'HADIR', 0),
('198801152000121001', '198801152000121001', 'Andi Wijaya', 'KARYAWAN', '2026-01-06', '07:55:00', '16:05:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('199205202000132001', '199205202000132001', 'Sri Rahayu', 'KARYAWAN', '2026-01-06', '08:00:00', '16:10:00', 'FP-GEDUNG-B-001', 'SIDIK_JARI', 'HADIR', 0),
('198710182000143001', '198710182000143001', 'Budi Santoso', 'KARYAWAN', '2026-01-06', '07:50:00', '16:15:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('198903102000165001', '198903102000165001', 'Agus Permana', 'KARYAWAN', '2026-01-06', '08:20:00', '16:25:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0);

-- Tuesday Jan 7
INSERT INTO attendance (user_id, nip, nama, jabatan, tanggal, jam_masuk, jam_keluar, device_id, verification_method, status, is_deleted) VALUES
('198805121234561001', '198805121234561001', 'Dr. Ahmad Hidayat, M.Kom', 'DOSEN', '2026-01-07', '08:15:00', '16:35:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('198206151234572001', '198206151234572001', 'Dr. Siti Nurhaliza, M.T', 'DOSEN', '2026-01-07', '08:05:00', '16:25:00', 'FP-GEDUNG-B-001', 'SIDIK_JARI', 'HADIR', 0),
('197512251234583001', '197512251234583001', 'Prof. Budi Santoso, Ph.D', 'DOSEN', '2026-01-07', '07:50:00', '17:00:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('199001101234594001', '199001101234594001', 'Dr. Dewi Lestari, S.Kom, M.T', 'DOSEN', '2026-01-07', '08:10:00', NULL, 'FP-GEDUNG-B-001', 'SIDIK_JARI', 'HADIR', 0),
('198801152000121001', '198801152000121001', 'Andi Wijaya', 'KARYAWAN', '2026-01-07', '07:45:00', '16:00:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('199205202000132001', '199205202000132001', 'Sri Rahayu', 'KARYAWAN', '2026-01-07', '08:05:00', '16:15:00', 'FP-GEDUNG-B-001', 'SIDIK_JARI', 'HADIR', 0),
('198710182000143001', '198710182000143001', 'Budi Santoso', 'KARYAWAN', '2026-01-07', '07:55:00', '16:10:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('199108252000154001', '199108252000154001', 'Dewi Kusuma', 'KARYAWAN', '2026-01-07', '08:10:00', '16:20:00', 'FP-GEDUNG-B-001', 'SIDIK_JARI', 'HADIR', 0);

-- Wednesday Jan 8
INSERT INTO attendance (user_id, nip, nama, jabatan, tanggal, jam_masuk, jam_keluar, device_id, verification_method, status, is_deleted) VALUES
('198805121234561001', '198805121234561001', 'Dr. Ahmad Hidayat, M.Kom', 'DOSEN', '2026-01-08', '08:00:00', '16:30:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('198206151234572001', '198206151234572001', 'Dr. Siti Nurhaliza, M.T', 'DOSEN', '2026-01-08', '08:10:00', '16:20:00', 'FP-GEDUNG-B-001', 'SIDIK_JARI', 'HADIR', 0),
('197512251234583001', '197512251234583001', 'Prof. Budi Santoso, Ph.D', 'DOSEN', '2026-01-08', '07:55:00', '17:05:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('198703051234605001', '198703051234605001', 'Dr. Rina Wijaya, M.Sc', 'DOSEN', '2026-01-08', '08:15:00', '16:35:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('198801152000121001', '198801152000121001', 'Andi Wijaya', 'KARYAWAN', '2026-01-08', '07:50:00', '16:05:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('199205202000132001', '199205202000132001', 'Sri Rahayu', 'KARYAWAN', '2026-01-08', '08:00:00', '16:10:00', 'FP-GEDUNG-B-001', 'SIDIK_JARI', 'HADIR', 0),
('198710182000143001', '198710182000143001', 'Budi Santoso', 'KARYAWAN', '2026-01-08', '07:55:00', '16:15:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0);

-- Thursday Jan 9
INSERT INTO attendance (user_id, nip, nama, jabatan, tanggal, jam_masuk, jam_keluar, device_id, verification_method, status, is_deleted) VALUES
('198206151234572001', '198206151234572001', 'Dr. Siti Nurhaliza, M.T', 'DOSEN', '2026-01-09', '08:05:00', '16:25:00', 'FP-GEDUNG-B-001', 'SIDIK_JARI', 'HADIR', 0),
('197512251234583001', '197512251234583001', 'Prof. Budi Santoso, Ph.D', 'DOSEN', '2026-01-09', '08:00:00', '17:00:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('199001101234594001', '199001101234594001', 'Dr. Dewi Lestari, S.Kom, M.T', 'DOSEN', '2026-01-09', '08:10:00', '16:40:00', 'FP-GEDUNG-B-001', 'SIDIK_JARI', 'HADIR', 0),
('198703051234605001', '198703051234605001', 'Dr. Rina Wijaya, M.Sc', 'DOSEN', '2026-01-09', '08:20:00', '16:30:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('198405151234616001', '198405151234616001', 'Dr. Hendra Gunawan, M.M', 'DOSEN', '2026-01-09', '08:15:00', '16:35:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('198801152000121001', '198801152000121001', 'Andi Wijaya', 'KARYAWAN', '2026-01-09', '07:55:00', '16:00:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('199205202000132001', '199205202000132001', 'Sri Rahayu', 'KARYAWAN', '2026-01-09', '08:05:00', '16:15:00', 'FP-GEDUNG-B-001', 'SIDIK_JARI', 'HADIR', 0),
('199108252000154001', '199108252000154001', 'Dewi Kusuma', 'KARYAWAN', '2026-01-09', '08:00:00', '16:10:00', 'FP-GEDUNG-B-001', 'SIDIK_JARI', 'HADIR', 0),
('198903102000165001', '198903102000165001', 'Agus Permana', 'KARYAWAN', '2026-01-09', '08:25:00', '16:30:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0);

-- ==================== WEEK 2: Jan 13-16, 2026 ====================

-- Monday Jan 13
INSERT INTO attendance (user_id, nip, nama, jabatan, tanggal, jam_masuk, jam_keluar, device_id, verification_method, status, is_deleted) VALUES
('198805121234561001', '198805121234561001', 'Dr. Ahmad Hidayat, M.Kom', 'DOSEN', '2026-01-13', '08:10:00', '16:30:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('197512251234583001', '197512251234583001', 'Prof. Budi Santoso, Ph.D', 'DOSEN', '2026-01-13', '08:00:00', '17:10:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('199001101234594001', '199001101234594001', 'Dr. Dewi Lestari, S.Kom, M.T', 'DOSEN', '2026-01-13', '08:15:00', '16:45:00', 'FP-GEDUNG-B-001', 'SIDIK_JARI', 'HADIR', 0),
('198703051234605001', '198703051234605001', 'Dr. Rina Wijaya, M.Sc', 'DOSEN', '2026-01-13', '08:05:00', '16:35:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('198801152000121001', '198801152000121001', 'Andi Wijaya', 'KARYAWAN', '2026-01-13', '07:50:00', '16:05:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('199205202000132001', '199205202000132001', 'Sri Rahayu', 'KARYAWAN', '2026-01-13', '08:00:00', '16:10:00', 'FP-GEDUNG-B-001', 'SIDIK_JARI', 'HADIR', 0),
('199108252000154001', '199108252000154001', 'Dewi Kusuma', 'KARYAWAN', '2026-01-13', '08:10:00', '16:20:00', 'FP-GEDUNG-B-001', 'SIDIK_JARI', 'HADIR', 0);

-- Tuesday Jan 14 - Full attendance
INSERT INTO attendance (user_id, nip, nama, jabatan, tanggal, jam_masuk, jam_keluar, device_id, verification_method, status, is_deleted) VALUES
('198805121234561001', '198805121234561001', 'Dr. Ahmad Hidayat, M.Kom', 'DOSEN', '2026-01-14', '08:05:00', '16:25:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('198206151234572001', '198206151234572001', 'Dr. Siti Nurhaliza, M.T', 'DOSEN', '2026-01-14', '08:10:00', '16:30:00', 'FP-GEDUNG-B-001', 'SIDIK_JARI', 'HADIR', 0),
('197512251234583001', '197512251234583001', 'Prof. Budi Santoso, Ph.D', 'DOSEN', '2026-01-14', '07:55:00', '17:00:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('199001101234594001', '199001101234594001', 'Dr. Dewi Lestari, S.Kom, M.T', 'DOSEN', '2026-01-14', '08:15:00', '16:50:00', 'FP-GEDUNG-B-001', 'SIDIK_JARI', 'HADIR', 0),
('198703051234605001', '198703051234605001', 'Dr. Rina Wijaya, M.Sc', 'DOSEN', '2026-01-14', '08:00:00', '16:35:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('198405151234616001', '198405151234616001', 'Dr. Hendra Gunawan, M.M', 'DOSEN', '2026-01-14', '08:20:00', '16:40:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('198801152000121001', '198801152000121001', 'Andi Wijaya', 'KARYAWAN', '2026-01-14', '07:45:00', '16:00:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('199205202000132001', '199205202000132001', 'Sri Rahayu', 'KARYAWAN', '2026-01-14', '08:05:00', '16:15:00', 'FP-GEDUNG-B-001', 'SIDIK_JARI', 'HADIR', 0),
('198710182000143001', '198710182000143001', 'Budi Santoso', 'KARYAWAN', '2026-01-14', '07:50:00', '16:10:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('199108252000154001', '199108252000154001', 'Dewi Kusuma', 'KARYAWAN', '2026-01-14', '08:00:00', '16:05:00', 'FP-GEDUNG-B-001', 'SIDIK_JARI', 'HADIR', 0),
('198903102000165001', '198903102000165001', 'Agus Permana', 'KARYAWAN', '2026-01-14', '08:15:00', '16:20:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0);

-- Wednesday Jan 15
INSERT INTO attendance (user_id, nip, nama, jabatan, tanggal, jam_masuk, jam_keluar, device_id, verification_method, status, is_deleted) VALUES
('198805121234561001', '198805121234561001', 'Dr. Ahmad Hidayat, M.Kom', 'DOSEN', '2026-01-15', '08:10:00', '16:30:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('198206151234572001', '198206151234572001', 'Dr. Siti Nurhaliza, M.T', 'DOSEN', '2026-01-15', '08:05:00', '16:25:00', 'FP-GEDUNG-B-001', 'SIDIK_JARI', 'HADIR', 0),
('199001101234594001', '199001101234594001', 'Dr. Dewi Lestari, S.Kom, M.T', 'DOSEN', '2026-01-15', '08:15:00', NULL, 'FP-GEDUNG-B-001', 'SIDIK_JARI', 'HADIR', 0),
('198703051234605001', '198703051234605001', 'Dr. Rina Wijaya, M.Sc', 'DOSEN', '2026-01-15', '08:20:00', '16:40:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('198405151234616001', '198405151234616001', 'Dr. Hendra Gunawan, M.M', 'DOSEN', '2026-01-15', '08:00:00', '16:35:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('198801152000121001', '198801152000121001', 'Andi Wijaya', 'KARYAWAN', '2026-01-15', '07:55:00', '16:05:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('199205202000132001', '199205202000132001', 'Sri Rahayu', 'KARYAWAN', '2026-01-15', '08:10:00', '16:15:00', 'FP-GEDUNG-B-001', 'SIDIK_JARI', 'HADIR', 0),
('198710182000143001', '198710182000143001', 'Budi Santoso', 'KARYAWAN', '2026-01-15', '07:50:00', '16:10:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('199108252000154001', '199108252000154001', 'Dewi Kusuma', 'KARYAWAN', '2026-01-15', '08:05:00', '16:20:00', 'FP-GEDUNG-B-001', 'SIDIK_JARI', 'HADIR', 0);

-- Thursday Jan 16
INSERT INTO attendance (user_id, nip, nama, jabatan, tanggal, jam_masuk, jam_keluar, device_id, verification_method, status, is_deleted) VALUES
('198805121234561001', '198805121234561001', 'Dr. Ahmad Hidayat, M.Kom', 'DOSEN', '2026-01-16', '08:05:00', '16:30:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('198206151234572001', '198206151234572001', 'Dr. Siti Nurhaliza, M.T', 'DOSEN', '2026-01-16', '08:10:00', '16:25:00', 'FP-GEDUNG-B-001', 'SIDIK_JARI', 'HADIR', 0),
('197512251234583001', '197512251234583001', 'Prof. Budi Santoso, Ph.D', 'DOSEN', '2026-01-16', '07:55:00', '17:05:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('198703051234605001', '198703051234605001', 'Dr. Rina Wijaya, M.Sc', 'DOSEN', '2026-01-16', '08:15:00', '16:35:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('198405151234616001', '198405151234616001', 'Dr. Hendra Gunawan, M.M', 'DOSEN', '2026-01-16', '08:20:00', '16:40:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('198801152000121001', '198801152000121001', 'Andi Wijaya', 'KARYAWAN', '2026-01-16', '07:50:00', '16:00:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('198710182000143001', '198710182000143001', 'Budi Santoso', 'KARYAWAN', '2026-01-16', '07:55:00', '16:15:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('198903102000165001', '198903102000165001', 'Agus Permana', 'KARYAWAN', '2026-01-16', '08:25:00', '16:30:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0);

-- ==================== WEEK 3: Jan 20-23, 2026 ====================

-- Monday Jan 20
INSERT INTO attendance (user_id, nip, nama, jabatan, tanggal, jam_masuk, jam_keluar, device_id, verification_method, status, is_deleted) VALUES
('198206151234572001', '198206151234572001', 'Dr. Siti Nurhaliza, M.T', 'DOSEN', '2026-01-20', '08:05:00', '16:20:00', 'FP-GEDUNG-B-001', 'SIDIK_JARI', 'HADIR', 0),
('197512251234583001', '197512251234583001', 'Prof. Budi Santoso, Ph.D', 'DOSEN', '2026-01-20', '08:00:00', '17:00:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('199001101234594001', '199001101234594001', 'Dr. Dewi Lestari, S.Kom, M.T', 'DOSEN', '2026-01-20', '08:10:00', '16:45:00', 'FP-GEDUNG-B-001', 'SIDIK_JARI', 'HADIR', 0),
('198405151234616001', '198405151234616001', 'Dr. Hendra Gunawan, M.M', 'DOSEN', '2026-01-20', '08:15:00', '16:35:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('198801152000121001', '198801152000121001', 'Andi Wijaya', 'KARYAWAN', '2026-01-20', '07:55:00', '16:05:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('199205202000132001', '199205202000132001', 'Sri Rahayu', 'KARYAWAN', '2026-01-20', '08:00:00', '16:10:00', 'FP-GEDUNG-B-001', 'SIDIK_JARI', 'HADIR', 0),
('198710182000143001', '198710182000143001', 'Budi Santoso', 'KARYAWAN', '2026-01-20', '07:50:00', '16:15:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0);

-- Tuesday Jan 21
INSERT INTO attendance (user_id, nip, nama, jabatan, tanggal, jam_masuk, jam_keluar, device_id, verification_method, status, is_deleted) VALUES
('198805121234561001', '198805121234561001', 'Dr. Ahmad Hidayat, M.Kom', 'DOSEN', '2026-01-21', '08:10:00', '16:30:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('198206151234572001', '198206151234572001', 'Dr. Siti Nurhaliza, M.T', 'DOSEN', '2026-01-21', '08:05:00', '16:25:00', 'FP-GEDUNG-B-001', 'SIDIK_JARI', 'HADIR', 0),
('197512251234583001', '197512251234583001', 'Prof. Budi Santoso, Ph.D', 'DOSEN', '2026-01-21', '07:55:00', '17:10:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('199001101234594001', '199001101234594001', 'Dr. Dewi Lestari, S.Kom, M.T', 'DOSEN', '2026-01-21', '08:15:00', '16:50:00', 'FP-GEDUNG-B-001', 'SIDIK_JARI', 'HADIR', 0),
('198703051234605001', '198703051234605001', 'Dr. Rina Wijaya, M.Sc', 'DOSEN', '2026-01-21', '08:20:00', '16:40:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('198801152000121001', '198801152000121001', 'Andi Wijaya', 'KARYAWAN', '2026-01-21', '07:50:00', '16:00:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('199205202000132001', '199205202000132001', 'Sri Rahayu', 'KARYAWAN', '2026-01-21', '08:05:00', '16:15:00', 'FP-GEDUNG-B-001', 'SIDIK_JARI', 'HADIR', 0),
('199108252000154001', '199108252000154001', 'Dewi Kusuma', 'KARYAWAN', '2026-01-21', '08:10:00', '16:20:00', 'FP-GEDUNG-B-001', 'SIDIK_JARI', 'HADIR', 0),
('198903102000165001', '198903102000165001', 'Agus Permana', 'KARYAWAN', '2026-01-21', '08:20:00', NULL, 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0);

-- Wednesday Jan 22
INSERT INTO attendance (user_id, nip, nama, jabatan, tanggal, jam_masuk, jam_keluar, device_id, verification_method, status, is_deleted) VALUES
('198805121234561001', '198805121234561001', 'Dr. Ahmad Hidayat, M.Kom', 'DOSEN', '2026-01-22', '08:05:00', '16:30:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('197512251234583001', '197512251234583001', 'Prof. Budi Santoso, Ph.D', 'DOSEN', '2026-01-22', '08:00:00', NULL, 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('199001101234594001', '199001101234594001', 'Dr. Dewi Lestari, S.Kom, M.T', 'DOSEN', '2026-01-22', '08:15:00', '16:45:00', 'FP-GEDUNG-B-001', 'SIDIK_JARI', 'HADIR', 0),
('198703051234605001', '198703051234605001', 'Dr. Rina Wijaya, M.Sc', 'DOSEN', '2026-01-22', '08:10:00', '16:35:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('198405151234616001', '198405151234616001', 'Dr. Hendra Gunawan, M.M', 'DOSEN', '2026-01-22', '08:20:00', '16:40:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('199205202000132001', '199205202000132001', 'Sri Rahayu', 'KARYAWAN', '2026-01-22', '08:00:00', '16:10:00', 'FP-GEDUNG-B-001', 'SIDIK_JARI', 'HADIR', 0),
('198710182000143001', '198710182000143001', 'Budi Santoso', 'KARYAWAN', '2026-01-22', '07:55:00', '16:15:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('199108252000154001', '199108252000154001', 'Dewi Kusuma', 'KARYAWAN', '2026-01-22', '08:05:00', '16:20:00', 'FP-GEDUNG-B-001', 'SIDIK_JARI', 'HADIR', 0),
('198903102000165001', '198903102000165001', 'Agus Permana', 'KARYAWAN', '2026-01-22', '08:15:00', '16:25:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0);

-- Thursday Jan 23
INSERT INTO attendance (user_id, nip, nama, jabatan, tanggal, jam_masuk, jam_keluar, device_id, verification_method, status, is_deleted) VALUES
('198805121234561001', '198805121234561001', 'Dr. Ahmad Hidayat, M.Kom', 'DOSEN', '2026-01-23', '08:10:00', '16:30:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('198206151234572001', '198206151234572001', 'Dr. Siti Nurhaliza, M.T', 'DOSEN', '2026-01-23', '08:05:00', '16:25:00', 'FP-GEDUNG-B-001', 'SIDIK_JARI', 'HADIR', 0),
('198703051234605001', '198703051234605001', 'Dr. Rina Wijaya, M.Sc', 'DOSEN', '2026-01-23', '08:15:00', '16:35:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('198405151234616001', '198405151234616001', 'Dr. Hendra Gunawan, M.M', 'DOSEN', '2026-01-23', '08:20:00', '16:40:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('198801152000121001', '198801152000121001', 'Andi Wijaya', 'KARYAWAN', '2026-01-23', '07:50:00', '16:00:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('198710182000143001', '198710182000143001', 'Budi Santoso', 'KARYAWAN', '2026-01-23', '07:55:00', '16:15:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('199108252000154001', '199108252000154001', 'Dewi Kusuma', 'KARYAWAN', '2026-01-23', '08:10:00', '16:20:00', 'FP-GEDUNG-B-001', 'SIDIK_JARI', 'HADIR', 0),
('198903102000165001', '198903102000165001', 'Agus Permana', 'KARYAWAN', '2026-01-23', '08:25:00', '16:30:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0);

-- ==================== WEEK 4: Jan 27-30, 2026 ====================

-- Monday Jan 27
INSERT INTO attendance (user_id, nip, nama, jabatan, tanggal, jam_masuk, jam_keluar, device_id, verification_method, status, is_deleted) VALUES
('198805121234561001', '198805121234561001', 'Dr. Ahmad Hidayat, M.Kom', 'DOSEN', '2026-01-27', '07:50:00', '16:20:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('198206151234572001', '198206151234572001', 'Dr. Siti Nurhaliza, M.T', 'DOSEN', '2026-01-27', '08:05:00', '16:30:00', 'FP-GEDUNG-B-001', 'SIDIK_JARI', 'HADIR', 0),
('197512251234583001', '197512251234583001', 'Prof. Budi Santoso, Ph.D', 'DOSEN', '2026-01-27', '08:00:00', '17:15:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('199001101234594001', '199001101234594001', 'Dr. Dewi Lestari, S.Kom, M.T', 'DOSEN', '2026-01-27', '08:15:00', '16:40:00', 'FP-GEDUNG-B-001', 'SIDIK_JARI', 'HADIR', 0),
('198703051234605001', '198703051234605001', 'Dr. Rina Wijaya, M.Sc', 'DOSEN', '2026-01-27', '08:20:00', NULL, 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('198801152000121001', '198801152000121001', 'Andi Wijaya', 'KARYAWAN', '2026-01-27', '07:45:00', '16:05:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('199205202000132001', '199205202000132001', 'Sri Rahayu', 'KARYAWAN', '2026-01-27', '08:00:00', '16:15:00', 'FP-GEDUNG-B-001', 'SIDIK_JARI', 'HADIR', 0),
('198710182000143001', '198710182000143001', 'Budi Santoso', 'KARYAWAN', '2026-01-27', '07:55:00', '16:10:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('199108252000154001', '199108252000154001', 'Dewi Kusuma', 'KARYAWAN', '2026-01-27', '08:10:00', NULL, 'FP-GEDUNG-B-001', 'SIDIK_JARI', 'HADIR', 0);

-- Tuesday Jan 28
INSERT INTO attendance (user_id, nip, nama, jabatan, tanggal, jam_masuk, jam_keluar, device_id, verification_method, status, is_deleted) VALUES
('198805121234561001', '198805121234561001', 'Dr. Ahmad Hidayat, M.Kom', 'DOSEN', '2026-01-28', '08:10:00', '16:35:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('197512251234583001', '197512251234583001', 'Prof. Budi Santoso, Ph.D', 'DOSEN', '2026-01-28', '07:45:00', '17:00:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('199001101234594001', '199001101234594001', 'Dr. Dewi Lestari, S.Kom, M.T', 'DOSEN', '2026-01-28', '08:05:00', '16:50:00', 'FP-GEDUNG-B-001', 'SIDIK_JARI', 'HADIR', 0),
('198405151234616001', '198405151234616001', 'Dr. Hendra Gunawan, M.M', 'DOSEN', '2026-01-28', '08:25:00', NULL, 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('198801152000121001', '198801152000121001', 'Andi Wijaya', 'KARYAWAN', '2026-01-28', '07:50:00', '16:00:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('199205202000132001', '199205202000132001', 'Sri Rahayu', 'KARYAWAN', '2026-01-28', '08:05:00', '16:10:00', 'FP-GEDUNG-B-001', 'SIDIK_JARI', 'HADIR', 0),
('198710182000143001', '198710182000143001', 'Budi Santoso', 'KARYAWAN', '2026-01-28', '07:55:00', '16:15:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('199108252000154001', '199108252000154001', 'Dewi Kusuma', 'KARYAWAN', '2026-01-28', '08:00:00', '16:05:00', 'FP-GEDUNG-B-001', 'SIDIK_JARI', 'HADIR', 0),
('198903102000165001', '198903102000165001', 'Agus Permana', 'KARYAWAN', '2026-01-28', '08:15:00', NULL, 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0);

-- Wednesday Jan 29
INSERT INTO attendance (user_id, nip, nama, jabatan, tanggal, jam_masuk, jam_keluar, device_id, verification_method, status, is_deleted) VALUES
('198805121234561001', '198805121234561001', 'Dr. Ahmad Hidayat, M.Kom', 'DOSEN', '2026-01-29', '08:15:00', '16:30:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('198206151234572001', '198206151234572001', 'Dr. Siti Nurhaliza, M.T', 'DOSEN', '2026-01-29', '08:00:00', '16:15:00', 'FP-GEDUNG-B-001', 'SIDIK_JARI', 'HADIR', 0),
('197512251234583001', '197512251234583001', 'Prof. Budi Santoso, Ph.D', 'DOSEN', '2026-01-29', '07:55:00', NULL, 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('199001101234594001', '199001101234594001', 'Dr. Dewi Lestari, S.Kom, M.T', 'DOSEN', '2026-01-29', '08:10:00', '16:45:00', 'FP-GEDUNG-B-001', 'SIDIK_JARI', 'HADIR', 0),
('198801152000121001', '198801152000121001', 'Andi Wijaya', 'KARYAWAN', '2026-01-29', '07:45:00', '16:00:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('199205202000132001', '199205202000132001', 'Sri Rahayu', 'KARYAWAN', '2026-01-29', '08:10:00', '16:15:00', 'FP-GEDUNG-B-001', 'SIDIK_JARI', 'HADIR', 0),
('198710182000143001', '198710182000143001', 'Budi Santoso', 'KARYAWAN', '2026-01-29', '07:50:00', NULL, 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0);

-- Thursday Jan 30
INSERT INTO attendance (user_id, nip, nama, jabatan, tanggal, jam_masuk, jam_keluar, device_id, verification_method, status, is_deleted) VALUES
('198206151234572001', '198206151234572001', 'Dr. Siti Nurhaliza, M.T', 'DOSEN', '2026-01-30', '08:10:00', '16:25:00', 'FP-GEDUNG-B-001', 'SIDIK_JARI', 'HADIR', 0),
('197512251234583001', '197512251234583001', 'Prof. Budi Santoso, Ph.D', 'DOSEN', '2026-01-30', '08:05:00', NULL, 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('198703051234605001', '198703051234605001', 'Dr. Rina Wijaya, M.Sc', 'DOSEN', '2026-01-30', '08:15:00', '16:35:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('198801152000121001', '198801152000121001', 'Andi Wijaya', 'KARYAWAN', '2026-01-30', '07:50:00', '16:05:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('199205202000132001', '199205202000132001', 'Sri Rahayu', 'KARYAWAN', '2026-01-30', '08:00:00', '16:10:00', 'FP-GEDUNG-B-001', 'SIDIK_JARI', 'HADIR', 0),
('199108252000154001', '199108252000154001', 'Dewi Kusuma', 'KARYAWAN', '2026-01-30', '08:05:00', '16:15:00', 'FP-GEDUNG-B-001', 'SIDIK_JARI', 'HADIR', 0),
('198903102000165001', '198903102000165001', 'Agus Permana', 'KARYAWAN', '2026-01-30', '08:20:00', NULL, 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0);

-- ==================== TODAY: Feb 4, 2026 (CURDATE) ====================

-- Attendance for today
INSERT INTO attendance (user_id, nip, nama, jabatan, tanggal, jam_masuk, jam_keluar, device_id, verification_method, status, is_deleted) VALUES
('198805121234561001', '198805121234561001', 'Dr. Ahmad Hidayat, M.Kom', 'DOSEN', CURDATE(), '08:00:00', '16:20:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('198206151234572001', '198206151234572001', 'Dr. Siti Nurhaliza, M.T', 'DOSEN', CURDATE(), '08:05:00', '16:30:00', 'FP-GEDUNG-B-001', 'SIDIK_JARI', 'HADIR', 0),
('199001101234594001', '199001101234594001', 'Dr. Dewi Lestari, S.Kom, M.T', 'DOSEN', CURDATE(), '08:15:00', '16:45:00', 'FP-GEDUNG-B-001', 'SIDIK_JARI', 'HADIR', 0),
('198703051234605001', '198703051234605001', 'Dr. Rina Wijaya, M.Sc', 'DOSEN', CURDATE(), '08:10:00', NULL, 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('198405151234616001', '198405151234616001', 'Dr. Hendra Gunawan, M.M', 'DOSEN', CURDATE(), '08:20:00', '16:35:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('199205202000132001', '199205202000132001', 'Sri Rahayu', 'KARYAWAN', CURDATE(), '08:05:00', '16:15:00', 'FP-GEDUNG-B-001', 'SIDIK_JARI', 'HADIR', 0),
('198710182000143001', '198710182000143001', 'Budi Santoso', 'KARYAWAN', CURDATE(), '07:55:00', '16:10:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),
('199108252000154001', '199108252000154001', 'Dewi Kusuma', 'KARYAWAN', CURDATE(), '08:10:00', NULL, 'FP-GEDUNG-B-001', 'SIDIK_JARI', 'HADIR', 0);

-- =====================================================
-- DATA STATISTICS & VERIFICATION
-- =====================================================

SELECT '✅ CONSOLIDATED SEED DATA INSERTED!' AS '';
SELECT '👥 Employees: 6 Dosen + 5 Karyawan' AS '';
SELECT '📅 Period: Jan 3 - Feb 4, 2026 (~1 month)' AS '';
SELECT '📊 Total Working Days: ~20 days' AS '';

-- Summary by Person
SELECT '\n==================== ATTENDANCE SUMMARY (1 MONTH) ====================\n' AS '';

SELECT 
  e.nip AS 'NIP',
  e.nama AS 'Name',
  e.jabatan AS 'Position',
  COUNT(a.id) AS 'Days Present',
  20 AS 'Total Working Days',
  CONCAT(ROUND((COUNT(a.id) / 20) * 100, 1), '%') AS 'Attendance %'
FROM employees e
LEFT JOIN attendance a ON e.nip = a.nip 
  AND a.tanggal BETWEEN '2026-01-03' AND CURDATE()
  AND a.is_deleted = 0
WHERE e.is_active = 1
GROUP BY e.nip, e.nama, e.jabatan
ORDER BY (COUNT(a.id) / 20) DESC, e.jabatan, e.nama;

-- Daily attendance count
SELECT '\n==================== DAILY ATTENDANCE COUNT ====================\n' AS '';

SELECT 
  tanggal AS 'Date',
  jabatan AS 'Position',
  COUNT(*) AS 'Present'
FROM attendance
WHERE tanggal BETWEEN '2026-01-03' AND CURDATE()
  AND is_deleted = 0
GROUP BY tanggal, jabatan
ORDER BY tanggal, jabatan;

SELECT '\n✅ All data loaded successfully!' AS '';
