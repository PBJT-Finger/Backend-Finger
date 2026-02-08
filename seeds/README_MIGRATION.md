# Legacy Employee Data Migration

## Overview

Script ini untuk mengimpor data pegawai lama (23 orang) dari backup microSD ke database `finger_db`.

## Files

1. **`migrate_legacy_employees.sql`** - Script migrasi utama
2. **`create_device_mapping.sql`** - Tabel mapping NIP ↔ Device User ID
3. **`README_MIGRATION.md`** - Dokumentasi ini

---

## Quick Start (Run Migration)

```bash
# Login ke MySQL
mysql -u finger_user -p finger_db

# Run migration script
source C:/Users/user/Downloads/Finger/Backend-Finger/seeds/migrate_legacy_employees.sql

# (Optional) Create device mapping table
source C:/Users/user/Downloads/Finger/Backend-Finger/seeds/create_device_mapping.sql
```

**Atau via command line langsung:**

```bash
mysql -u finger_user -p finger_db < C:/Users/user/Downloads/Finger/Backend-Finger/seeds/migrate_legacy_employees.sql
mysql -u finger_user -p finger_db < C:/Users/user/Downloads/Finger/Backend-Finger/seeds/create_device_mapping.sql
```

---

## Data Summary

### Total: 23 Pegawai

**DOSEN: 10 orang**
- NIP: 850019763 - Slamet Riyadi, M.T (PIN: 1000)
- NIP: 850020771 - Sendie Yuliarto Margen, M.T (PIN: 1001)
- NIP: 850070351 - Lily Budinurani, M.Pd (PIN: 1002)
- NIP: 850110501 - Ria Candra Dewi, M.Pd (PIN: 1003)
- NIP: 850019761 - Atiek Nurindriani, M.Pd (PIN: 1004)
- NIP: 850018701 - Aziz Azindani, M.Kom (PIN: 1005)
- NIP: 850020805 - Ali Wardana, M.Pd (PIN: 1006)
- NIP: 850023057 - Tunggal Ajining Prasetiadi, M.T (PIN: 1007)
- NIP: 850080388 - Agung Nugroho, M.T (PIN: 1008)
- NIP: 850016624 - Ismi Kusumaningroem, M.Pd (PIN: 1009)

**KARYAWAN: 13 orang**
- NIP: 850023059 - Ilham Akhsani, S.Tr.Kom (PIN: 1010)
- NIP: 850110487 - Budi Pribowo, SST (PIN: 1011)
- NIP: 850130906 - Mizar Wahyu Ardani, ST (PIN: 1012)
- NIP: 850060330 - Susanto, S.Pd (PIN: 1013)
- NIP: 850050295 - Nurul Atiqoh, S.Pd (PIN: 1014)
- NIP: 850016595 - Tri Looke Darwanto, S.Kom (PIN: 1015)
- NIP: 850020813 - Robiatul Adawiyah, M.Kom (PIN: 1016)
- NIP: 850022029 - M Hasan Fatoni, ST (PIN: 1017)
- NIP: 1018 - Eko Supriyanto, ST (PIN: 1018)
- NIP: 1019 - A Maulana Izzudin, S.Pd (PIN: 1019)
- NIP: 1020 - Ayu Ningrum Purnamasari, S.Pd (PIN: 1020)
- NIP: 1021 - Dede Harisma (PIN: 1021)
- NIP: 1022 - Danil Firmansyah (PIN: 1022)

---

## Field Mapping

| Legacy (pegawai) | Current (employees) | Transformation |
|------------------|---------------------|----------------|
| `pegawai_nip` | `nip` | Remove spaces: "850 019 763" → "850019763" |
| `pegawai_nama` | `nama` | Keep as-is (with title) |
| `pembagian1_id` | `jabatan` | 1-10 → DOSEN, 11-12 → KARYAWAN |
| `tgl_mulai_kerja` | `tanggal_masuk` | Direct copy: 2024-10-03 |
| `pegawai_status` | `status` | All = AKTIF (semua pegawai aktif) |
| `pegawai_status` | `is_active` | 1 → true |
| `pegawai_pin` | (device_mapping) | Stored in `employee_device_mapping` table |
| `pegawai_id` | (device_mapping) | Stored as `device_user_id` |

---

## Verification Queries

### Check imported employees

```sql
-- Count by jabatan
SELECT jabatan, COUNT(*) as total
FROM employees
WHERE tanggal_masuk = '2024-10-03'
GROUP BY jabatan;

-- Expected:
-- DOSEN: 10
-- KARYAWAN: 13
```

### Check device mapping

```sql
-- Show device PIN mapping
SELECT 
  e.nip,
  e.nama,
  e.jabatan,
  m.device_pin,
  m.device_user_id
FROM employees e
LEFT JOIN employee_device_mapping m ON e.nip = m.nip
WHERE e.tanggal_masuk = '2024-10-03'
ORDER BY e.jabatan, e.nama;
```

### Test with Frontend API

```bash
# Test Dosen endpoint
curl "http://localhost:3333/api/attendance/dosen"

# Test Karyawan endpoint
curl "http://localhost:3333/api/attendance/karyawan"
```

---

## Important Notes

### 1. Duplicate Handling
Script menggunakan `INSERT IGNORE` untuk skip data duplikat. Jika NIP sudah ada, data akan di-skip.

### 2. Device User ID Mapping
Tabel `employee_device_mapping` penting untuk:
- Sync attendance dari device
- Mapping `user_id` di attendance log ke NIP
- Troubleshooting jika ada mismatch

### 3. Shift Assignment
- DOSEN: `shift_id = NULL` (tidak ada shift tetap)
- KARYAWAN: `shift_id = 1` (shift default)

Sesuaikan dengan data shift yang ada di tabel `shifts`.

### 4. NIP Format
NIP di database sudah di-clean (tanpa spasi):
- Legacy: `"850 019 763"`
- Current: `"850019763"`

---

## Rollback (jika perlu)

Jika ada kesalahan dan ingin menghapus data yang diimport:

```sql
-- Delete imported employees
DELETE FROM employees 
WHERE tanggal_masuk = '2024-10-03' 
AND nip IN (
  '850019763', '850020771', '850070351', '850110501', '850019761',
  '850018701', '850020805', '850023057', '850080388', '850016624',
  '850023059', '850110487', '850130906', '850060330', '850050295',
  '850016595', '850020813', '850022029', '1018', '1019',
  '1020', '1021', '1022'
);

-- Delete device mapping
DELETE FROM employee_device_mapping;
```

---

## Next Steps

After migration:

1. ✅ Register fingerprints di device Revo W-202BNC
   - User ID harus match dengan `device_user_id`
   - PIN harus match dengan `device_pin`

2. ✅ Configure ADMS software
   - Set endpoint: `http://localhost:3333/adms/push`
   - Test connection

3. ✅ Test attendance sync
   - Scan fingerprint di device
   - Verify data masuk ke database
   - Check di frontend dashboard

---

**Migration Created:** 2026-02-08  
**Total Records:** 23 pegawai (10 DOSEN + 13 KARYAWAN)
