// src/config/swagger.bahasa.ts - Deskripsi lengkap dan detail dalam Bahasa Indonesia untuk Swagger UI / Scalar UI

// Definisi interface untuk objek Tag pada Swagger
interface SwaggerTag {
  name: string; // Nama Kategori Tag (harus cocok dengan nama tag di Swagger)
  description: string; // Deskripsi penjelasan dalam bahasa Indonesia (Mendukung format Markdown)
}

// Kumpulan tag terjemahan Bahasa Indonesia yang akan disuntikkan ke dalam file dokumentasi OpenAPI secara dinamis
export const indonesianTags: SwaggerTag[] = [
  {
    name: 'Authentication',
    description: `**Autentikasi Pengguna**

Endpoint untuk mengelola autentikasi pengguna menggunakan JWT (JSON Web Token).

**Fitur yang tersedia:**
- Login dengan email dan password
- Refresh access token menggunakan refresh token  
- Logout dan invalidasi token (dimasukkan ke daftar hitam/blacklist)
- Rate limiting untuk keamanan (maksimal beberapa percobaan login saja)

**Cara Penggunaan:**
1. Gunakan endpoint POST /api/auth/login dengan mengirim email dan password
2. Simpan access_token dan refresh_token yang diterima di memori/local storage
3. Gunakan access_token di header Authorization: Bearer {token} untuk request berikutnya
4. Segarkan token yang expired dengan mengirim POST /api/auth/refresh sebelum kedaluwarsa

**Keamanan:**
- Password di-hash menggunakan algoritma bcrypt yang aman
- Token kedaluwarsa otomatis (15 menit untuk access token, 7 hari untuk refresh token)
`,
  },
  {
    name: 'User Profile',
    description: `**Profil Pengguna**

Endpoint untuk mendapatkan dan mengupdate informasi profil admin/karyawan yang sedang login.

**Informasi yang tersedia:**
- Data pribadi (nama lengkap, email, username)
- Informasi pekerjaan (jabatan, NIP)
- Status akun (aktif/non-aktif)

**Operasi:**
- GET /api/profile - Lihat profil pribadi yang saat ini sedang login
- PUT /api/profile - Mengubah informasi profil pribadi sendiri

**Catatan:**
- Memerlukan header autentikasi JWT valid (Bearer token)
`,
  },
  {
    name: 'Attendance',
    description: `**Manajemen Absensi**

Endpoint untuk operasi CRUD (Create, Read, Update, Delete) data transaksi kehadiran (absensi) pegawai.

**Fitur Utama:**
- Lihat semua data transaksi absensi dengan filter (tanggal, jabatan, nama) disertai pagination
- Lihat detail absensi berdasarkan ID transaksi
- Tambah data absensi secara manual (oleh Administrator)
- Mengubah data absensi yang salah
- Menghapus data absensi (Soft Delete)

**Format Data Absensi:**
- User ID - ID unik pegawai
- Date - Tanggal absensi (Format: YYYY-MM-DD)
- Check In - Waktu kedatangan (HH:MM:SS)
- Check Out - Waktu kepulangan (HH:MM:SS)
- Status - HADIR, TERLAMBAT, dll.

**Validasi Otomatis:**
- Sistem mencegah adanya duplikasi entry absensi untuk pegawai pada tanggal yang sama
- Jam masuk harus lebih kecil/awal dibanding jam pulang
- Tanggal absensi tidak boleh di masa depan (masa yang akan datang)

**Zona Waktu (Timezone):** Asia/Jakarta (WIB, UTC+7)
`,
  },
  {
    name: 'Report',
    description: `**Ringkasan & Rekapitulasi Absensi**

Endpoint untuk mendapatkan ringkasan statistik absensi dalam satu rentang periode tertentu.

**Data yang Disediakan:**
- Total hari kerja aktif dalam periode tersebut (mengecualikan hari libur sabtu-minggu)
- Total hari kehadiran pegawai
- Total terlambat
- Persentase kehadiran masing-masing pegawai

**Parameter Filter:**
- start_date - Batas awal tanggal rekap (Format: YYYY-MM-DD)
- end_date - Batas akhir tanggal rekap (Format: YYYY-MM-DD)
- user_id - Menyaring rekap untuk pegawai tertentu
`,
  },
  {
    name: 'Dashboard',
    description: `**Dashboard & Statistik Ringkas**

Endpoint untuk menarik metrik grafis dan statistik cepat yang ditampilkan pada dashboard admin.

**Metrics yang Disediakan:**
- Total jumlah pegawai (Dosen & Karyawan) yang terdaftar
- Tingkat persentase kehadiran hari ini
- Grafik perbandingan absensi masuk/pulang
- Daftar log kehadiran real-time teratas
`,
  },
];
