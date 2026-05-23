# 📓 Catatan Lokal — backend-finger-x100c

**Terakhir diperbarui:** 2026-05-21  
**Environment:** Local Development (Windows)

---

## 📁 Struktur Project

```
backend-finger-x100c/
├── backend-finger/         ← Node.js Express API (TypeScript)
├── frontend-finger/        ← React + Vite + TailwindCSS
├── masterplan.md           ← Rencana migrasi JS → TypeScript (referensi)
├── note.md                 ← Arsitektur Edge-to-Web (referensi)
└── notelocal.md            ← File ini
```

---

## 🏗️ Stack Teknologi

| Layer | Teknologi |
|---|---|
| Backend Runtime | Node.js 18+, TypeScript strict mode |
| Framework | Express 4.x |
| ORM | Prisma 6 + MySQL |
| Hardware Bridge | `node-zklib` (custom ZkTcpClient wrapper) |
| Auth | JWT (access 15m + refresh 7d) |
| Logging | Winston JSON structured |
| Metrics | prom-client (Prometheus) |
| Frontend | React 19 + Vite 8 + TailwindCSS 4 |
| Frontend State | useState + custom hooks |
| Real-time | SSE (Server-Sent Events) |

---

## ⚙️ Cara Menjalankan Lokal

### Backend

```bash
cd backend-finger

# Install dependencies (sudah ada node_modules, skip jika tidak berubah)
npm install

# Jalankan dev server
npm run dev
# → Server berjalan di http://localhost:3333
# → Swagger docs: http://localhost:3333/finger-api/docs
```

### Frontend

```bash
cd frontend-finger

# Install dependencies
npm install

# Jalankan dev server
npm run dev
# → Frontend berjalan di http://localhost:5173 (atau port lain dari Vite)
```

### Environment Variables Backend

File `.env` di `backend-finger/`:

```env
# Database
DATABASE_URL="mysql://finger_user:finger@localhost:3306/finger_db"
DB_HOST=localhost
DB_PORT=3306
DB_NAME=finger_db
DB_USERNAME=finger_user
DB_PASSWORD=finger

# JWT
JWT_ACCESS_SECRET=your_secret_here
JWT_REFRESH_SECRET=your_refresh_secret_here
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Server
PORT=3333
NODE_ENV=development

# ZKTeco Device
FINGERPRINT_IP=192.168.137.15
FINGERPRINT_PORT=4370
FINGERPRINT_TIMEOUT=10000
POLLING_INTERVAL_MS=5000
RECONNECT_DELAY_MS=8000

# Security
API_KEY_SECRET=your_api_key_secret
CORS_ORIGINS=http://localhost:5555,http://localhost:3000,http://localhost:5173
```

### Environment Variables Frontend

File `.env` di `frontend-finger/`:

```env
VITE_API_BASE_URL=http://localhost:3333
```

---

## 🗃️ Database

**Engine:** MySQL  
**Database:** `finger_db`

### Setup DB dari seed

```bash
cd backend-finger

# Import seed data
npm run db:setup

# Atau import data hari ini
npm run db:import-today
```

### Tabel Utama

| Tabel | Fungsi |
|---|---|
| `admins` | User login sistem (bukan karyawan) |
| `employees` | Master data karyawan (NIP, nama, jabatan, shift) |
| `shifts` | Data shift kerja (jam_masuk, jam_keluar) |
| `attendance` | Log absensi (jam_masuk, jam_keluar, status) |
| `devices` | Registrasi alat fingerprint |
| `employee_device_mapping` | Jembatan NIP ↔ device_user_id alat |
| `password_resets` | Token reset password admin |

### Relasi Penting

```
employees (nip) ←──── employee_device_mapping ────→ device_user_id (di alat)
employees (shift_id) ───→ shifts (id)
admins (id) ←───── password_resets (admin_id)
```

---

## 🔑 API Authentication

Semua endpoint kecuali `/health`, `/api/auth/login`, `/api/device/stream` membutuhkan JWT.

### Login

```bash
POST http://localhost:3333/api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "password123"
}

# Response:
{
  "success": true,
  "data": {
    "tokens": {
      "access_token": "eyJhbGc...",
      "refresh_token": "eyJhbGc..."
    }
  }
}
```

**Simpan `access_token` untuk dipakai di header:**

```
Authorization: Bearer eyJhbGc...
```

---

## 🔌 Alat Fingerprint (ZKTeco X100-C)

