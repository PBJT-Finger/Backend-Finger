-- Safe migration script to handle schema updates
-- Renaming 'nip' to 'user_id' in employees, updating attendance columns, and adding holidays table.

DROP PROCEDURE IF EXISTS _migrate_database_schema;

DELIMITER $$
CREATE PROCEDURE _migrate_database_schema()
BEGIN
    -- 1. Check if column 'nip' exists in 'employees' table (needs renaming to 'user_id')
    IF EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = 'employees' 
          AND COLUMN_NAME = 'nip'
    ) THEN
        -- Rename nip to user_id
        ALTER TABLE `employees` RENAME COLUMN `nip` TO `user_id`;
        
        -- Drop old indexes if they exist
        IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'employees' AND INDEX_NAME = 'nip') THEN
            ALTER TABLE `employees` DROP INDEX `nip`;
        END IF;
        IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'employees' AND INDEX_NAME = 'idx_nip') THEN
            ALTER TABLE `employees` DROP INDEX `idx_nip`;
        END IF;
        
        -- Create new indexes
        CREATE UNIQUE INDEX `user_id` ON `employees`(`user_id`);
        CREATE INDEX `idx_user_id` ON `employees`(`user_id`);
    END IF;

    -- 2. Check if column 'nip' exists in 'attendance' table (needs dropping)
    IF EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = 'attendance' 
          AND COLUMN_NAME = 'nip'
    ) THEN
        ALTER TABLE `attendance` DROP COLUMN `nip`;
    END IF;

    -- 3. Check and drop old indexes on 'attendance'
    IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'attendance' AND INDEX_NAME = 'idx_nip') THEN
        ALTER TABLE `attendance` DROP INDEX `idx_nip`;
    END IF;
    IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'attendance' AND INDEX_NAME = 'idx_nip_tanggal') THEN
        ALTER TABLE `attendance` DROP INDEX `idx_nip_tanggal`;
    END IF;

    -- 4. Check and create new indexes on 'attendance'
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'attendance' AND INDEX_NAME = 'idx_user_id_tanggal') THEN
        CREATE INDEX `idx_user_id_tanggal` ON `attendance`(`user_id`, `tanggal`);
    END IF;

    -- 5. Add status_keluar to 'attendance' if not exists
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = 'attendance' 
          AND COLUMN_NAME = 'status_keluar'
    ) THEN
        ALTER TABLE `attendance` ADD COLUMN `status_keluar` VARCHAR(50) NULL DEFAULT 'HADIR';
    END IF;

    -- 6. Add admin_notes to 'attendance' if not exists
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = 'attendance' 
          AND COLUMN_NAME = 'admin_notes'
    ) THEN
        ALTER TABLE `attendance` ADD COLUMN `admin_notes` TEXT NULL;
    END IF;

    -- 7. Create holidays table if not exists
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = 'holidays'
    ) THEN
        CREATE TABLE `holidays` (
            `id` INTEGER NOT NULL AUTO_INCREMENT,
            `tanggal` DATE NOT NULL,
            `nama_libur` VARCHAR(255) NOT NULL,
            `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
            `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

            UNIQUE INDEX `holidays_tanggal_key`(`tanggal`),
            INDEX `idx_tanggal`(`tanggal`),
            PRIMARY KEY (`id`)
        ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    END IF;
END $$
DELIMITER ;

CALL _migrate_database_schema();
DROP PROCEDURE IF EXISTS _migrate_database_schema;
