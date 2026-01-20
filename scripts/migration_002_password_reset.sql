-- Migration 002: Password Reset System
-- Date: 2026-01-19
-- Description: Add password_resets table for password reset functionality

-- Create password_resets table
CREATE TABLE IF NOT EXISTS password_resets (
  id INT PRIMARY KEY AUTO_INCREMENT,
  admin_id INT NOT NULL,
  email VARCHAR(255) NOT NULL,
  code VARCHAR(6) NOT NULL COMMENT '6-digit verification code',
  reset_token VARCHAR(255) DEFAULT NULL COMMENT 'Temporary token after code verification',
  expires_at DATETIME NOT NULL COMMENT 'Code expiration time (15 minutes)',
  used_at DATETIME DEFAULT NULL COMMENT 'Timestamp when used',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  -- Foreign key constraint
  CONSTRAINT fk_password_resets_admin 
    FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE,
  
  -- Indexes for performance
  INDEX idx_email (email),
  INDEX idx_code (code),
  INDEX idx_reset_token (reset_token),
  INDEX idx_expires_at (expires_at),
  INDEX idx_admin_id (admin_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add comment to table
ALTER TABLE password_resets COMMENT = 'Password reset tokens and verification codes';

-- Cleanup old/expired reset codes (optional scheduled task)
-- DELETE FROM password_resets WHERE expires_at < NOW() - INTERVAL 1 DAY;