- **IP:** `192.168.137.15`
- **Port:** `4370` (UDP/TCP proprietary ZKTeco protocol)
- **Library:** Custom `ZkTcpClient` di `src/infrastructure/zklib/tcp-client.ts`

### Cara Kerja Polling

1. Server start → `ZkDeviceClient.start()` dipanggil di `server.ts`
2. Setiap `POLLING_INTERVAL_MS` (default 5 detik), server konek ke alat
3. Ambil semua attendance log dari alat
4. Bandingkan dengan `lastKnownLogCount` → emit hanya record BARU
5. `ZkSyncService` listen event → simpan ke DB via Prisma
6. `device.stream.controller.ts` broadcast ke browser via SSE

### Scripts Utilitas Alat

```bash
# Cek koneksi ke alat
npm run device:probe

# Tarik semua user dari alat ke DB (bulk sync)
npm run sync:attendance

# Seed mapping device user → NIP
npm run seed:device-mapping

# Tambah karyawan baru
npm run employee:add
```

---

## 🆕 Fitur: Manajemen Pengguna Alat (Baru — 2026-05-21)

### Latar Belakang Masalah

Ketika karyawan baru pertama kali scan di alat fingerprint, namanya tampil sebagai **angka** (misal: "Karyawan 12") di web karena:

1. Alat menyimpan user dengan `userId` (angka, misal: "12") + nama
2. Sistem web punya tabel `employee_device_mapping` yang menjembatani `device_user_id` → `NIP`
3. Jika mapping belum ada → sistem fallback ke `nip = "12"` dan `nama = "Karyawan 12"`

### Root Cause (di `zk-sync.service.ts`)

```
scan alat → device_user_id = "12"
    ↓ cari employee_device_mapping WHERE device_user_id = "12"
    ↓ ❌ TIDAK ADA
    nip = "12"
    ↓ cari employees WHERE nip = "12"
    ↓ ❌ TIDAK ADA
    nama = "Karyawan 12"
    ↓ simpan ke attendance ← tampil sebagai angka!
```

### Solusi yang Diimplementasi

Fitur baru **"Manajemen Pengguna Alat"** di web frontend yang memungkinkan admin:
1. **Menarik** daftar semua user dari alat fingerprint (via cache polling)
2. **Melihat** status registrasi tiap user (Terdaftar / Belum Terdaftar / Tidak Lengkap)
3. **Mendaftarkan** user yang belum terdaftar dengan form sederhana
4. Record absensi lama yang berupa angka **otomatis diperbarui** setelah pendaftaran

---

## 📂 File yang Dibuat/Dimodifikasi (Fitur Baru)

### Backend

#### 1. `backend-finger/src/infrastructure/zk-client.ts` ← DIMODIFIKASI

**Perubahan:**
- Tambah interface `CachedDeviceUser` (uid, userId, name, role, cardno)
- Ubah `deviceUserCache` dari `Map<string, string>` menjadi `Map<string, CachedDeviceUser>`
- Tambah method publik `getCachedUsers(): CachedDeviceUser[]`
- Update `getDeviceUserName()` untuk baca dari cache baru

**Kenapa:** Service layer butuh data lengkap user (bukan hanya nama) untuk ditampilkan di frontend tanpa membuat koneksi ZK kedua yang bisa corrupt polling loop.

---

#### 2. `backend-finger/src/services/device.users.service.ts` ← BARU

**Class:** `DeviceUsersService`

**Method `getDeviceUsersWithStatus()`:**
- Baca `getCachedUsers()` dari singleton `ZkDeviceClient` (tanpa koneksi baru)
- Batch query `employee_device_mapping` untuk semua `device_user_id` yang ada di cache
- Batch query `employees` untuk semua NIP yang ter-mapping
- Gabungkan dan return status tiap user:
  - `registered` → mapping ada + employee aktif
  - `unregistered` → tidak ada mapping
  - `partial` → mapping ada tapi employee hilang/non-aktif

**Method `registerDeviceUser(dto)`:**
- Validasi `deviceUserId` ada di cache
- Cek tidak ada konflik mapping yang sudah ada
- DB Transaction: create employee (jika baru) + create mapping
- Patch attendance lama yang orphan (nama angka → nama benar)

**Method `patchOrphanAttendanceRecords()` (private):**
- `UPDATE attendance SET nip=?, nama=?, jabatan=? WHERE user_id=? AND nip=? AND is_deleted=false`
- Non-fatal: jika gagal, log error tapi tidak crash proses registrasi

