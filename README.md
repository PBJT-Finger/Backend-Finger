# Backend Finger - Sistem Absensi Fingerprint

> API untuk sistem manajemen absensi berbasis fingerprint dengan keamanan enterprise-grade

**Status:** ✅ Production Ready | **Versi:** 2.0.0 | **Update Terakhir:** 20 Januari 2026

---

## 📋 Daftar Isi

- [Tentang Project](#-tentang-project)
- [Fitur Utama](#-fitur-utama)
- [Teknologi](#-teknologi)
- [Instalasi](#-instalasi)
- [Endpoint API](#-endpoint-api)
- [Autentikasi](#-autentikasi)
- [Testing](#-testing)
- [Deployment](#-deployment)

---

## 🎯 Tentang Project

**Backend Finger** adalah REST API untuk sistem manajemen absensi berbasis fingerprint yang terintegrasi dengan perangkat ADMS. Sistem ini menyediakan:

- 📍 Tracking absensi real-time dari fingerprint device
- 📊 Laporan dan analytics kehadiran
- 📤 Export data (Excel, CSV)
- 🔐 Keamanan tingkat enterprise
- 🌐 Dokumentasi API interaktif

---

## ✨ Fitur Utama

### Manajemen Absensi
- Multiple check-in/out per hari
- Deteksi keterlambatan berbasis shift
- Perhitungan hari kerja otomatis (exclude weekend)
- Sinkronisasi real-time dengan device fingerprint

### Pelaporan
- Summary kehadiran dengan persentase
- Tracking keterlambatan
- Laporan bulanan dan periode
- Dashboard statistik real-time

### Keamanan
- Autentikasi JWT dengan refresh token
- Rate limiting 6-tier
- Token blacklist via Redis
- Password hashing bcrypt

---

## 🛠 Teknologi

- **Runtime:** Bun
- **Framework:** Express.js  
- **ORM:** Prisma
- **Database:** MySQL 8.0+
- **Cache:** Redis 7.0+
- **Dokumentasi:** Scalar (OpenAPI 3.0)

---

## 🚀 Instalasi

### Prerequisites
```bash
Bun >= 1.0.0
MySQL >= 8.0
Redis >= 7.0
```

### Setup

```bash
# 1. Install dependencies
bun install

# 2. Copy environment file
cp .env.example .env
# Edit .env dengan konfigurasi Anda

# 3. Generate Prisma Client
bun prisma generate

# 4. Jalankan server
bun run dev
```

Server akan berjalan di `http://localhost:3000`

---

## 📚 Endpoint API

**Base URL:** `http://localhost:3000/api`

**Dokumentasi Interaktif:** `http://localhost:3000/finger-api/docs`

### 1. Autentikasi

| Method | Endpoint | Deskripsi | Auth |
|--------|----------|-----------|------|
| POST | `/auth/login` | Login admin | ❌ |
| POST | `/auth/refresh` | Refresh access token | ❌ |
| POST | `/auth/logout` | Logout | ✅ |
| POST | `/auth/request-reset` | Request password reset | ❌ |

### 2. Dashboard

| Method | Endpoint | Deskripsi | Auth |
|--------|----------|-----------|------|
| GET | `/dashboard/summary` | Statistik dashboard | ✅ |
| GET | `/dashboard/trends?days=7` | Trend kehadiran | ✅ |

### 3. Absensi

| Method | Endpoint | Deskripsi | Auth |
|--------|----------|-----------|------|
| GET | `/attendance` | List semua absensi | ✅ |
| GET | `/attendance/summary` | Summary per karyawan | ✅ |
| GET | `/attendance/rekap` | Rekap kehadiran | ✅ |
| GET | `/attendance/dosen` | Absensi dosen only | ✅ |
| GET | `/attendance/karyawan` | Absensi karyawan only | ✅ |
| GET | `/attendance/rekap/bulanan` | Laporan bulanan | ✅ |
| DELETE | `/attendance/:id` | Hapus record | ✅ |

**Contoh Request Rekap:**
```bash
GET /api/attendance/rekap?start_date=2026-01-01&end_date=2026-01-31
```

**Response:**
```json
{
  "success": true,
  "data": {
    "summary": [
      {
        "no": 1,
        "nama": "John Doe",
        "nip": "123456",
        "jabatan": "DOSEN",
        "check_in_terakhir": "2026-01-20T08:30:00.000Z",
        "check_out_terakhir": "2026-01-20T17:00:00.000Z",
        "total_hadir": 18,
        "total_terlambat": 2,
        "total_days": 20,
        "persentase": 90
      }
    ]
  }
}
```

### 4. Export Data

| Method | Endpoint | Deskripsi | Auth |
|--------|----------|-----------|------|
| GET | `/export/excel` | Export ke Excel | ✅ |
| GET | `/export/csv` | Export ke CSV | ✅ |

**Contoh:**
```bash
GET /api/export/excel?start_date=2026-01-01&end_date=2026-01-31&jabatan=DOSEN
```

### 5. Admin Management

| Method | Endpoint | Deskripsi | Auth |
|--------|----------|-----------|------|
| GET | `/admin` | List admin | ✅ |
| GET | `/admin/:id` | Detail admin | ✅ |
| POST | `/admin` | Buat admin baru | ✅ |
| PUT | `/admin/:id` | Update admin | ✅ |
| DELETE | `/admin/:id` | Hapus admin | ✅ |

### 6. Device Management

| Method | Endpoint | Deskripsi | Auth |
|--------|----------|-----------|------|
| GET | `/device` | List devices | ✅ |
| GET | `/device/:id` | Detail device | ✅ |
| POST | `/device` | Registrasi device | ✅ |
| PUT | `/device/:id` | Update device | ✅ |

### 7. System

| Method | Endpoint | Deskripsi | Auth |
|--------|----------|-----------|------|
| GET | `/health` | Health check | ❌ |
| GET | `/metrics` | Metrics (Prometheus) | ❌ |

### 8. ADMS Device (Internal)

| Method | Endpoint | Deskripsi | Auth |
|--------|----------|-----------|------|
| POST | `/adms/push` | Push data dari device | API Key |

---

## 🔐 Autentikasi

### Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "admin123"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc...",
    "user": {
      "id": 1,
      "username": "admin",
      "role": "super_admin"
    }
  }
}
```

### Menggunakan Token

Tambahkan header `Authorization` pada setiap request:
```bash
Authorization: Bearer <your_access_token>
```

---

## 🧪 Testing

### Test Endpoint

```bash
# 1. Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# 2. Get rekap (ganti YOUR_TOKEN)
curl -X GET "http://localhost:3000/api/attendance/rekap?start_date=2026-01-01&end_date=2026-01-31" \
  -H "Authorization: Bearer YOUR_TOKEN"

# 3. Export Excel
curl -X GET "http://localhost:3000/api/export/excel?start_date=2026-01-01&end_date=2026-01-31" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  --output absensi.xlsx
```

### Tools Development

```bash
# Regenerate Prisma Client
bun prisma generate

# View database
bun prisma studio

# Check logs
pm2 logs attendance-api
```

---

## 📦 Deployment

Lihat panduan lengkap di [DEPLOYMENT.md](DEPLOYMENT.md)

### Quick Production Setup

```bash
# 1. Set environment
NODE_ENV=production

# 2. Install PM2
npm install -g pm2

# 3. Start app
pm2 start server.js --name "attendance-api"

# 4. Setup auto-start
pm2 startup
pm2 save
```

### Environment Variables Penting

```env
DATABASE_URL="mysql://user:pass@localhost:3306/finger_api"
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=<128-char-secret>
JWT_REFRESH_SECRET=<128-char-secret>
PORT=3000
NODE_ENV=production
```

---

## 📞 Kontak & Support

- **Dokumentasi API:** http://localhost:3000/finger-api/docs
- **Email:** info@pbjt.ac.id
- **Status:** Production Ready ✅

---

**© 2026 Backend Finger Team - All Rights Reserved**
