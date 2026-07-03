/**
 * src/config/env.ts — Validasi Variabel Lingkungan / Environment Variables (TypeScript)
 *
 * File ini bertindak sebagai sumber kebenaran tunggal (single source of truth) untuk seluruh
 * konfigurasi runtime aplikasi. Menggunakan pustaka `envalid` untuk memvalidasi variabel
 * lingkungan saat server dinyalakan. Jika ada variabel yang wajib diisi namun kosong atau
 * formatnya salah, server akan langsung berhenti (exit) dengan pesan kesalahan yang jelas.
 *
 * Mengapa menggunakan envalid daripada dotenv saja: dotenv hanya memuat nilai sebagai string biasa.
 * envalid memaksa tipe data (angka, port, boolean, string), menyediakan nilai default, dan menghasilkan
 * log error yang deskriptif sebelum aplikasi memasuki kondisi tidak konsisten di lingkungan produksi.
 */
import dotenv from 'dotenv';
import { cleanEnv, str, port, num, bool } from 'envalid';

// Memuat variabel lingkungan dari berkas .env
dotenv.config();

// Melakukan validasi dan pembersihan (sanitasi) terhadap process.env
export const env = cleanEnv(process.env, {
  // ─── Database MySQL ──────────────────────────────────────────────────────────
  DB_HOST: str({
    desc: 'Alamat host database MySQL',
    default: 'localhost',
  }),
  DB_PORT: port({
    desc: 'Port database MySQL',
    default: 3306,
  }),
  DB_NAME: str({
    desc: 'Nama database MySQL yang digunakan',
    example: 'finger_attendance',
  }),
  DB_USERNAME: str({
    desc: 'Username akses database',
    default: 'root',
    example: 'finger_user',
  }),
  DB_PASSWORD: str({
    desc: 'Password akses database',
  }),

  // ─── JSON Web Token (JWT) ────────────────────────────────────────────────────
  JWT_ACCESS_SECRET: str({
    desc: 'Kunci rahasia untuk menandatangani access token JWT',
  }),
  JWT_REFRESH_SECRET: str({
    desc: 'Kunci rahasia untuk menandatangani refresh token JWT',
  }),
  JWT_ACCESS_EXPIRES_IN: str({
    desc: 'Masa kedaluwarsa access token JWT',
    default: '15m',
  }),
  JWT_REFRESH_EXPIRES_IN: str({
    desc: 'Masa kedaluwarsa refresh token JWT',
    default: '7d',
  }),

  // ─── Server Express ──────────────────────────────────────────────────────────
  PORT: port({
    desc: 'Port server HTTP Express',
    default: 3001,
  }),
  NODE_ENV: str({
    desc: 'Mode lingkungan jalannya aplikasi',
    choices: ['development', 'production', 'test'],
    default: 'development',
  }),

  // ─── Keamanan Keamanan ───────────────────────────────────────────────────────
  API_KEY_SECRET: str({
    desc: 'Kunci rahasia untuk hashing/enkripsi API key',
  }),
  CORS_ORIGINS: str({
    desc: 'Daftar origin web yang diizinkan melakukan CORS (dipisah koma)',
    default:
      'http://localhost:5555,http://localhost:3000,http://localhost:3333,https://finger.pbjt.web.id,https://finger-be.pbjt.web.id',
  }),

  // ─── Logging System ──────────────────────────────────────────────────────────
  LOG_LEVEL: str({
    desc: 'Tingkatan pencatatan log (logging level)',
    choices: ['error', 'warn', 'info', 'debug'],
    default: 'info',
  }),

  // ─── SMTP / Email (Pengiriman Email Notifikasi) ──────────────────────────────
  SMTP_HOST: str({
    desc: 'Alamat server SMTP email',
    default: 'smtp.gmail.com',
  }),
  SMTP_PORT: port({
    desc: 'Port server SMTP email',
    default: 587,
  }),
  SMTP_SECURE: bool({
    desc: 'Gunakan koneksi aman SSL/TLS untuk SMTP',
    default: false,
  }),
  SMTP_USER: str({
    desc: 'Username / email pengirim SMTP',
    default: '',
  }),
  SMTP_PASSWORD: str({
    desc: 'Password aplikasi / password SMTP',
    default: '',
  }),
  EMAIL_FROM: str({
    desc: 'Alamat email pengirim default',
    default: 'noreply@fingerattendance.com',
  }),
  EMAIL_FROM_NAME: str({
    desc: 'Nama pengirim default yang ditampilkan di email',
    default: 'Finger Attendance System',
  }),

  // ─── Perangkat Fisik ZKTeco (Anti-Corruption Layer) ─────────────────────────
  FINGERPRINT_IP: str({
    desc: 'IP address mesin fingerprint ZKTeco di jaringan lokal. Wajib diatur di .env (tidak ada default).',
  }),
  FINGERPRINT_PORT: port({
    desc: 'Port komunikasi UDP mesin ZKTeco (protokol bawaan/proprietari ZKTeco)',
    default: 4370,
  }),
  FINGERPRINT_TIMEOUT: num({
    desc: 'Batas waktu koneksi socket ke mesin sidik jari dalam milidetik',
    default: 10_000,
  }),
  POLLING_INTERVAL_MS: num({
    desc: 'Jeda waktu antar siklus polling data mesin dalam milidetik. 5 detik untuk realtime dashboard yang lebih responsif.',
    default: 5_000,
  }),
  RECONNECT_DELAY_MS: num({
    desc: 'Jeda waktu untuk mencoba menghubungkan kembali mesin setelah gagal polling (dalam milidetik).',
    default: 10_000,
  }),
  IN_PORT_TIMEOUT_MS: num({
    desc: 'Timeout internal soket ZKLib dalam milidetik.',
    default: 5_000,
  }),
});

/**
 * Interface bertipe data kuat (strongly typed) untuk kebutuhan di modul lain.
 * Disarankan mengimpor objek `env` langsung daripada instansi tipe ini.
 */
export type AppEnv = typeof env;