---

#### 3. `backend-finger/src/controllers/device.users.controller.ts` ← BARU

**Class:** `DeviceUsersController`

| Method | Endpoint | Deskripsi |
|---|---|---|
| `pullDeviceUsers` | `GET /api/device/users/pull` | List semua user alat + status DB |
| `registerDeviceUser` | `POST /api/device/users/register` | Daftarkan user ke sistem |

**Validasi input `registerDeviceUser`:**
- `deviceUserId`: string, tidak kosong
- `nip`: string, max 50 karakter
- `nama`: string, tidak kosong
- `jabatan`: harus `"DOSEN"` atau `"KARYAWAN"`
- `shiftId`: angka positif

**Error mapping:**
- `400` → validasi gagal atau device user tidak di cache
- `409` → konflik (user sudah terdaftar / NIP sudah dipetakan ke user lain)
- `500` → error tak terduga

---

#### 4. `backend-finger/src/routes/device.routes.ts` ← DIMODIFIKASI

Route baru yang ditambahkan:

```
GET  /api/device/users/pull     → DeviceUsersController.pullDeviceUsers
POST /api/device/users/register → DeviceUsersController.registerDeviceUser
GET  /api/device/shifts         → Query prisma.shifts (untuk dropdown form)
```

> ⚠️ **Penting:** Route `/users/pull` dan `/users/register` harus dideklarasikan **sebelum** `router.use(authenticateToken)` dan route `/:id` untuk mencegah Express mencocokkan string literal `/users` ke parameter `/:id`.

---

### Frontend

#### 5. `frontend-finger/src/api/deviceUsers.ts` ← BARU

Type-safe API client layer. Semua `fetch` call terpusat di sini.

**Functions:**
```typescript
pullDeviceUsers(token: string): Promise<PullResponse>
registerDeviceUser(token: string, dto: RegisterDto): Promise<RegisterResponse>
fetchShifts(token: string): Promise<ShiftOption[]>
```

**Types:**
```typescript
type RegistrationStatus = 'registered' | 'unregistered' | 'partial';

interface DeviceUserRow {
  uid: number;
  userId: string;
  name: string;
  role: number;
  cardno: number;
  registrationStatus: RegistrationStatus;
  mappedNip: string | null;
  employeeNama: string | null;
  employeeJabatan: string | null;
}

interface RegisterDto {
  deviceUserId: string;
  nip: string;
  nama: string;
  jabatan: 'DOSEN' | 'KARYAWAN';
  shiftId: number;
}
```

---

#### 6. `frontend-finger/src/hooks/useDeviceUsers.ts` ← BARU

Custom hook untuk state management panel manajemen pengguna.

**State:**
```typescript
pullState: 'idle' | 'loading' | 'loaded' | 'error'
registerState: 'idle' | 'loading' | 'success' | 'error'
users: DeviceUserRow[]
summary: { registered: N, unregistered: N, partial: N }
shifts: ShiftOption[]
```

**Fitur:**
- Pull dan shifts di-fetch secara parallel (`Promise.all`)
- Optimistic UI update setelah registrasi berhasil (tidak perlu re-fetch)
- Summary counter diperbarui otomatis setelah registrasi

---

#### 7. `frontend-finger/src/components/DeviceUsersPanel.tsx` ← BARU

Komponen halaman lengkap dengan:

**Header Bar:**
- Tombol "Tarik Data dari Alat" (loading state)
- Status device pill (Online/Offline/Connecting)

**Summary Cards (clickable filter):**
- Total di Alat | Terdaftar | Belum Terdaftar | Tidak Lengkap
- Klik card → filter tabel

**Tabel Pengguna:**
| Kolom | Keterangan |
|---|---|
| # | Nomor urut |
| User ID Alat | Device user ID (angka dari alat) |
| Nama di Alat | Nama yang tersimpan di alat |
| Status | Badge warna (Terdaftar/Belum/Tidak Lengkap) |
| NIP Terdaftar | NIP yang sudah dipetakan (null jika belum) |
| Nama di Sistem | Nama dari tabel employees (null jika belum) |
| Jabatan | DOSEN/KARYAWAN (null jika belum) |
| Aksi | Tombol "Daftarkan" (hanya muncul jika belum registered) |

