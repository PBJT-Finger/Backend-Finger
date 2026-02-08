# Local Setup Guide - Laptop Windows
## Konfigurasi Lengkap Fingerprint System di Laptop

> **Device:** Revo W-202BNC (FingerBaja)  
> **Device IP:** 172.17.2.250 (Ethernet)  
> **Admin Password:** 233333  
> **Total Pegawai:** 23 (21 DOSEN + 2 KARYAWAN)

---

## 📋 PREREQUISITES CHECKLIST

Pastikan sudah ready:
- [x] Device fingerprint nyala dan terhubung Ethernet
- [x] Laptop dan device di network yang sama
- [x] Ping ke device berhasil: `ping 172.17.2.250`
- [x] Backend running: `npm run dev` (port 3333)
- [x] Frontend running: `npm run start` (port 5173)
- [x] MySQL running dan database `finger_db` exists

---

## 🚀 PHASE 1: UPDATE KONFIGURASI & MIGRATE DATA (15 menit)

### STEP 1.1: Update Device IP di `.env`

```cmd
cd C:\Users\user\Downloads\Finger\Backend-Finger
notepad .env
```

**Cari dan ubah:**
```env
# Line 38-42
FINGERPRINT_IP=172.17.2.250
FINGERPRINT_PORT=4370
FINGERPRINT_TIMEOUT=5000
FINGERPRINT_DEVICE_ID=FingerBaja
```

**Save file** (Ctrl+S)

### STEP 1.2: Restart Backend untuk Apply Config

```cmd
# Di terminal backend (tekan Ctrl+C untuk stop)
# Lalu jalankan lagi:
npm run dev
```

Tunggu sampai muncul:
```
✅ Server running on port 3333
✅ Database connected
```

### STEP 1.3: Migrate 23 Pegawai ke Database

**Buka terminal BARU (Command Prompt):**

```cmd
cd C:\Users\user\Downloads\Finger\Backend-Finger

# 1. Import 23 employees
npm run migrate:legacy

# Expected output:
# ✅ Success: 23 employees imported
# ✅ DOSEN: 21 employees
# ✅ KARYAWAN: 2 employees
```

**Jika berhasil, lanjut:**

```cmd
# 2. Create device mapping table
npm run seed:device-mapping

# Expected output:
# ✅ Success: 23 mappings created
# ✅ Total mappings in database: 23
```

### STEP 1.4: (Optional) Cleanup Dummy Data

**Jika ingin hapus dummy employees (6 DOSEN + 5 KARYAWAN sample):**

```cmd
npm run cleanup:dummy

# Expected output:
# 🗑️ Deleted 11 attendance records
# 🗑️ Deleted 11 employees
# ✅ Cleanup completed!
```

### STEP 1.5: Verify Migration

```cmd
npm run verify:migration

# Expected output:
# 📊 Total Active Employees: 23
# 📊 Breakdown by Jabatan:
#    DOSEN: 21 employees
#    KARYAWAN: 2 employees
# ✅ All 23 employees imported correctly
```

---

## 🔧 PHASE 2: REGISTER USERS DI DEVICE (60-90 menit)

### STEP 2.1: Get Device Mapping List

**Print list mapping untuk reference:**

```cmd
mysql -u finger_user -pfinger finger_db -e "SELECT e.nama, e.jabatan, m.device_user_id, m.device_pin FROM employees e JOIN employee_device_mapping m ON e.nip = m.nip WHERE e.tanggal_masuk = '2024-10-03' ORDER BY CAST(m.device_pin AS UNSIGNED);"
```

**Atau buka MySQL Workbench dan run:**
```sql
SELECT 
  e.nama AS 'Nama Pegawai',
  e.jabatan AS 'Jabatan',
  m.device_user_id AS 'User ID',
  m.device_pin AS 'PIN Device'
FROM employees e
JOIN employee_device_mapping m ON e.nip = m.nip
WHERE e.tanggal_masuk = '2024-10-03'
ORDER BY CAST(m.device_pin AS UNSIGNED);
```

**Save hasil query ini atau print untuk dibawa ke device!**

### STEP 2.2: Register User di Device (Manual)

