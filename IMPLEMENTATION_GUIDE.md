# Panduan Implementasi Integrasi Revo W-202BNC
## Step-by-Step Guide untuk Laptop Lokal

> **Berdasarkan:** [`analisis_integrasi_revo_w202bnc.md`](file:///C:/Users/user/.gemini/antigravity/brain/7417bcb4-bec5-42f7-aed3-06cbfaa9ec83/analisis_integrasi_revo_w202bnc.md)

---

## 📋 OVERVIEW SISTEM

```
[Revo W-202BNC Device] 
         ↓ (WiFi/TCP-IP - Port 4370)
[ADMS Software / Fingerspot.io]
         ↓ (HTTP POST /adms/push)
[Backend API - localhost:3333]
         ↓ (MySQL Query)
[Database - finger_db]
         ↓ (HTTP GET /api/attendance)
[Frontend Dashboard - localhost:5173]
```

---

## 🎯 FASE 1: PERSIAPAN DATABASE (15 menit)

### STEP 1.1: Import Data Pegawai (23 orang)

**Anda sudah punya:** Script Prisma migration di `scripts/migrate-legacy-employees.js`

**Jalankan:**

```bash
cd C:\Users\user\Downloads\Finger\Backend-Finger

# Import 23 pegawai (21 DOSEN + 2 KARYAWAN)
npm run migrate:legacy

# Create device mapping (NIP → PIN 1000-1022)
npm run seed:device-mapping

# Verify hasil
npm run verify:migration
```

**Expected Output:**
```
✅ Success: 23 employees imported
✅ Jabatan mapping correct (21 DOSEN + 2 KARYAWAN)
✅ Device mappings: 23 records created
```

**Verifikasi Manual (opsional):**
```bash
mysql -u finger_user -pfinger finger_db -e "SELECT jabatan, COUNT(*) FROM employees GROUP BY jabatan;"
```

Expected:
- DOSEN: 27 (6 existing + 21 new)
- KARYAWAN: 7 (5 existing + 2 new)

### STEP 1.2: Check Backend API Status

**Test API endpoint:**

```bash
# Test backend running
curl http://localhost:3333/health

# Test ADMS endpoint (akan digunakan oleh device)
curl http://localhost:3333/adms/health
```

Expected response:
```json
{
  "success": true,
  "data": {
    "service": "ADMS Fingerprint Integration",
    "status": "operational"
  }
}
```

---

## 🔧 FASE 2: SETUP HARDWARE - REVO W-202BNC (30 menit)

### STEP 2.1: Konfigurasi Network Device

**Physical Setup:**
1. Colokkan power adapter ke Revo W-202BNC
2. Pastikan device dan laptop terhubung di **jaringan WiFi yang sama**
   - Laptop IP: `192.168.110.59`
   - Device IP: `192.168.110.102` (akan dikonfigurasi)

**Konfigurasi IP via Device Menu:**

1. **Masuk Menu Admin:**
   - Tekan tombol `MENU` di device
   - Login admin (default password: `233333`)

2. **Set IP Address:**
   - Navigate: `System` → `Communication` → `Network`
   - Set konfigurasi:
     ```
     IP Address: 192.168.110.102
     Subnet Mask: 255.255.255.0
     Gateway: 192.168.110.1  (sesuaikan dengan router Anda)
     DNS: 192.168.110.1
     ```
   - Save dan Restart device

3. **Test Koneksi dari Laptop:**
   ```cmd
   ping 192.168.110.102
   ```
   
   Expected:
   ```
   Reply from 192.168.110.102: bytes=32 time<1ms TTL=64
   ✅ Device terkoneksi!
   ```

   Jika gagal:
   - Cek IP laptop: `ipconfig` (harus 192.168.1.x)
   - Pastikan firewall tidak block
   - Restart device dan coba lagi

### STEP 2.2: Register User & Fingerprint di Device

**Untuk 23 pegawai, Anda perlu register satu-per-satu di device.**

**Contoh untuk pegawai pertama (Slamet Riyadi):**

1. **Masuk Menu Admin** di device
2. **User Management** → **Add New User**
3. **Isi data:**
   ```
   User ID: 1           (sesuai device_user_id)
   PIN: 1000            (sesuai device_pin)
   Name: Slamet Riyadi  (max 24 karakter)
   Password: [kosongkan]
   Card Number: [kosongkan]
   ```
4. **Enroll Fingerprint:**
   - Pilih: `Fingerprint` → `Enroll`
   - Scan jempol kanan 3x (device akan beep)
   - Scan jempol kiri 3x (backup)
   - Save

5. **Verify Enrollment:**
   - Test scan fingerprint
   - Device harus menampilkan nama dan beep sukses

**Ulangi untuk 22 pegawai lainnya** dengan data:

| No  | Nama | User ID | PIN  | Jabatan |
|-----|------|---------|------|---------|
| 1   | Slamet Riyadi | 1 | 1000 | DOSEN |
| 2   | Sendie Yuliarto | 2 | 1001 | DOSEN |
| ... | ... | ... | ... | ... |
| 22  | Dede Harisma | 22 | 1021 | KARYAWAN |
| 23  | Danil Firmansyah | 23 | 1022 | KARYAWAN |

**Lihat mapping lengkap:**
```bash
mysql -u finger_user -pfinger finger_db -e "SELECT e.nama, m.device_user_id, m.device_pin FROM employees e JOIN employee_device_mapping m ON e.nip = m.nip WHERE e.tanggal_masuk = '2024-10-03' ORDER BY CAST(m.device_pin AS UNSIGNED);"
```

> **TIPS:** Untuk mempercepat, bisa register 5-10 user dulu untuk testing, sisanya menyusul.

---

## 📱 FASE 3: SETUP ADMS SOFTWARE (45 menit)

### OPSI A: Fingerspot Personnel (Desktop) - RECOMMENDED untuk Local

**STEP 3A.1: Download & Install**

1. Download installer dari: https://fingerspot.com/downloads
2. Install di laptop Windows Anda
3. Jalankan sebagai Administrator

**STEP 3A.2: Tambah Device**

1. Buka **Fingerspot Personnel**
2. Menu: `Device` → `Manage Device` → `Add New`
3. **Isi konfigurasi:**
   ```
   Device Name: FP-MAIN-001
   Device Type: W-202 Series / W-202BNC
   Connection: TCP/IP
   IP Address: 192.168.110.102
   Port: 4370
   Comm Password: [kosongkan]
   Admin Password: 233333
   ```
4. Click **Test Connection**
   - Expected: "Connection Success ✅"
   - Jika gagal, cek IP dan firewall

**STEP 3A.3: Download User Data dari Device**

1. Menu: `User` → `Download from Device`
2. Select device: `FP-MAIN-001`
3. Click `Download`
4. Verify: 23 users muncul di list

**STEP 3A.4: Configure API Push ke Backend**

1. Menu: `Settings` → `Advanced` → `API Integration`
2. **Isi konfigurasi:**
   ```
   Enable API Push: ✓ (check)
   Backend URL: http://localhost:3333/adms/push
   Method: POST
   Content-Type: application/json
   API Key: [kosongkan dulu]
   
   Auto Sync: ✓ (enable)
   Sync Interval: 5 minutes
   Sync on Event: ✓ (enable - langsung push saat ada absensi baru)
   ```
3. Click **Test Connection**
   - Backend harus running
   - Expected: "200 OK - Connection successful"

4. **Save Settings**

**STEP 3A.5: Test Manual Sync**

1. Menu: `Attendance` → `Download from Device`
2. Date range: Hari ini
3. Click `Download`
4. Data akan otomatis:
   - Download from device
   - Transform ke format JSON
   - POST ke `http://localhost:3333/adms/push`
   - Tersimpan di database

### OPSI B: Fingerspot.io Cloud (Online)

> **NOTE:** Memerlukan internet dan subscription. Skip jika pakai Opsi A.

**STEP 3B.1: Register & Setup**

1. Register di: https://fingerspot.io
2. Add device via cloud dashboard
3. Configure webhook:
   ```
   Webhook URL: http://YOUR_PUBLIC_IP:3333/adms/push
   ```
   (Perlu port forwarding di router atau ngrok)

---

## ✅ FASE 4: TESTING END-TO-END (20 menit)

### STEP 4.1: Test Real Attendance Flow

**Simulasi karyawan absen:**

1. **Scan fingerprint di device** (pakai salah satu user yang sudah di-register)
   - Device beep dan tampilkan nama
   - Catat waktu scan

2. **Tunggu auto-sync** (max 5 menit) atau manual sync di ADMS

3. **Check backend logs:**
   ```bash
   # Terminal tempat backend running
   # Lihat log: "Attendance pushed from ADMS device"
   ```

4. **Verify di database:**
   ```sql
   mysql -u finger_user -pfinger finger_db
   
   SELECT * FROM attendance 
   WHERE tanggal = CURDATE() 
   ORDER BY created_at DESC 
   LIMIT 5;
   ```
   
   Expected: Ada record baru dengan:
   - `nip`: sesuai user yang scan
   - `jam_masuk` atau `jam_keluar`: sesuai waktu scan
   - `device_id`: FP-MAIN-001
   - `verification_method`: SIDIK_JARI

5. **Check Frontend Dashboard:**
   ```
   Buka browser: http://localhost:5173
   ```
   - Navigate ke **Dosen** atau **Karyawan** page
   - Filter: **Hari Ini**
   - Data attendance harus muncul! ✅

### STEP 4.2: Test Endpoint API

**Dari Command Prompt:**

```bash
# Test Dosen attendance
curl "http://localhost:3333/api/attendance/dosen?start_date=2026-02-08&end_date=2026-02-08"

# Test Karyawan attendance
curl "http://localhost:3333/api/attendance/karyawan?start_date=2026-02-08&end_date=2026-02-08"

# Test ADMS health
curl "http://localhost:3333/adms/health"
```

**Via Postman/Scalar UI:**
```
http://localhost:3333/api/scalar
```
- Test semua endpoint
- Verify response format

### STEP 4.3: Test Berbagai Skenario

**Skenario 1: Absen Masuk Pagi**
1. Scan fingerprint jam 08:00
2. Verify `jam_masuk` ter-record
3. `jam_keluar` = NULL

**Skenario 2: Absen Pulang Sore**
1. Scan fingerprint lagi jam 16:00
2. Verify `jam_keluar` ter-update
3. Record yang sama (tidak create baru)

**Skenario 3: Lupa Scan Pulang**
1. Hanya scan masuk
2. Verify record ada tapi `jam_keluar` = NULL
3. Frontend show: "Belum Scan Pulang"

---

## 🔍 FASE 5: MONITORING & MAINTENANCE (Ongoing)

### Daily Checks

**Morning Routine:**
```bash
# Check device status
ping 192.168.1.201

# Check backend running
curl http://localhost:3333/health

# Quick attendance count hari ini
mysql -u finger_user -pfinger finger_db -e "SELECT COUNT(*) as total_hadir FROM attendance WHERE tanggal = CURDATE();"
```

### Weekly Tasks

1. **Backup Database:**
   ```bash
   mysqldump -u finger_user -pfinger finger_db > backup_$(date +%Y%m%d).sql
   ```

2. **Check Device Storage:**
   - ADMS Software: Device Info → Memory Usage
   - Jika > 80%, clear old logs

3. **Verify Auto-Sync:**
   - Check ADMS logs
   - Ensure no failed syncs

### Troubleshooting Common Issues

**Issue 1: Device Offline**
```bash
ping 192.168.1.201
# Jika timeout → restart device, check WiFi
```

**Issue 2: Data Tidak Masuk Database**
- Check ADMS auto-sync enabled
- Check backend logs for errors
- Manual sync test dari ADMS

**Issue 3: Frontend Tidak Tampil Data**
- Check API response: `curl http://localhost:3333/api/attendance/dosen`
- Check browser console for errors
- Verify date filter di frontend

---

## 📊 MONITORING DASHBOARD

### Quick Stats Queries

```sql
-- Total employees per jabatan
SELECT jabatan, COUNT(*) 
FROM employees 
WHERE is_active = 1 
GROUP BY jabatan;

-- Attendance today
SELECT jabatan, COUNT(*) as hadir_hari_ini
FROM attendance 
WHERE tanggal = CURDATE()
GROUP BY jabatan;

-- Missing checkout today
SELECT nama, jam_masuk
FROM attendance
WHERE tanggal = CURDATE() 
  AND jam_keluar IS NULL;

-- Attendance rate this week
SELECT 
  jabatan,
  COUNT(DISTINCT nip) as total_karyawan,
  COUNT(*) as total_kehadiran,
  ROUND(COUNT(*) / COUNT(DISTINCT nip), 1) as avg_kehadiran_per_hari
FROM attendance
WHERE tanggal >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
GROUP BY jabatan;
```

---

## 🎓 BEST PRACTICES

### 1. Fingerprint Quality
- **Enroll 2 jari** per user (jempol kanan + kiri)
- **Jaga kebersihan sensor** - lap dengan kain microfiber
- **Scan ulang jika reject rate > 5%**

### 2. Network Reliability
- **WiFi stabil** - device dan laptop di jaringan yang sama
- **Static IP** untuk device (192.168.1.201)
- **Firewall exception** untuk port 4370 dan 3333

### 3. Data Integrity
- **Daily backup** database
- **Verify sync** setiap hari
- **Monitor failed transactions** di ADMS logs

### 4. User Training
- **Demo cara scan** yang benar
- **Ingatkan scan 2x** (masuk & pulang)
- **Provide self-service query** (pegawai bisa check sendiri via frontend)

---

## 📞 EMERGENCY CONTACTS & RESOURCES

### Documentation
- Revo W-202BNC Manual: [fingerspot.com/support](https://fingerspot.com/support)
- ADMS Software Guide: Included in installer
- Backend API Docs: `http://localhost:3333/api/scalar`

### Troubleshooting
- Device Issues: Check device menu → System Info → Error Logs
- Backend Issues: Check `Backend-Finger/logs/` directory
- Frontend Issues: Browser DevTools (F12) → Console tab

---

## ✅ CHECKLIST IMPLEMENTASI LENGKAP

```
FASE 1: DATABASE
- [ ] Import 23 pegawai via npm run migrate:legacy
- [ ] Create device mapping via npm run seed:device-mapping
- [ ] Verify dengan npm run verify:migration

FASE 2: HARDWARE
- [ ] Konfigurasi IP device (192.168.1.201)
- [ ] Test ping dari laptop
- [ ] Register 23 user di device (User ID 1-23, PIN 1000-1022)
- [ ] Enroll fingerprint minimal 2 jari per user

FASE 3: ADMS SOFTWARE
- [ ] Install Fingerspot Personnel
- [ ] Add device dengan IP 192.168.1.201:4370
- [ ] Test connection ke device
- [ ] Download user data dari device
- [ ] Configure API push ke http://localhost:3333/adms/push
- [ ] Enable auto-sync (interval 5 menit)
- [ ] Test manual sync

FASE 4: TESTING
- [ ] Test scan fingerprint → verify beep success
- [ ] Check auto-sync ke backend (max 5 menit)
- [ ] Verify data masuk database
- [ ] Check frontend dashboard tampil data
- [ ] Test berbagai skenario (masuk, pulang, lupa scan)

FASE 5: GO LIVE
- [ ] Brief ke semua pegawai cara scan
- [ ] Monitor 1-2 hari pertama intensif
- [ ] Fix issues yang muncul
- [ ] Setup daily backup routine
```

---

**Last Updated:** 2026-02-08  
**Status:** Ready for Implementation  
**Estimated Time:** 2-3 hours total (tergantung jumlah user yang di-register)