**Modal Registrasi:**
- Pre-fill nama dari alat (bisa diedit)
- Dropdown jabatan (DOSEN/KARYAWAN)
- Dropdown shift (dari `GET /api/device/shifts`)
- Input NIP manual
- Info banner: "record lama akan otomatis diperbarui"
- Success state dengan animasi checkmark

---

#### 8. `frontend-finger/src/App.tsx` ← DIMODIFIKASI

**Perubahan:**
- Tambah `type AppTab = 'monitor' | 'device-users'`
- Tambah state `activeTab`, `token`, `showTokenInput`, `tokenDraft`
- Token disimpan ke `localStorage` dengan key `dev_access_token`
- Tab navigation bar di bawah header (2 tab)
- Tombol **"Set Token"** di pojok kanan atas untuk memasukkan JWT lokal
- Conditional rendering: tab monitor atau tab device-users

---

## 🔄 Alur Penggunaan Fitur Baru

```
1. Login via API → dapat access_token
         ↓
2. Di web klik "Set Token" → paste token → Simpan
         ↓
3. Klik tab "Manajemen Pengguna Alat"
         ↓
4. Klik "Tarik Data dari Alat"
         ↓ (GET /api/device/users/pull)
5. Tabel muncul — cari yang status "Belum Terdaftar"
         ↓
6. Klik "Daftarkan" pada baris user tersebut
         ↓
7. Modal muncul dengan nama pre-filled dari alat
8. Isi NIP, konfirmasi nama, pilih jabatan & shift
9. Klik "Daftarkan"
         ↓ (POST /api/device/users/register)
10. Sukses → status berubah menjadi "Terdaftar" (optimistic update)
11. Record absensi lama (nama angka) otomatis diperbarui di DB
12. Mulai sekarang scan berikutnya akan tampil dengan nama benar
```

---

## 📋 Status Sprint (dari masterplan.md)

| Sprint | Status | Keterangan |
|---|---|---|
| Sprint 0 — Foundation TypeScript | ✅ Selesai | tsx watch, tsconfig strict |
| Sprint 1 — ZkDeviceClient | ✅ Selesai | polling, reconnect, zk-sync.service |
| Sprint 2 — Utils & Middlewares | ✅ Selesai | logger, errors, auth middleware |
| Sprint 3 — Services Conversion | ✅ Selesai | attendance, email, export service |
| Sprint 4 — Controllers (device) | ⚠️ Partial | `getDevices()` ok, 5 method lain masih 501 |
| Sprint 5 — Wiring & Build | ⚠️ Partial | server.ts ok, health endpoint belum expose deviceStatus |

---

## ❗ Outstanding Tasks (Belum Dikerjakan)

### Priority 1 — Kritis

| # | Task | File | Dampak |
|---|---|---|---|
| 1 | Implement 5 method device.controller.ts yang masih 501 | `src/controllers/device.controller.ts` | CRUD device tidak bisa dipakai |
| 2 | Tambah `@@unique([nip, tanggal])` di attendance schema | `prisma/schema.prisma` + migration | Idempotency bergantung aplikasi saja, rentan race condition |
| 3 | Fix `error: any` di server.ts | `src/server.ts` | Melanggar strict TypeScript |
| 4 | Tambah `zkClient.stop()` di graceful shutdown | `src/server.ts` | Koneksi ZK tidak dibersihkan saat server mati |

### Priority 2 — Stabilitas

| # | Task | File |
|---|---|---|
| 5 | Update `/health` expose `deviceStatus` + `lastSyncCount` | `src/routes/health.routes.ts` |
| 6 | Extract logika shift calculation ke shared utility | `src/utils/attendanceStatus.ts` (baru) |
| 7 | Ganti `console.log` di `zk-client.ts` dengan `logger` | `src/infrastructure/zk-client.ts` |

### Priority 3 — Kelengkapan

| # | Task |
|---|---|
| 8 | Integrasikan Redis ke `tokenBlacklist.ts` (sekarang in-memory) |
| 9 | Buat `src/constants/device.constants.ts` |
| 10 | Buat `src/types/attendance.types.ts` dan `device.types.ts` |

---

## 🐛 Known Issues & Quirks

### 1. Token Blacklist Tidak Survive Restart

File: `src/utils/tokenBlacklist.ts`  
Token revocation pakai in-memory Map. Jika server restart, semua token yang sudah di-logout bisa dipakai lagi sampai expired secara natural (15 menit).

**Workaround:** Set `JWT_ACCESS_EXPIRES_IN=15m` agar window exposure kecil.

