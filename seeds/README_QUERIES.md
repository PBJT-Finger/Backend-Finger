# Query Untuk Melihat Isi Table

## Cara Menggunakan

### Opsi 1: MySQL Command Line

```cmd
# Login ke MySQL
mysql -u finger_user -pfinger finger_db

# Jalankan query langsung
SELECT * FROM employees;

# Atau load file query
source C:/Users/user/Downloads/Finger/Backend-Finger/seeds/view_tables.sql
```

### Opsi 2: One-liner dari Command Prompt

```cmd
mysql -u finger_user -pfinger finger_db -e "SELECT * FROM employees;"
```

### Opsi 3: MySQL Workbench

1. Open MySQL Workbench
2. Connect ke `finger_db`
3. Copy-paste query di bawah ke Query tab
4. Execute (Ctrl+Enter)

---

## Query Penting

### 1. Lihat Semua Employees

```sql
SELECT 
  nip,
  nama,
  jabatan,
  status,
  tanggal_masuk,
  is_active
FROM employees
ORDER BY jabatan, nama;
```

### 2. Count Employees by Jabatan

```sql
SELECT 
  jabatan, 
  COUNT(*) as total
FROM employees
WHERE is_active = 1
GROUP BY jabatan;
```

**Expected (setelah migration):**
```
+----------+-------+
| jabatan  | total |
+----------+-------+
| DOSEN    |    27 | (6 existing + 21 new)
| KARYAWAN |     7 | (5 existing + 2 new)
+----------+-------+
```

### 3. Lihat Pegawai Baru dari Migration

```sql
SELECT 
  nip,
  nama,
  jabatan
FROM employees
WHERE tanggal_masuk = '2024-10-03'
ORDER BY jabatan, nama;
```

**Expected:** 23 records (21 DOSEN + 2 KARYAWAN)

### 4. Lihat Device Mapping

```sql
SELECT 
  e.nip,
  e.nama,
  e.jabatan,
  m.device_pin
FROM employees e
LEFT JOIN employee_device_mapping m ON e.nip = m.nip
WHERE e.tanggal_masuk = '2024-10-03'
ORDER BY e.jabatan, CAST(m.device_pin AS UNSIGNED);
```

### 5. Lihat Attendance Terbaru

```sql
SELECT 
  nip,
  nama,
  jabatan,
  tanggal,
  jam_masuk,
  jam_keluar,
  status
FROM attendance 
ORDER BY tanggal DESC, jam_masuk DESC 
LIMIT 20;
```

### 6. Cari Pegawai Spesifik

```sql
-- Cari Dede
SELECT * FROM employees WHERE nama LIKE '%Dede%';

-- Cari Danil
SELECT * FROM employees WHERE nama LIKE '%Danil%';

-- Verify mereka KARYAWAN
SELECT nip, nama, jabatan 
FROM employees 
WHERE nama IN ('Dede Harisma', 'Danil Firmansyah');
```

---

## Troubleshooting: Run Migration yang Benar

User mencoba run `run_migration.bat` dari **PowerShell** sehingga error. Berikut cara yang benar:

### Opsi 1: Dari Command Prompt (bukan PowerShell)

1. Buka **Command Prompt** (cmd.exe), bukan PowerShell
2. Jalankan:

```cmd
cd C:\Users\user\Downloads\Finger\Backend-Finger\seeds
run_migration.bat
```

### Opsi 2: Dari PowerShell dengan Path Lengkap

```powershell
& "C:\Users\user\Downloads\Finger\Backend-Finger\seeds\run_migration.bat"
```

### Opsi 3: Manual MySQL Import (Recommended)

Buka **Command Prompt** dan jalankan:

```cmd
cd C:\Users\user\Downloads\Finger\Backend-Finger\seeds

mysql -u finger_user -pfinger finger_db < migrate_legacy_employees.sql
mysql -u finger_user -pfinger finger_db < create_device_mapping.sql
```

---

## Quick Verification Checklist

Setelah migration, jalankan query ini untuk verify:

```sql
-- ✅ 1. Total employees harus bertambah 23
SELECT COUNT(*) as total FROM employees WHERE is_active = 1;

-- ✅ 2. Dede dan Danil harus KARYAWAN
SELECT nip, nama, jabatan 
FROM employees 
WHERE nip IN ('1021', '1022');

-- Expected:
-- 1021 | Dede Harisma | KARYAWAN
-- 1022 | Danil Firmansyah | KARYAWAN

-- ✅ 3. Device mapping harus ada 23 records
SELECT COUNT(*) as total FROM employee_device_mapping;

-- ✅ 4. PIN 1021 dan 1022 untuk Dede & Danil
SELECT 
  e.nama, 
  m.device_pin 
FROM employees e
JOIN employee_device_mapping m ON e.nip = m.nip
WHERE e.nip IN ('1021', '1022');
```

---

## Export Data (Optional)

Jika ingin export ke file untuk backup:

```cmd
# Export all employees to CSV
mysql -u finger_user -pfinger finger_db -e "SELECT * FROM employees" > employees_backup.csv

# Export device mapping
mysql -u finger_user -pfinger finger_db -e "SELECT * FROM employee_device_mapping" > device_mapping_backup.csv
```
