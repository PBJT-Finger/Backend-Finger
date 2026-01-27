-- =====================================================
-- UPDATE NIP TO 18-DIGIT FORMAT (Indonesian PNS Standard)
-- Format: YYYYMMDD (Birth) + 6-digit sequential + 4-digit code
-- =====================================================
USE finger_db;

-- Update Dosen NIP (18 digits)
UPDATE employees SET nip = '198805121234561001' WHERE nip = '197805121234567'; -- Dr. Ahmad Hidayat
UPDATE employees SET nip = '198206151234572001' WHERE nip = '198206151234568'; -- Dr. Siti Nurhaliza
UPDATE employees SET nip = '197503101234581001' WHERE nip = '197503101234569'; -- Prof. Budi Santoso
UPDATE employees SET nip = '198902201234592001' WHERE nip = '198902201234570'; -- Dr. Dewi Lestari
UPDATE employees SET nip = '198709011234601001' WHERE nip = '198709011234571'; -- Dr. Eko Prasetyo

-- Update Karyawan NIP (18 digits)
UPDATE employees SET nip = '199205101234612001' WHERE nip = '199205101234572'; -- Rina Kusuma
UPDATE employees SET nip = '199107151234621001' WHERE nip = '199107151234573'; -- Andi Wijaya
UPDATE employees SET nip = '199401051234632001' WHERE nip = '199401051234574'; -- Maya Sari

-- Update attendance records for Dosen
UPDATE attendance SET nip = '198805121234561001', user_id = '198805121234561001' WHERE nip = '197805121234567';
UPDATE attendance SET nip = '198206151234572001', user_id = '198206151234572001' WHERE nip = '198206151234568';
UPDATE attendance SET nip = '197503101234581001', user_id = '197503101234581001' WHERE nip = '197503101234569';
UPDATE attendance SET nip = '198902201234592001', user_id = '198902201234592001' WHERE nip = '198902201234570';
UPDATE attendance SET nip = '198709011234601001', user_id = '198709011234601001' WHERE nip = '198709011234571';

-- Update attendance records for Karyawan
UPDATE attendance SET nip = '199205101234612001', user_id = '199205101234612001' WHERE nip = '199205101234572';
UPDATE attendance SET nip = '199107151234621001', user_id = '199107151234621001' WHERE nip = '199107151234573';
UPDATE attendance SET nip = '199401051234632001', user_id = '199401051234632001' WHERE nip = '199401051234574';

-- Verify changes
SELECT '=== UPDATED EMPLOYEES (18-digit NIP) ===' AS Info;
SELECT nip, nama, jabatan FROM employees ORDER BY jabatan, nama;

SELECT '' AS Separator;
SELECT '=== SAMPLE ATTENDANCE RECORDS ===' AS Info;
SELECT nip, nama, tanggal, jam_masuk FROM attendance LIMIT 8;

-- =====================================================
-- NIP FORMAT EXPLANATION
-- =====================================================
-- Format: YYYYMMDD + 6-digit sequential + 4-digit code
-- Example: 198805121234561001
--   19880512 = Birth date (May 12, 1988)
--   123456   = Sequential registration number
--   1001     = Gender + Status code (1xxx = Male, 2xxx = Female)
-- =====================================================

SELECT '✅ NIP updated to 18-digit format (Indonesian PNS standard)' AS Status;
