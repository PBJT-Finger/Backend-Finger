-- =====================================================
-- DATABASE MIGRATION: Full Fingerprint Integration
-- Adds cloud_id and verification_method to attendance table
-- =====================================================

USE finger_db;

-- Add new columns to attendance table
ALTER TABLE attendance 
  ADD COLUMN cloud_id VARCHAR(100) NULL COMMENT 'Cloud system identifier from fingerprint device' AFTER device_id,
  ADD COLUMN verification_method VARCHAR(50) DEFAULT 'SIDIK_JARI' COMMENT 'Verification method (SIDIK_JARI, KARTU, WAJAH)' AFTER cloud_id;

-- Add indexes for better query performance
CREATE INDEX idx_cloud_id ON attendance(cloud_id);
CREATE INDEX idx_verification_method ON attendance(verification_method);

-- Verify changes
DESCRIBE attendance;

-- Show sample data structure
SELECT 
  id, nip, nama, tanggal, jam_masuk, device_id, cloud_id, verification_method
FROM attendance 
LIMIT 5;

-- Success message
SELECT '✅ Migration completed: cloud_id and verification_method columns added' AS Status;