**Untuk SETIAP pegawai (23 orang), lakukan:**

**Di Device Fingerprint:**

1. **Masuk Menu:**
   - Tekan `MENU`
   - Login admin (password: `233333`)

2. **User Management:**
   - Navigate: `User Mgmt` → `Add New User`

3. **Isi Data User #1 (Slamet Riyadi):**
   ```
   User ID: 1
   PIN: 1000
   Name: Slamet Riyadi, M.T  (max 24 karakter)
   Password: [kosongkan]
   Card No: [kosongkan]
   Privilege: User (bukan Admin)
   ```

4. **Enroll Fingerprint:**
   - Pilih: `Fingerprint` → `Enroll FP`
   - Device akan minta scan jari 3x untuk 1 jari
   - **Recommended:** Enroll 2 jari (Jempol kanan + jempol kiri)
   
   **Proses:**
   ```
   Scan jari #1:
   - Letakkan jempol kanan di sensor
   - Device beep → angkat jari
   - Ulangi 2x lagi
   - Device: "FP 1 Registered" ✅
   
   Scan jari #2:
   - Letakkan jempol kiri di sensor
   - Ulangi 3x
   - Device: "FP 2 Registered" ✅
   ```

5. **Test Verification:**
   - Exit menu (Back to main screen)
   - Scan jempol yang sudah dienroll
   - Device harus beep dan tampilkan nama: "Slamet Riyadi, M.T" ✅

6. **Ulangi untuk 22 pegawai lainnya:**

**TIPS untuk mempercepat:**
- Batch registrasi: panggil pegawai per 5-10 orang
- Queue system: 1 orang di device, 4-9 orang antri
- Time estimate: ~3-5 menit per orang = 75-115 menit total

**Data Pegawai (Reference):**

| No | Nama | User ID | PIN | Jabatan |
|----|------|---------|-----|---------|
| 1 | Slamet Riyadi, M.T | 1 | 1000 | DOSEN |
| 2 | Sendie Yuliarto Margen, M.T | 2 | 1001 | DOSEN |
| 3 | Lily Budinurani, M.Pd | 3 | 1002 | DOSEN |
| ... | ... | ... | ... | ... |
| 22 | Dede Harisma | 22 | 1021 | KARYAWAN |
| 23 | Danil Firmansyah | 23 | 1022 | KARYAWAN |

*(Lihat query result untuk full list)*

---

## 📱 PHASE 3: INSTALL & SETUP ADMS SOFTWARE (30 menit)

### STEP 3.1: Download Fingerspot Personnel

**Option A: Official Website**
1. Go to: https://fingerspot.com/downloads
2. Download: **Fingerspot Personnel** (Desktop version)
3. Pilih versi: Windows 10/11 64-bit

**Option B: Alternative (jika website down)**
- Search: "Fingerspot Personnel download"
- Atau gunakan software lain yang support ZKTeco protocol

### STEP 3.2: Install Software

```cmd
# Run installer as Administrator
Right-click installer → Run as Administrator

# Follow wizard:
1. Accept license
2. Installation path: C:\Program Files\Fingerspot\Personnel
3. Install
4. Finish (jangan launch dulu)
```

### STEP 3.3: Launch & Initial Setup

```cmd
# Launch as Administrator (important!)
Right-click → Run as Administrator
```

**First Launch:**
1. Create database (jika diminta): Local SQLite atau MySQL
2. Create admin account untuk ADMS software
3. Skip wizard/tutorial

### STEP 3.4: Add Device FingerBaja

**Di ADMS Software:**

1. **Menu:** `Device` → `Device Management` → `Add New Device`

2. **Isi Konfigurasi:**
   ```
   Device Name: FingerBaja
   Device Type: W-202 Series / W-202BNC
   Connection Type: TCP/IP
   
   IP Address: 172.17.2.250
   Port: 4370
   Comm Password: [kosongkan]
   
   Device ID: 1
   Serial Number: [optional]
   ```

3. **Test Connection:**
   - Click `Test Connection`
   - **Expected:** "Connection Successful ✅"
   - Jika gagal: Check firewall, ping device, verify IP

