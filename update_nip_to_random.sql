-- =====================================================
-- UPDATE NIP TO 15-DIGIT RANDOM NUMBERS
-- =====================================================
USE finger_db;

-- Update Dosen NIP
UPDATE employees SET nip = '197805121234567' WHERE nip = 'D001'; -- Dr. Ahmad Hidayat
UPDATE employees SET nip = '198206151234568' WHERE nip = 'D002'; -- Dr. Siti Nurhaliza
UPDATE employees SET nip = '197503101234569' WHERE nip = 'D003'; -- Prof. Budi Santoso
UPDATE employees SET nip = '198902201234570' WHERE nip = 'D004'; -- Dr. Dewi Lestari
UPDATE employees SET nip = '198709011234571' WHERE nip = 'D005'; -- Dr. Eko Prasetyo

-- Update Karyawan NIP
UPDATE employees SET nip = '199205101234572' WHERE nip = 'K001'; -- Rina Kusuma
UPDATE employees SET nip = '199107151234573' WHERE nip = 'K002'; -- Andi Wijaya
UPDATE employees SET nip = '199401051234574' WHERE nip = 'K003'; -- Maya Sari

-- Update attendance records for Dosen
UPDATE attendance SET nip = '197805121234567', user_id = '197805121234567' WHERE nip = 'D001';
UPDATE attendance SET nip = '198206151234568', user_id = '198206151234568' WHERE nip = 'D002';
UPDATE attendance SET nip = '197503101234569', user_id = '197503101234569' WHERE nip = 'D003';
UPDATE attendance SET nip = '198902201234570', user_id = '198902201234570' WHERE nip = 'D004';
UPDATE attendance SET nip = '198709011234571', user_id = '198709011234571' WHERE nip = 'D005';

-- Update attendance records for Karyawan
UPDATE attendance SET nip = '199205101234572', user_id = '199205101234572' WHERE nip = 'K001';
UPDATE attendance SET nip = '199107151234573', user_id = '199107151234573' WHERE nip = 'K002';
UPDATE attendance SET nip = '199401051234574', user_id = '199401051234574' WHERE nip = 'K003';

-- Verify changes
SELECT '=== UPDATED EMPLOYEES ===' AS Info;
SELECT nip, nama, jabatan FROM employees ORDER BY jabatan, nama;

SELECT '' AS Separator;
SELECT '=== SAMPLE ATTENDANCE RECORDS ===' AS Info;
SELECT nip, nama, tanggal, jam_masuk FROM attendance LIMIT 10;

-- =====================================================
-- DONE!
-- =====================================================
SELECT '✅ NIP updated to 15-digit random numbers' AS Status;
