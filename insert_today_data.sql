-- Quick fix: Insert attendance data for today (2026-01-29) with varied attendance
-- Run this to get realistic attendance percentage showing

USE finger_db;

-- Delete old test data if any for today
DELETE FROM attendance WHERE tanggal = '2026-01-29';

-- Insert sample DOSEN attendance for today
-- 4 dosen total, 1 tidak hadir = 75% attendance
INSERT INTO attendance (user_id, nip, nama, jabatan, tanggal, jam_masuk, jam_keluar, device_id, verification_method, status, is_deleted) VALUES
-- Dr. Ahmad Hidayat - HADIR
('198805121234561001', '198805121234561001', 'Dr. Ahmad Hidayat, M.Kom', 'DOSEN', '2026-01-29', '08:15:00', '16:30:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),

-- Dr. Siti Nurhaliza - HADIR
('198206151234572001', '198206151234572001', 'Dr. Siti Nurhaliza, M.T', 'DOSEN', '2026-01-29', '08:00:00', '16:15:00', 'FP-GEDUNG-B-001', 'SIDIK_JARI', 'HADIR', 0),

-- Prof. Budi Santoso - HADIR
('197512251234583001', '197512251234583001', 'Prof. Budi Santoso, Ph.D', 'DOSEN', '2026-01-29', '07:55:00', '17:00:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),

-- Dr. Dewi Lestari - HADIR (belum checkout)
('199001101234594001', '199001101234594001', 'Dr. Dewi Lestari, S.Kom, M.T', 'DOSEN', '2026-01-29', '08:10:00', NULL, 'FP-GEDUNG-B-001', 'SIDIK_JARI', 'HADIR', 0),

-- Dr. Rina Wijaya - TIDAK HADIR (no record for today)
-- Simulated by not inserting any record for this NIP

-- Dr. Hendra Gunawan - TIDAK HADIR (no record for today)
-- Simulated by not inserting any record for this NIP;

-- Insert sample KARYAWAN attendance for today
-- 5 karyawan total, 2 tidak hadir = 60% attendance
INSERT INTO attendance (user_id, nip, nama, jabatan, tanggal, jam_masuk, jam_keluar, device_id, verification_method, status, is_deleted) VALUES
-- Andi Wijaya - HADIR
('198801152000121001', '198801152000121001', 'Andi Wijaya', 'KARYAWAN', '2026-01-29', '07:45:00', '16:00:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),

-- Sri Rahayu - HADIR
('199205202000132001', '199205202000132001', 'Sri Rahayu', 'KARYAWAN', '2026-01-29', '08:10:00', '16:15:00', 'FP-GEDUNG-B-001', 'SIDIK_JARI', 'HADIR', 0),

-- Budi Santoso - HADIR  
('198710182000143001', '198710182000143001', 'Budi Santoso', 'KARYAWAN', '2026-01-29', '07:50:00', '16:10:00', 'FP-GEDUNG-A-001', 'SIDIK_JARI', 'HADIR', 0),

-- Dewi Kusuma - TIDAK HADIR (no record for today)
-- Simulated by not inserting any record for this NIP

-- Agus Permana - TIDAK HADIR (no record for today)
-- Simulated by not inserting any record for this NIP;

-- Verify data inserted
SELECT 'Dosen attendance today:' as info;
SELECT COUNT(*) as total_dosen_hadir FROM attendance WHERE tanggal = '2026-01-29' AND jabatan = 'DOSEN' AND is_deleted = 0;

SELECT 'Karyawan attendance today:' as info;  
SELECT COUNT(*) as total_karyawan_hadir FROM attendance WHERE tanggal = '2026-01-29' AND jabatan = 'KARYAWAN' AND is_deleted = 0;

SELECT 'Total attendance by jabatan:' as info;
SELECT 
  jabatan,
  COUNT(*) as count
FROM attendance 
WHERE tanggal = '2026-01-29' AND is_deleted = 0
GROUP BY jabatan;
