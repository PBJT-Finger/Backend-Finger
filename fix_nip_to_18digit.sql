-- =====================================================
-- UPDATE NIP FROM D001/K001 FORMAT TO 18-DIGIT
-- Direct update from short format to 18-digit PNS standard
-- =====================================================
USE finger_db;

-- Update Dosen NIP (from D001 format to 18 digits)
UPDATE employees SET nip = '198805121234561001' WHERE nip = 'D001'; -- Dr. Ahmad Hidayat
UPDATE employees SET nip = '198206151234572001' WHERE nip = 'D002'; -- Dr. Siti Nurhaliza
UPDATE employees SET nip = '197503101234581001' WHERE nip = 'D003'; -- Prof. Budi Santoso
UPDATE employees SET nip = '198902201234592001' WHERE nip = 'D004'; -- Dr. Dewi Lestari
UPDATE employees SET nip = '198709011234601001' WHERE nip = 'D005'; -- Dr. Eko Prasetyo

-- Update Karyawan NIP (from K001 format to 18 digits)
UPDATE employees SET nip = '199205101234612001' WHERE nip = 'K001'; -- Rina Kusuma
UPDATE employees SET nip = '199107151234621001' WHERE nip = 'K002'; -- Andi Wijaya
UPDATE employees SET nip = '199401051234632001' WHERE nip = 'K003'; -- Maya Sari
UPDATE employees SET nip = '199411201234642001' WHERE nip = 'K004'; -- Budi Hartono (if exists)

-- Update attendance records for Dosen
UPDATE attendance SET nip = '198805121234561001', user_id = '198805121234561001' WHERE nip = 'D001';
UPDATE attendance SET nip = '198206151234572001', user_id = '198206151234572001' WHERE nip = 'D002';
UPDATE attendance SET nip = '197503101234581001', user_id = '197503101234581001' WHERE nip = 'D003';
UPDATE attendance SET nip = '198902201234592001', user_id = '198902201234592001' WHERE nip = 'D004';
UPDATE attendance SET nip = '198709011234601001', user_id = '198709011234601001' WHERE nip = 'D005';

-- Update attendance records for Karyawan
UPDATE attendance SET nip = '199205101234612001', user_id = '199205101234612001' WHERE nip = 'K001';
UPDATE attendance SET nip = '199107151234621001', user_id = '199107151234621001' WHERE nip = 'K002';
UPDATE attendance SET nip = '199401051234632001', user_id = '199401051234632001' WHERE nip = 'K003';
UPDATE attendance SET nip = '199411201234642001', user_id = '199411201234642001' WHERE nip = 'K004';

-- Verify changes
SELECT '=== UPDATED EMPLOYEES (18-digit NIP) ===' AS Info;
SELECT nip, nama, jabatan FROM employees ORDER BY jabatan, nama;

SELECT '=== SAMPLE ATTENDANCE RECORDS ===' AS Info;
SELECT nip, nama, tanggal, jam_masuk FROM attendance LIMIT 10;

SELECT 'SUCCESS: NIP updated to 18-digit format!' AS Status;
