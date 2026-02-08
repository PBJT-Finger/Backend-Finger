-- =====================================================
-- EMPLOYEE DEVICE MAPPING TABLE
-- Purpose: Map NIP to Device User ID & PIN
-- =====================================================

USE finger_db;

-- Create mapping table if not exists
CREATE TABLE IF NOT EXISTS employee_device_mapping (
  nip VARCHAR(50) PRIMARY KEY COMMENT 'Employee NIP (links to employees table)',
  device_user_id VARCHAR(10) NOT NULL COMMENT 'User ID di fingerprint device (pegawai_id)',
  device_pin VARCHAR(10) NOT NULL COMMENT 'PIN di fingerprint device (pegawai_pin: 1000-1022)',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_device_pin (device_pin),
  INDEX idx_device_user_id (device_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Mapping NIP to Fingerprint Device User ID & PIN';

-- =====================================================
-- INSERT DEVICE MAPPING FROM LEGACY DATA
-- =====================================================

INSERT INTO employee_device_mapping (nip, device_user_id, device_pin) VALUES
-- DOSEN
('850019763', '1', '1000'),
('850020771', '2', '1001'),
('850070351', '3', '1002'),
('850110501', '4', '1003'),
('850019761', '5', '1004'),
('850018701', '6', '1005'),
('850020805', '7', '1006'),
('850023057', '8', '1007'),
('850080388', '9', '1008'),
('850016624', '10', '1009'),

-- KARYAWAN
('850023059', '11', '1010'),
('850110487', '12', '1011'),
('850130906', '13', '1012'),
('850060330', '14', '1013'),
('850050295', '15', '1014'),
('850016595', '16', '1015'),
('850020813', '17', '1016'),
('850022029', '18', '1017'),
('1018', '19', '1018'),
('1019', '20', '1019'),
('1020', '21', '1020'),
('1021', '22', '1021'),
('1022', '23', '1022')
ON DUPLICATE KEY UPDATE 
  device_user_id = VALUES(device_user_id),
  device_pin = VALUES(device_pin);

-- =====================================================
-- VERIFICATION
-- =====================================================

SELECT '✅ Device mapping table created!' AS '';
SELECT COUNT(*) as 'Total Mappings' FROM employee_device_mapping;

-- Show sample mappings
SELECT '\n==================== DEVICE MAPPING SAMPLE ====================\n' AS '';
SELECT 
  m.nip AS 'NIP',
  e.nama AS 'Name',
  e.jabatan AS 'Position',
  m.device_pin AS 'Device PIN',
  m.device_user_id AS 'Device User ID'
FROM employee_device_mapping m
LEFT JOIN employees e ON m.nip = e.nip
ORDER BY e.jabatan, e.nama
LIMIT 10;

SELECT '\n📌 Use this table to lookup device_user_id when syncing attendance!' AS '';