4. **Save Device**

### STEP 3.5: Download User Data dari Device

**Sync user yang sudah di-register:**

1. **Menu:** `User` → `Download from Device`
2. **Select:** Device FingerBaja
3. **Click:** `Download All Users`
4. **Wait:** ~10-30 detik (tergantung jumlah user)
5. **Verify:** Harus muncul 23 users di ADMS software

### STEP 3.6: Configure API Push ke Backend

**Setup auto-push ke backend API:**

1. **Menu:** `Settings` → `Integration` → `API Configuration`

   (Atau `Tools` → `API Push Settings`)

2. **Isi Konfigurasi:**
   ```
   Enable API Push: ✓ (checked)
   
   Backend URL: http://localhost:3333/adms/push
   (Atau: http://172.17.2.59:3333/adms/push jika berbeda)
   
   Method: POST
   Content-Type: application/json
   
   API Key: [kosongkan dulu] (optional untuk production)
   
   Auto Sync: ✓ (enabled)
   Sync Interval: 5 minutes
   
   Sync on Event: ✓ (enabled - langsung push saat ada absensi baru)
   ```

3. **Test API Connection:**
   - Click `Test` atau `Test Connection`
   - Backend harus running!
   - **Expected:** "200 OK - Connection successful"

4. **Save Configuration**

---

## ✅ PHASE 4: TESTING END-TO-END (20 menit)

### STEP 4.1: Test Manual Attendance Scan

**Simulasi absensi:**

1. **Scan fingerprint di device FingerBaja:**
   - Misal: Slamet Riyadi scan jempol
   - Device beep: "Slamet Riyadi, M.T"
   - Device tampilkan: Check-in atau Check-out
   - Catat waktu scan

2. **Tunggu Auto-Sync (max 5 menit):**
   - ADMS software akan auto-download dari device
   - ADMS akan auto-push ke backend
   
   **Atau manual sync:**
   - ADMS Menu: `Attendance` → `Download from Device`
   - Select date: Today
   - Click `Download`
   - Data akan otomatis di-push ke backend

### STEP 4.2: Verify di Backend Logs

**Check terminal backend:**

```
[INFO] Attendance pushed from ADMS device
  device_id: FingerBaja
  user_id: 1
  nip: 850019763
  nama: Slamet Riyadi, M.T
  tipe_absensi: MASUK
  tanggal: 2026-02-08
  waktu: 08:15:30
[INFO] Attendance recorded successfully
```

### STEP 4.3: Verify di Database

```cmd
mysql -u finger_user -pfinger finger_db -e "SELECT nip, nama, tanggal, jam_masuk, jam_keluar, status FROM attendance WHERE tanggal = CURDATE() ORDER BY created_at DESC LIMIT 5;"
```

**Expected:** Ada record baru dengan data yang sesuai

### STEP 4.4: Verify di Frontend Dashboard

**Buka browser:**
```
http://localhost:5173
```

1. **Navigate ke halaman:**
   - Klik `Dosen` (jika yang scan adalah dosen)
   - Atau `Karyawan` (jika karyawan)

2. **Filter:**
   - Set date: Hari ini
   - Click `Filter` atau `Search`

3. **Verify:**
   - Data attendance harus muncul ✅
   - NIP: 850019763
   - Nama: Slamet Riyadi, M.T
   - Jam Masuk: 08:15:30
   - Status: HADIR

### STEP 4.5: Test Scan Pulang (Jam Keluar)

1. **Scan lagi** fingerprint yang sama (Slamet Riyadi)
2. Device: Check-out
3. Tunggu auto-sync atau manual sync
4. **Verify di frontend:**
   - **PENTING:** Harus UPDATE record yang sama (bukan create baru!)
   - Jam Keluar harus terisi: misal 16:30:00
   - Durasi kerja: ~8 jam

### STEP 4.6: Test Multiple Users

**Scan fingerprint 3-5 pegawai berbeda:**
- Mix: DOSEN dan KARYAWAN
- Check semua data masuk dengan benar
- Verify jabatan auto-detect dari NIP

---

