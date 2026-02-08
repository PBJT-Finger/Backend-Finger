# Troubleshooting: Network Connectivity Issue
## Fingerprint Device Tidak Dapat Dijangkau

### 🔴 PROBLEM

**Error saat ping:**
```
C:\Users\user> ping 192.168.110.102

Reply from 192.168.110.59: Destination host unreachable.
Reply from 192.168.110.59: Destination host unreachable.
```

**Konfigurasi:**
- Laptop IP: `192.168.110.59`
- Device IP: `192.168.110.102`
- Gateway: `192.168.110.1`
- Admin Password: `233333`

**Root Cause:** Laptop tidak dapat menemukan route ke device fingerprint.

---

## 🔍 DIAGNOSTIC STEPS

### STEP 1: Verify Device Power & Network

**Check fisik:**
```
✓ Device nyala (ada lampu indikator)?
✓ Kabel LAN terhubung (jika pakai Ethernet)?
✓ WiFi LED berkedip (jika pakai WiFi)?
```

**Action:**
1. Pastikan device **benar-benar nyala**
2. Jika pakai **WiFi**: pastikan device sudah terhubung ke network yang sama
3. Jika pakai **Ethernet**: pastikan kabel terpasang dengan baik ke switch/router yang sama dengan laptop

---

### STEP 2: Check Network Configuration di Device

**Masuk ke Menu Device:**
1. Tekan `MENU` di device
2. Login admin (password: `233333`)
3. Navigate: `System` → `Communication` → `Network`

**Verify Settings:**
```
IP Address: 192.168.110.102  ✓ (sudah benar)
Subnet Mask: 255.255.255.0   ✓ (harus sama dengan laptop)
Gateway: 192.168.110.1       ✓ (harus sama dengan laptop)
DNS: 192.168.110.1
Connection Mode: [pilih salah satu]
  - Static IP (recommended) ← GUNAKAN INI
  - DHCP
```

**PENTING:** Pastikan gunakan **Static IP**, bukan DHCP!

**Action jika salah:**
- Set ulang IP ke `192.168.110.102`
- Set Connection Mode ke **Static IP**
- **Restart device** (Save → Reboot)
- Tunggu 30 detik
- Test ping lagi

---

### STEP 3: Check Laptop Network Configuration

**Dapatkan info network laptop:**

```cmd
ipconfig /all
```

**Expected Output:**
```
Ethernet adapter Ethernet:
   IPv4 Address: 192.168.110.59
   Subnet Mask: 255.255.255.0
   Default Gateway: 192.168.110.1

atau

Wireless LAN adapter Wi-Fi:
   IPv4 Address: 192.168.110.59
   Subnet Mask: 255.255.255.0
   Default Gateway: 192.168.110.1
```

**Verify:**
```
✓ IP laptop: 192.168.110.x (harus di subnet yang sama)
✓ Subnet: 255.255.255.0 (harus sama)
✓ Gateway: 192.168.110.1 (harus sama)
✓ Connection: Ethernet atau WiFi (keduanya harus ke network/router yang sama)
```

**⚠️ COMMON ISSUE:**
Jika laptop pakai **WiFi** tapi device pakai **Ethernet** (atau sebaliknya), pastikan keduanya terhubung ke **router/switch yang sama**!

---

### STEP 4: Test Network Path

**Check Gateway reachable:**

```cmd
ping 192.168.110.1
```

**Expected:**
```
Reply from 192.168.110.1: bytes=32 time<1ms
✅ Gateway OK
```

**Jika gateway TIDAK bisa di-ping:**
- Router/gateway bermasalah
- Laptop tidak terhubung ke jaringan dengan benar
- Periksa koneksi fisik (kabel/WiFi)

**Check Other Devices di Network:**

```cmd
ping 192.168.110.1    # Gateway/router
ping 192.168.110.50   # Device lain (jika ada)
```

Jika semua device lain **BISA** di-ping, tapi fingerprint **TIDAK**, berarti masalah di device fingerprint.

---

### STEP 5: Check ARP Table

**Lihat ARP cache laptop:**

```cmd
arp -a | findstr "192.168.110"
```

**Cari entry untuk 192.168.110.102:**

**Jika TIDAK ADA:**
- Device belum pernah berkomunikasi dengan laptop
- Device mungkin tidak terhubung ke network

**Jika ADA tapi incomplete/invalid:**
```cmd
# Clear ARP cache
arp -d 192.168.110.102

# Flush semua
netsh interface ip delete arpcache

# Try ping lagi
ping 192.168.110.102
```

---

### STEP 6: Check Windows Firewall

**Temporary disable firewall untuk test:**

```powershell
# Run as Administrator
netsh advfirewall set allprofiles state off
```

**Test ping:**
```cmd
ping 192.168.110.102
```

**Jika BERHASIL setelah firewall off:**
- Firewall memblokir ICMP
- Re-enable firewall dan buat exception