### 2. ZkDeviceClient Cache Stale Max 5 Detik

`GET /api/device/users/pull` membaca cache yang di-refresh setiap `POLLING_INTERVAL_MS` (default 5 detik). Jika baru saja ada user baru ditambahkan ke alat, mungkin belum muncul di endpoint ini dalam 5 detik pertama.

**Workaround:** Klik tombol "Tarik Data dari Alat" lagi setelah 5–10 detik.

### 3. Attendance Status Berdasarkan Jam Device

Status `TERLAMBAT` / `PULANG_CEPAT` dihitung dari jam scan di alat. Jika waktu alat tidak sync dengan NTP server, status bisa salah.

**Fix:** Jalankan `device.setTime()` secara periodik (belum diimplementasi).

### 4. Shift Calculation Terduplikasi

Logika hitung status shift ada di 2 tempat:
- `src/services/zk-sync.service.ts` (untuk persist ke DB)
- `src/controllers/device.stream.controller.ts` (untuk SSE live display)

Jika ada perubahan aturan shift, harus update 2 tempat.

---

## 📌 Catatan Penting Lainnya

### Menambah Karyawan Baru ke Alat

Karyawan baru harus didaftarkan **langsung di alat fingerprint** terlebih dahulu (scan sidik jari di alat). Setelah ada di alat, baru bisa didaftarkan ke sistem web via fitur "Manajemen Pengguna Alat".

### Cara Seed Device Mapping Manual (jika diperlukan)

Edit file `scripts/seed-device-mapping.ts`, tambahkan entry baru:

```typescript
{ nip: '199901012024001', device_user_id: '12', device_pin: '1011' },
```

Lalu jalankan:

```bash
npm run seed:device-mapping
```

### Jika Nama Masih Muncul Angka Setelah Registrasi

Record attendance yang **sudah tersimpan sebelum** pendaftaran akan diperbarui otomatis oleh `patchOrphanAttendanceRecords()` saat registrasi berhasil. Namun hanya untuk record dengan kondisi:
- `user_id = deviceUserId` (misal `"12"`)
- `nip = deviceUserId` (misal `"12"`)
- `is_deleted = false`

Jika record tidak ter-patch, cek di DB apakah kondisi di atas terpenuhi.

### Type-check Backend

```bash
cd backend-finger
npm run type-check
# Harus exit 0 sebelum commit apapun
```

---

## 📡 API Endpoints Lengkap

### Auth

```
POST /api/auth/login                 → Login, dapat access_token
POST /api/auth/refresh               → Refresh access_token
POST /api/auth/logout                → Blacklist token
POST /api/auth/forgot-password       → Kirim OTP reset via email
POST /api/auth/reset-password        → Reset password dengan OTP
```

### Device

```
GET  /api/device/stream              → SSE real-time feed (NO AUTH)
GET  /api/device/users/pull          → List user alat + status DB [BARU]
POST /api/device/users/register      → Daftarkan user alat [BARU]
GET  /api/device/shifts              → List shift aktif [BARU]
GET  /api/device                     → List semua device
GET  /api/device/:id                 → Detail device (501 - belum impl)
POST /api/device                     → Buat device baru (501 - belum impl)
PUT  /api/device/:id                 → Update device (501 - belum impl)
DELETE /api/device/:id               → Soft delete device (501 - belum impl)
POST /api/device/:id/sync            → Sync device (501 - belum impl)
```

### Attendance

```
GET  /api/attendance                 → List absensi (dengan filter & pagination)
POST /api/attendance                 → Manual create absensi
PUT  /api/attendance/:id             → Update absensi
DELETE /api/attendance/:id           → Soft delete absensi
GET  /api/attendance/summary         → Rekap per bulan
POST /api/attendance/import          → Import dari Excel/CSV
```

### Dashboard

```
GET  /api/dashboard/stats            → Statistik hari ini
GET  /api/dashboard/recent           → Absensi terbaru
```

### Admin

```
POST   /api/admin                    → Buat admin baru
PUT    /api/admin/:id                → Update admin
DELETE /api/admin/:id                → Hapus admin
PUT    /api/admin/password           → Ganti password
```

### Lainnya

```
GET /health                          → Liveness check
GET /health/ready                    → Readiness check (cek DB)
GET /metrics                         → Prometheus metrics
GET /finger-api/docs                 → Scalar API docs (browser)
```
