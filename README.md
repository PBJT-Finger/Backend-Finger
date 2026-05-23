# 🖐 Backend Finger — Technical Product Requirements & Architecture Document

> Backend REST API untuk sistem absensi biometrik berbasis ZKTeco X100-C.
> Terhubung **langsung** ke perangkat fingerprint melalui protokol ZKTeco proprietari (UDP port 4370) — tanpa ADMS, tanpa cloud intermediary.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20.x-green?logo=node.js)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.x-lightgrey?logo=express)](https://expressjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma-6.x-blueviolet?logo=prisma)](https://www.prisma.io/)
[![MySQL](https://img.shields.io/badge/MySQL-8.x-orange?logo=mysql)](https://www.mysql.com/)

---

## 📋 Daftar Isi

- [Arsitektur & Product Requirements (PRD)](#-arsitektur--product-requirements-prd)
- [Detail Struktur File & Folder (Deep Dive)](#-detail-struktur-file--folder-deep-dive)
- [Panduan Setup dari Awal](#-panduan-setup-dari-awal)
- [Skrip npm yang Tersedia](#-skrip-npm-yang-tersedia)
- [Konfigurasi Perangkat ZKTeco](#-konfigurasi-perangkat-zkteco)
- [🔗 Dokumentasi Komprehensif API Endpoints](#-dokumentasi-komprehensif-api-endpoints)
- [Variabel Environment Lengkap](#-variabel-environment-lengkap)
- [Troubleshooting](#-troubleshooting)

---

## 🏗 Arsitektur & Product Requirements (PRD)

Sistem ini didesain menggunakan pola **Modular Monolith** dengan pendekatan lapisan (Layered Architecture). Tujuannya adalah menjamin **Separation of Concerns (SoC)**, di mana logika komunikasi perangkat keras (mesin fingerprint) benar-benar terisolasi dari logika bisnis aplikasi (HR/Absensi).

### Flow Arsitektur Utama:
```text
ZKTeco X100-C Device (LAN)
        │ (Koneksi via UDP Port 4370, format byte-stream)
        ▼
[Infrastructure Layer] zk-client.ts (Anti-Corruption Layer)
   → Menerjemahkan bahasa mesin ke JSON. Melakukan polling setiap 5 detik.
        │ Event: 'attendance' (Data mentah)
        ▼
[Service Layer] zk-sync.service.ts & attendance.service.ts
   → Mengecek Idempotensi (menghindari data ganda). Mengolah waktu keterlambatan.
        │
        ▼
[Data Layer] Prisma ORM & MySQL
   → Menyimpan data secara atomik.
        │
        ▼
[Presentation Layer] Express Controllers & Routes
   → Menyediakan REST API, melayani validasi input (Express-Validator), 
     dan mengamankan rute (JWT Auth).
```

---

## 📂 Detail Struktur File & Folder (Deep Dive)

Berikut adalah bedah tuntas (PRD Level) untuk setiap direktori dan file penting dalam proyek ini. 

### 1. `src/` — Root Aplikasi
Direktori ini berisi seluruh *source code* TypeScript dari aplikasi backend.

- **`app.ts`**
  **Fungsi**: Setup konfigurasi inti Express.
  **Detail**: File ini mendaftarkan *middleware* global (seperti CORS, Helmet untuk keamanan header, kompresi, log Morgan) dan melakukan *mounting* semua daftar *Routes* (URL endpoint). Tidak ada logika bisnis di sini.
- **`server.ts`**
  **Fungsi**: Titik masuk (*Entry Point*) aplikasi.
  **Detail**: Bertugas melakukan *booting* server. Memanggil `app.listen`, menginisialisasi modul ZKTeco (`ZkDeviceClient`), mengatur *graceful shutdown* (mematikan database dan koneksi perangkat secara aman jika Node.js dimatikan).

### 2. `src/config/` — Konfigurasi Sistem
- **`env.ts`**: Validasi variabel `.env`. Menggunakan *library* `envalid` untuk memastikan server crash (gagal menyala) apabila kredensial database kosong. 
- **`prisma.ts`**: Singleton Database Client. Membuat satu *instance* Prisma Client tunggal agar koneksi database stabil dan tidak *bocor*.
- **`swagger.ts`**: Pembuat Dokumentasi API (OpenAPI) agar pengembang Frontend bisa melihat kontrak API di `/finger-api/docs`.

### 3. `src/controllers/` — Presentation Layer (Pengendali)
Bertanggung jawab untuk menangani Request (HTTP) dan Response (JSON).
- **`attendance.controller.ts`**: Mengurus paginasi absen, rekapan absensi manual dari web, dan sinkronisasi laporan bulanan.
- **`auth.controller.ts`**: Menangani otentikasi admin, pembuatan token JWT (Access Token & Refresh Token), dan Logout (*Blacklist*).
- **`dashboard.controller.ts`**: Menyiapkan statistik *dashboard* (jumlah kehadiran, rasio keterlambatan).
- **`device.controller.ts`**: Mengendalikan status sinkronisasi mesin ZKTeco.
- **`export.controller.ts`**: Mengekspor baris absensi ke format Excel (.xlsx) atau PDF (memakai Stream HTTP).
- **`admin.controller.ts`**: Layanan manajemen CRUD (Create, Read, Update, Delete) khusus bagi pengguna level admin.

### 4. `src/services/` — Business Logic Layer
Semua perhitungan matematika, rekapitulasi, dan penyimpanan ditaruh di sini.
- **`zk-sync.service.ts`** (CRITICAL): Jembatan ZKTeco ke MySQL. Menerima sinkronisasi, mencari pemetaan ID, lalu `INSERT` atau `UPDATE jam_keluar` untuk menghindari absen ganda (Idempoten).
- **`attendance.service.ts`**: Logika kalkulasi absen, keterlambatan, dan status `HADIR` / `ALPA`.
- **`attendance.import.service.ts`**: Membaca file `.xlsx` yang di-upload dari form web, memvalidasi baris per baris, dan memasukannya ke database (*Batch Insert*).

### 5. `src/infrastructure/` — Anti-Corruption Layer
- **`zk-client.ts`**: Menampung semua library ZKTeco. Mencegah aplikasi hancur jika koneksi LAN kabel terputus, menyertakan sistem *auto-reconnect*.

### 6. `src/middlewares/` — Penjaga Pintu (Gatekeepers)
- **`auth.middleware.ts`**: Mencegat JWT Bearer Token. Me-reject request jika token kedaluwarsa atau tercatat di *Blacklist*.
- **`validate.middleware.ts`**: Memastikan body request JSON yang dikirim bersih sesuai format.
- **`errorHandler.middleware.ts`**: Penjaga global agar *crash* pada satu baris kode tidak menyebabkan server node.exe terhenti.

### 7. `src/utils/` — Perkakas Pembantu (Helpers)
- **`calendarScheduler.ts`**: *Utility* sakti penghitung Tahun Kabisat, pergantian bulan tanpa error *timezone*, serta penentu validitas Shift Pagi/Sore.
- **`attendanceTransformer.ts`**: Pengubah data absen mentah ke format statistik persentase kehadiran bulanan.
- **`tokenBlacklist.ts`**: RAM Storage untuk menolak token user yang sudah menekan tombol Logout.

---

## 🚀 Panduan Setup dari Awal

### 1. Clone & Install Dependensi

```bash
git clone <url-repository>
cd backend-finger-x100c/backend-finger
npm install
```

### 2. Konfigurasi Environment

Salin `.env.example` ke `.env` lalu isi:

```env
# DATABASE — sesuaikan dengan MySQL kamu (Untuk Laragon biarkan DB_PASSWORD kosong)
DB_HOST=localhost
DB_PORT=3306
DB_NAME=finger_db
DB_USERNAME=root
DB_PASSWORD=

# DATABASE URL
DATABASE_URL=mysql://root:@localhost:3306/finger_db

# JWT & KEY
JWT_ACCESS_SECRET=isi_dengan_kalimat_sandi_yang_panjang_dan_rumit
JWT_REFRESH_SECRET=isi_dengan_kalimat_sandi_refresh_yang_berbeda
API_KEY_SECRET=rahasia_api_internal_sistem

# FINGERPRINT ZKTECO
FINGERPRINT_IP=192.168.1.201
FINGERPRINT_PORT=4370
```

### 3. Setup Database (Pastikan MySQL Menyala!)

1. Buat database: `CREATE DATABASE finger_db;` di Laragon/phpMyAdmin.
2. Push skema: `npx prisma db push`
3. Masukkan data dummy/awal: `npm run db:setup`

### 4. Jalankan Server

```bash
npm run dev
```

---

## 🔗 Dokumentasi Komprehensif API Endpoints

Backend ini mengadopsi standar **REST API** modern dengan respon JSON terstandarisasi. Seluruh endpoint menggunakan prefix `/api`. 
Akses dokumentasi interaktif secara visual via Swagger di 👉 **[http://localhost:3333/finger-api/docs](http://localhost:3333/finger-api/docs)**

Semua respon sukses akan menggunakan format *envelope*:
```json
{
  "success": true,
  "message": "Pesan Berhasil",
  "data": { ... }
}
```

### 🔐 1. Authentication (Otentikasi)
Manajemen otorisasi menggunakan JWT (JSON Web Token) dengan skema Bearer.

| Endpoint | Method | Keterangan | Payload (Body) | Auth Required |
|---|---|---|---|---|
| `/auth/login` | `POST` | Login administrator untuk mendapatkan token. | `{ "email": "admin@kampus.edu", "password": "..." }` | ❌ |
| `/auth/refresh` | `POST` | Memperbarui Token Akses yang sudah kadaluwarsa. | `{ "refresh_token": "..." }` | ❌ |
| `/auth/logout` | `POST` | Menghancurkan token dan memasukkannya ke *blacklist*. | - | ✅ JWT |

**Contoh Respon Login**:
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": { "id": 1, "username": "admin", "role": "ADMIN" },
    "tokens": {
      "access_token": "eyJhbG...",
      "refresh_token": "eyJhbG...",
      "expires_in": 900
    }
  }
}
```

### 📊 2. Attendance (Absensi Utama)
Operasi pencarian dan pengelolaan data sidik jari / absen manual.

| Endpoint | Method | Keterangan | Query/Payload | Auth Required |
|---|---|---|---|---|
| `/attendance` | `GET` | Melihat seluruh log absensi, mendukung paginasi dan filter waktu. | **Query**: `?page=1&limit=50&start_date=2026-01-01&end_date=2026-01-31` | ✅ JWT |
| `/attendance/dosen` | `GET` | Melihat log absen yang difilter khusus untuk staf Dosen. | **Query**: Sama dengan `/attendance` ditambah filter `?dosen_id=...` | ✅ JWT |
| `/attendance/karyawan` | `GET` | Melihat log absen yang difilter khusus untuk Karyawan rutin. | **Query**: Sama dengan `/attendance` | ✅ JWT |
| `/attendance/summary` | `GET` | Mendapatkan kalkulasi matang: persentase kehadiran, hari kerja efektif, keterlambatan per individu dalam satu bulan (Rekapitulasi). | **Query**: `?bulan=1&tahun=2026` atau `?start_date=...` | ✅ JWT |
| `/attendance/:id` | `DELETE` | Menghapus log (Soft Delete, memalsukan data absen). | **Params**: `id` dari baris data absensi | ✅ JWT |

### 📥 3. Import & Export (Rekapitulasi Fisik)
Operasi mengelola laporan akhir bulan.

| Endpoint | Method | Keterangan | Payload | Auth Required |
|---|---|---|---|---|
| `/attendance/import` | `POST` | Mengunggah file `.xlsx` untuk disinkronkan langsung ke MySQL (Batch Insert). | **Form-Data**: `file: (file_excel.xlsx)` | ✅ JWT |
| `/export/excel` | `GET` | Mengunduh hasil absensi berupa file `.xlsx` siap cetak. | **Query**: `?startDate=...&endDate=...&tipe=dosen` | ✅ JWT |
| `/export/pdf` | `GET` | Mengunduh hasil absensi dalam bentuk `.pdf` yang tidak bisa diedit. | **Query**: `?startDate=...&endDate=...` | ✅ JWT |

### 🛠 4. Dashboard & Device Management
Monitoring metrik instan dan status jaringan perangkat sidik jari.

| Endpoint | Method | Keterangan | Kueri (Opsional) | Auth Required |
|---|---|---|---|---|
| `/dashboard` | `GET` | Menarik indikator *dashboard* awal (Jumlah total absensi hari ini, performa minggu lalu). | - | ✅ JWT |
| `/attendance/sync-fingerprint` | `POST` | Memaksa modul untuk menyedot log secara instan (mengabaikan timer 5 detik). | - | ✅ JWT |
| `/attendance/device-status` | `GET` | Mengecek apakah mesin absensi sedang Online (Terhubung ke LAN) atau Offline. | - | ✅ JWT |

### 👨‍🔧 5. User Management (Admin)
Memanajemen hak akses dashboard web.

| Endpoint | Method | Keterangan | Payload (Body) | Auth Required |
|---|---|---|---|---|
| `/admin/users` | `GET` | Menampilkan seluruh akun administrator (paginasi). | `?page=1&limit=10` | ✅ JWT |
| `/admin/users` | `POST` | Menambahkan admin/pengelola sistem baru. | `{ "username": "x", "email": "x", "password": "x", "role": "ADMIN" }` | ✅ JWT |
| `/admin/users/:id`| `PUT` | Memperbarui email atau *password* admin yang sudah ada. | `{ "password": "new_password" }` | ✅ JWT |
| `/admin/users/:id`| `DELETE`| Menghapus admin dari sistem. | - | ✅ JWT |

### 🩺 6. DevOps & Monitoring

| Endpoint | Method | Keterangan | Auth Required |
|---|---|---|---|
| `/health` | `GET` | Health Check (Untuk Docker/Kubernetes Liveness Probe). | ❌ |
| `/metrics` | `GET` | Prometheus Scraper (untuk membuat grafik Grafana pemakaian memori server). | ❌ |

---

## ⚙️ Variabel Environment Lengkap

| Variabel | Wajib | Default | Keterangan |
|---|---|---|---|
| `DB_HOST` | ✅ | `localhost` | Host MySQL |
| `DATABASE_URL` | ✅ | — | Prisma connection string (mysql://root:@localhost:3306/finger_db) |
| `PORT` | ❌ | `3333` | Port server API |
| `JWT_ACCESS_SECRET` | ✅ | — | Secret token akses (min. 32 char) |
| `FINGERPRINT_IP` | ✅ | `192.168.1.201` | IP perangkat ZKTeco di LAN |
| `FINGERPRINT_PORT` | ❌ | `4370` | Port komunikasi UDP ZKTeco |

---

## 🔧 Troubleshooting

- **Server gagal start**: Ada variabel wajib di `.env` yang belum diisi (Cek koneksi MySQL).
- **ZKTeco Offline**: Komputer server dan mesin tidak 1 jaringan LAN. Coba lakukan command `ping` dari terminal ke IP mesin absensinya.
- **Table doesn't exist error**: Kamu lupa menjalankan perintah `npx prisma db push` saat melakukan setup.