**Re-enable firewall:**
```powershell
netsh advfirewall set allprofiles state on

# Allow ICMP (ping)
netsh advfirewall firewall add rule name="Allow Ping" protocol=icmpv4:8,any dir=in action=allow
```

---

### STEP 7: Check Connection Type Mismatch

**SANGAT PENTING:**

```
Laptop WiFi → Router → Device Ethernet  ✓ OK (jika satu router)
Laptop WiFi → Router A
Device Ethernet → Router B              ✗ TIDAK AKAN CONNECT!

Laptop Ethernet → Switch → Device Ethernet  ✓ OK
Laptop WiFi → Device WiFi (sama SSID)        ✓ OK
```

**Action:**
1. **Cek phone/laptop lain** yang sudah terhubung ke WiFi yang sama
2. Ping device dari phone tersebut (gunakan app "Network Analyzer" atau "Fing")
3. Jika dari phone **BISA** ping device, tapi dari laptop **TIDAK**, masalah di laptop
4. Jika dari phone **JUGA TIDAK BISA**, masalah di device atau network

---

## ✅ SOLUTIONS BY SCENARIO

### Scenario 1: Device Belum Terhubung ke Network

**Symptoms:**
- Device WiFi LED mati atau tidak berkedip
- Tidak ada device lain yang bisa ping ke 192.168.110.102

**Solution:**
1. Masuk menu device → `System` → `Communication` → `WiFi`
2. Scan dan pilih SSID WiFi Anda
3. Masukkan password WiFi
4. Save dan tunggu device connect
5. Verify WiFi LED berkedip
6. Test ping lagi

### Scenario 2: Device Pakai DHCP, IP Berubah

**Symptoms:**
- Device kadang bisa di-ping, kadang tidak
- IP device berubah-ubah

**Solution:**
1. Masuk menu device
2. Navigate: `System` → `Communication` → `Network`
3. Ubah dari **DHCP** ke **Static IP**
4. Set IP: `192.168.110.102`
5. Save dan Restart
6. Test ping

### Scenario 3: Laptop dan Device di Network Berbeda

**Symptoms:**
- Ping selalu "Destination host unreachable"
- Gateway laptop dan gateway device berbeda

**Solution:**
1. **Pastikan keduanya di WiFi yang sama** ATAU
2. **Pastikan keduanya di switch/router yang sama**
3. Jangan:
   - Laptop → WiFi Router A
   - Device → Ethernet Router B
   
### Scenario 4: IP Conflict

**Symptoms:**
- Kadang bisa ping, kadang tidak
- ARP table menunjukkan MAC address yang berubah

**Solution:**
```cmd
# Cek conflict
arp -a | findstr "192.168.110.102"

# Jika ada 2 MAC address berbeda untuk IP yang sama:
# 1. Matikan device fingerprint
# 2. Ping lagi - jika masih reply, ada device lain pakai IP yang sama
# 3. Ubah IP device ke yang lain, misalnya 192.168.110.105
```

---

## 🚀 QUICK FIX CHECKLIST

Coba langkah-langkah ini secara berurutan:

```
[ ] 1. Restart device fingerprint (cabut power 10 detik, colok lagi)
[ ] 2. Tunggu 30 detik device booting
[ ] 3. Ping lagi: ping 192.168.110.102
[ ] 4. Jika masih gagal: Flush ARP cache laptop
        arp -d
        netsh interface ip delete arpcache
[ ] 5. Ping lagi
[ ] 6. Jika masih gagal: Check device menu
        - Verify IP: 192.168.110.102
        - Verify Static IP (bukan DHCP)
        - Check WiFi/Ethernet LED nyala
[ ] 7. Restart router (jika perlu)
[ ] 8. Verify laptop dan device di network yang sama
```

---

## 🔧 ALTERNATIVE: Gunakan DHCP Mode (Temporary)

Jika Static IP terus bermasalah:

**1. Set Device ke DHCP Mode:**
- Menu device → `Network` → `Connection Mode: DHCP`
- Save dan Restart

**2. Find Device IP via Router Admin:**
- Login ke router (biasanya 192.168.110.1)
- Cek DHCP Client List
- Cari device dengan nama "W-202BNC" atau MAC address device
- Catat IP yang didapat (misal: 192.168.110.150)

**3. Ping IP Baru:**
```cmd
ping 192.168.110.150
```

**4. Jika Berhasil:**
- Gunakan IP ini untuk ADMS configuration
- Atau set Static IP ke IP yang berhasil ini

---

## 📞 NEXT STEPS SETELAH PING BERHASIL

Setelah ping berhasil (`Reply from 192.168.110.102: bytes=32`):

1. ✅ Update `.env` file:
   ```env
   FINGERPRINT_IP=192.168.110.102
   FINGERPRINT_PORT=4370
   ```

2. ✅ Test dengan zklib (jika ada):
   ```bash
   node scripts/test-device-connection.js
   ```

3. ✅ Proceed ke konfigurasi ADMS

---

**Created:** 2026-02-08  
**Last Updated:** 11:33 WIB  
**Status:** Diagnostic Guide