## 🎯 PHASE 5: VERIFICATION LENGKAP (10 menit)

### Checklist Final:

```
✅ Database Migration
   [ ] 23 employees imported (21 DOSEN + 2 KARYAWAN)
   [ ] Device mapping 23 records created
   [ ] Dummy data cleaned (optional)

✅ Device Registration
   [ ] 23 users registered di device
   [ ] Minimal 2 fingerprint per user enrolled
   [ ] Test scan berhasil tampilkan nama

✅ ADMS Software
   [ ] FingerBaja device connected
   [ ] 23 users downloaded from device
   [ ] API push configured (localhost:3333/adms/push)
   [ ] Test connection berhasil (200 OK)

✅ End-to-End Test
   [ ] Scan fingerprint → Device beep success
   [ ] Auto-sync dalam 5 menit (atau manual sync berhasil)
   [ ] Data masuk database (verify via MySQL)
   [ ] Data tampil di frontend dashboard
   [ ] Jam masuk recorded
   [ ] Jam keluar update (bukan create new)

✅ Backend & Frontend
   [ ] Backend running without errors
   [ ] Frontend accessible (localhost:5173)
   [ ] API endpoints working (/api/attendance/dosen, /karyawan)
   [ ] CORS configured properly
```

---

## 📊 MONITORING & MAINTENANCE

### Daily Checks:

```cmd
# 1. Check device online
ping 172.17.2.250

# 2. Check backend running
curl http://localhost:3333/health

# 3. Quick attendance count today
mysql -u finger_user -pfinger finger_db -e "SELECT COUNT(*) as hadir_hari_ini FROM attendance WHERE tanggal = CURDATE();"
```

### Weekly Tasks:

```cmd
# 1. Backup database
mysqldump -u finger_user -pfinger finger_db > backup_finger_$(date +%Y%m%d).sql

# 2. Check ADMS sync logs (di software)

# 3. Verify no failed syncs
```

---

## 🐛 TROUBLESHOOTING UMUM

### Problem: "Employee with NIP xxx not found"

**Solution:**
```cmd
# Verify employee exists
mysql -u finger_user -pfinger finger_db -e "SELECT * FROM employees WHERE nip = 'xxx';"

# If not exists, run migration lagi
npm run migrate:legacy
```

### Problem: ADMS tidak push ke backend

**Check:**
1. Backend running? `curl http://localhost:3333/health`
2. ADMS API URL benar? `http://localhost:3333/adms/push`
3. Firewall block? Disable temporary untuk test
4. Backend logs ada error?

**Manual test:**
```cmd
curl -X POST http://localhost:3333/adms/push -H "Content-Type: application/json" -d "{\"user_id\":\"1\",\"nip\":\"850019763\",\"nama\":\"Test\",\"tanggal_absensi\":\"2026-02-08\",\"waktu_absensi\":\"08:00:00\",\"tipe_absensi\":\"MASUK\",\"device_id\":\"FingerBaja\"}"
```

### Problem: Jam keluar create record baru (tidak update)

**Cause:** Logic di backend check existing record by date+NIP

**Check:**
```sql
SELECT * FROM attendance WHERE nip = '850019763' AND tanggal = CURDATE();
```

Harus 1 record untuk 1 hari per pegawai.

---

## 📞 SUPPORT

**Documentation:**
- Implementation Guide: [`IMPLEMENTATION_GUIDE.md`](file:///C:/Users/user/Downloads/Finger/Backend-Finger/IMPLEMENTATION_GUIDE.md)
- Network Troubleshooting: [`TROUBLESHOOTING_NETWORK.md`](file:///C:/Users/user/Downloads/Finger/Backend-Finger/TROUBLESHOOTING_NETWORK.md)
- Production Deployment: [`PRODUCTION_DEPLOYMENT.md`](file:///C:/Users/user/Downloads/Finger/Backend-Finger/PRODUCTION_DEPLOYMENT.md)

**API Documentation:**
```
http://localhost:3333/api/scalar
```

---

**Created:** 2026-02-08  
**Device:** Revo W-202BNC (FingerBaja) @ 172.17.2.250  
**Status:** Ready for Local Setup
