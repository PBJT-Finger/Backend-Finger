// src/config/swagger.bahasa.js - Extended Indonesian Descriptions

/**
 * Tags konfigurasi dengan deskripsi Bahasa Indonesia lengkap
 * Untuk di-merge ke swagger.js
 */

const indonesianTags = [
  {
    name: 'Authentication',
    description: `**Autentikasi Pengguna**

Endpoint untuk mengelola autentikasi pengguna menggunakan JWT (JSON Web Token).

**Fitur yang tersedia:**
- Login dengan username dan password
- Refresh access token menggunakan refresh token  
- Logout dan invalidasi token
- Rate limiting untuk keamanan (5 percobaan per 15 menit)

**Cara Penggunaan:**
1. Gunakan endpoint POST /api/auth/login dengan username dan password
2. Simpan access_token dan refresh_token yang diterima
3. Gunakan access_token di header Authorization: Bearer {token}
4. Refresh token sebelum expired menggunakan POST /api/auth/refresh

**Keamanan:**
- Password di-hash menggunakan bcrypt
- Token expired dalam 1 jam (access) dan 7 hari (refresh)
- Rate limiting untuk mencegah brute force attack
`
  },
  {
    name: 'User Profile',
    description: `**Profil Pengguna**

Endpoint untuk mendapatkan dan mengupdate informasi profil pengguna yang sedang login.

**Informasi yang tersedia:**
- Data pribadi (nama lengkap, email, username)
- Informasi pekerjaan (jabatan, departemen, NIP)
- Status akun (aktif/non-aktif)
- Tanggal registrasi dan update terakhir

**Operasi:**
- GET /api/profile - Lihat profil sendiri
- PUT /api/profile - Update profil sendiri

**Catatan:**
- Memerlukan autentikasi (Bearer token)
- User hanya bisa lihat dan edit profil sendiri
- Admin dapat melihat profil user lain via endpoint User Management
`
  },
  {
    name: 'Attendance',
    description: `**Manajemen Absensi**

Endpoint untuk operasi CRUD (Create, Read, Update, Delete) data absensi karyawan.

**Fitur Utama:**
- Lihat semua data absensi dengan filter dan pagination
- Lihat detail absensi berdasarkan ID
- Tambah data absensi manual (untuk admin atau koreksi)
- Update data absensi yang sudah ada
- Hapus data absensi
- Filter berdasarkan tanggal, user, dan departemen

**Format Data Absensi:**
- User ID - ID karyawan yang absen
- Date - Tanggal absensi (YYYY-MM-DD)
- Check In - Waktu masuk kerja (HH:MM:SS)
- Check Out - Waktu pulang kerja (HH:MM:SS)
- Status - PRESENT (hadir), LATE (terlambat), ABSENT (tidak hadir), LEAVE (cuti)
- Notes - Catatan tambahan (opsional)

**Validasi Otomatis:**
- Tidak bisa duplicate entry untuk user dan tanggal yang sama
- Check-in time harus lebih awal dari check-out time
- Tanggal tidak boleh di masa depan
- Status dihitung otomatis berdasarkan jam masuk

**Timezone:** Asia/Jakarta (UTC+7)
`
  },
  {
    name: 'Report',
    description: `**Ringkasan Absensi**

Endpoint untuk mendapatkan summary dan statistik absensi karyawan dalam periode tertentu.

**Data yang Disediakan:**
- Total hari kerja dalam periode
- Total kehadiran  
- Total keterlambatan
- Total ketidakhadiran
- Total cuti
- Persentase kehadiran
- Detail per hari dengan status lengkap

**Parameter Filter:**
- start_date - Tanggal mulai periode
- end_date - Tanggal akhir periode  
- user_id - Filter untuk user tertentu (untuk admin)
- department - Filter berdasarkan departemen

**Perhitungan Otomatis:**
- Hari kerja: Senin-Jumat (exclude weekend)
- Hari libur: Berdasarkan kalender libur nasional
- Persentase kehadiran = (Total Hadir / Total Hari Kerja) × 100%
- Late count = Jumlah absen dengan status LATE
- Working days = Total hari kerja - Total libur nasional

**Contoh Response:**
\`\`\`json
{
  "total_working_days": 22,
  "total_present": 20,
  "total_late": 3,
  "total_absent": 2,
  "attendance_percentage": 90.91,
  "records": [...]
}
\`\`\`
`
  },
  {
    name: 'Dashboard',
    description: `**Dashboard & Statistik**

Endpoint untuk mendapatkan metrik dan statistik sistem absensi.

**Metrics untuk Admin:**
- Total karyawan aktif di sistem
- Kehadiran hari ini (jumlah dan persentase)
- Trend kehadiran 7 hari terakhir
- Top performers (karyawan dengan kehadiran terbaik)
- Statistik per departemen
- Late arrivals hari ini
- Absent employees hari ini

**Metrics untuk User Biasa:**
- Personal attendance statistics (bulan ini)
- Performa kehadiran individu
- Perbandingan dengan rata-rata departemen
- Trend kehadiran pribadi
- Total late count bulan ini

**Fitur Visualisasi:**
- Data siap untuk charts dan graphs
- Format JSON untuk easy integration
- Historical data comparison

**Refresh Rate:**
- Data di-cache selama 5 menit
- Auto-refresh available
`
  }
];

module.exports = { indonesianTags };
