-- CreateTable
CREATE TABLE `admins` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(50) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `email` VARCHAR(100) NOT NULL,
    `full_name` VARCHAR(255) NULL,
    `role` VARCHAR(50) NULL DEFAULT 'ADMIN',
    `is_active` BOOLEAN NULL DEFAULT true,
    `last_login` TIMESTAMP(0) NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `username`(`username`),
    UNIQUE INDEX `email`(`email`),
    INDEX `idx_email`(`email`),
    INDEX `idx_is_active`(`is_active`),
    INDEX `idx_username`(`username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attendance` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` VARCHAR(50) NOT NULL,
    `nip` VARCHAR(50) NOT NULL,
    `nama` VARCHAR(255) NOT NULL,
    `jabatan` ENUM('DOSEN', 'KARYAWAN') NOT NULL,
    `tanggal` DATE NOT NULL,
    `jam_masuk` TIME(0) NULL,
    `jam_keluar` TIME(0) NULL,
    `device_id` VARCHAR(100) NULL,
    `cloud_id` VARCHAR(100) NULL,
    `verification_method` VARCHAR(50) NULL DEFAULT 'SIDIK_JARI',
    `status` VARCHAR(50) NULL DEFAULT 'HADIR',
    `is_deleted` BOOLEAN NULL DEFAULT false,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_cloud_id`(`cloud_id`),
    INDEX `idx_device_id`(`device_id`),
    INDEX `idx_is_deleted`(`is_deleted`),
    INDEX `idx_jabatan`(`jabatan`),
    INDEX `idx_nip`(`nip`),
    INDEX `idx_nip_tanggal`(`nip`, `tanggal`),
    INDEX `idx_status`(`status`),
    INDEX `idx_tanggal`(`tanggal`),
    INDEX `idx_tanggal_jabatan`(`tanggal`, `jabatan`),
    INDEX `idx_user_id`(`user_id`),
    INDEX `idx_verification_method`(`verification_method`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `devices` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `device_name` VARCHAR(100) NOT NULL,
    `device_id` VARCHAR(100) NOT NULL,
    `ip_address` VARCHAR(45) NULL,
    `location` VARCHAR(255) NULL,
    `api_key_hash` VARCHAR(255) NULL,
    `is_active` BOOLEAN NULL DEFAULT true,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `device_id`(`device_id`),
    INDEX `idx_device_id`(`device_id`),
    INDEX `idx_is_active`(`is_active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `employees` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nip` VARCHAR(50) NOT NULL,
    `nama` VARCHAR(255) NOT NULL,
    `jabatan` ENUM('DOSEN', 'KARYAWAN') NOT NULL,
    `shift_id` INTEGER NULL,
    `status` ENUM('AKTIF', 'CUTI', 'RESIGN', 'NON_AKTIF') NULL DEFAULT 'AKTIF',
    `tanggal_masuk` DATE NULL,
    `is_active` BOOLEAN NULL DEFAULT true,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `nip`(`nip`),
    INDEX `idx_is_active`(`is_active`),
    INDEX `idx_jabatan`(`jabatan`),
    INDEX `idx_nip`(`nip`),
    INDEX `idx_shift`(`shift_id`),
    INDEX `idx_status`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `password_resets` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `admin_id` INTEGER NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `code` VARCHAR(6) NOT NULL,
    `reset_token` VARCHAR(255) NULL,
    `expires_at` DATETIME(0) NOT NULL,
    `used_at` DATETIME(0) NULL,
    `created_at` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_admin_id`(`admin_id`),
    INDEX `idx_code`(`code`),
    INDEX `idx_email`(`email`),
    INDEX `idx_expires_at`(`expires_at`),
    INDEX `idx_reset_token`(`reset_token`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `shifts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nama_shift` VARCHAR(50) NOT NULL,
    `jam_masuk` TIME(0) NOT NULL,
    `jam_keluar` TIME(0) NOT NULL,
    `deskripsi` TEXT NULL,
    `is_active` BOOLEAN NULL DEFAULT true,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_is_active`(`is_active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `employees` ADD CONSTRAINT `fk_employee_shift` FOREIGN KEY (`shift_id`) REFERENCES `shifts`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `password_resets` ADD CONSTRAINT `fk_password_resets_admin` FOREIGN KEY (`admin_id`) REFERENCES `admins`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

