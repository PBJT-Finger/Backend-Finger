-- ============================================================
-- employees_from_device.sql
-- Generated: 2026-06-02T14:46:19.362Z
-- Source   : ZKTeco @ 175.17.5.50:4370
-- Total    : 7 records
-- ============================================================

-- Pastikan tabel shifts memiliki setidaknya 1 baris (id=1) sebelum import ini.
-- Gunakan: INSERT IGNORE INTO employees (...) untuk skip duplikat.

START TRANSACTION;

INSERT IGNORE INTO `employees`
  (`user_id`, `nama`, `jabatan`, `shift_id`, `status`, `is_active`, `created_at`, `updated_at`)
VALUES
  ('1', 'Melinda', 'KARYAWAN', 1, 'AKTIF', 1, '2026-06-02 14:46:19', '2026-06-02 14:46:19'),
  ('5', 'Lily_Budinurani', 'KARYAWAN', 1, 'AKTIF', 1, '2026-06-02 14:46:19', '2026-06-02 14:46:19'),
  ('3', 'Ilham_Akhsani', 'KARYAWAN', 1, 'AKTIF', 1, '2026-06-02 14:46:19', '2026-06-02 14:46:19'),
  ('4', 'Slamet_Riyadi', 'KARYAWAN', 1, 'AKTIF', 1, '2026-06-02 14:46:19', '2026-06-02 14:46:19'),
  ('2', 'Rafly', 'KARYAWAN', 1, 'AKTIF', 1, '2026-06-02 14:46:19', '2026-06-02 14:46:19'),
  ('6', 'Ria_Candra_Dewi', 'KARYAWAN', 1, 'AKTIF', 1, '2026-06-02 14:46:19', '2026-06-02 14:46:19'),
  ('7', 'Atiek_Nurindriani', 'KARYAWAN', 1, 'AKTIF', 1, '2026-06-02 14:46:19', '2026-06-02 14:46:19')
ON DUPLICATE KEY UPDATE
  `nama`       = VALUES(`nama`),
  `updated_at` = VALUES(`updated_at`);

COMMIT;

-- Total 7 employees di-seed dari alat fingerprint.