/**
 * src/constants/app.ts — Konstanta Global Bertipe Kuat untuk Seluruh Aplikasi
 *
 * Menggunakan pengubah `as const` (read-only literal types) pada TypeScript agar tipe datanya 
 * tidak membesar (widened) menjadi tipe number atau string umum. Ini memungkinkan TypeScript 
 * melakukan analisis tipe yang sangat ketat (narrowing) pada pernyataan kondisional (switch/if-else).
 */

// Kode status respon HTTP (HTTP Status Codes) yang digunakan dalam API
export const HTTP_STATUS = {
  OK: 200, // Request berhasil
  CREATED: 201, // Pembuatan data baru berhasil
  BAD_REQUEST: 400, // Kesalahan input data dari client
  UNAUTHORIZED: 401, // Gagal autentikasi / belum login
  FORBIDDEN: 403, // Tidak memiliki hak akses (authorization)
  NOT_FOUND: 404, // Data / endpoint tidak ditemukan
  CONFLICT: 409, // Konflik data (misal email/NIP sudah terdaftar)
  UNPROCESSABLE_ENTITY: 422, // Validasi input gagal
  TOO_MANY_REQUESTS: 429, // Terlalu banyak request (rate limit terlampaui)
  INTERNAL_SERVER_ERROR: 500, // Kesalahan internal server
} as const;

// Peran (Role) pengguna admin yang terdaftar di database
export const USER_ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  OPERATOR: 'OPERATOR',
} as const;

// Jabatan pegawai kampus (Dosen / Karyawan)
export const JABATAN = {
  DOSEN: 'DOSEN',
  KARYAWAN: 'KARYAWAN',
} as const;

// Status kehadiran absensi harian pegawai
export const ATTENDANCE_STATUS = {
  HADIR: 'HADIR',
  SAKIT: 'SAKIT',
  IZIN: 'IZIN',
  ALFA: 'ALFA',
} as const;

// Status keaktifan pegawai di kampus
export const EMPLOYEE_STATUS = {
  AKTIF: 'AKTIF',
  CUTI: 'CUTI',
  RESIGN: 'RESIGN',
  NON_AKTIF: 'NON_AKTIF',
} as const;

// Batasan validasi input data
export const VALIDATION = {
  MIN_PASSWORD_LENGTH: 6, // Panjang sandi minimal 6 karakter
  MAX_NAME_LENGTH: 255, // Panjang nama maksimal 255 karakter
  MAX_EMAIL_LENGTH: 100, // Panjang email maksimal 100 karakter
  MIN_PAGE: 1, // Halaman minimum pagination
  DEFAULT_PAGE_SIZE: 50, // Jumlah baris data default per halaman
  MAX_PAGE_SIZE: 100, // Jumlah baris data maksimal per halaman
  MIN_NIP_LENGTH: 10, // Panjang NIDN/NIP minimal
  MAX_NIP_LENGTH: 50, // Panjang NIDN/NIP maksimal
} as const;

// Masa berlaku token autentikasi
export const TOKEN = {
  ACCESS_TOKEN_EXPIRY: '15m', // Access token berlaku 15 menit
  REFRESH_TOKEN_EXPIRY: '7d',  // Refresh token berlaku 7 hari
} as const;

// Format ekspor file laporan yang didukung oleh sistem
export const EXPORT_FORMAT = {
  EXCEL: 'excel',
  CSV: 'csv',
  PDF: 'pdf',
} as const;

// Jam kerja default (Morning shift & Night shift)
export const DEFAULT_SHIFTS = {
  MORNING: '08:00:00', // Jam masuk default
  NIGHT: '16:00:00',   // Jam pulang default
} as const;

// Menghasilkan tipe data gabungan (union types) dinamis berdasarkan konstanta di atas untuk fungsi signature
export type HttpStatusCode = (typeof HTTP_STATUS)[keyof typeof HTTP_STATUS];
export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];
export type JabatanType = (typeof JABATAN)[keyof typeof JABATAN];
export type ExportFormat = (typeof EXPORT_FORMAT)[keyof typeof EXPORT_FORMAT];
