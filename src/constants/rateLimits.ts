/**
 * src/constants/rateLimits.ts — Konfigurasi Batasan Permintaan (Rate Limiting)
 *
 * Mengatur batasan jumlah request per alamat IP (Client IP) untuk mencegah kelebihan beban server,
 * penyalahgunaan API, dan serangan DDoS/Brute-force.
 */
import type { Options } from 'express-rate-limit';

// Tipe alias menggunakan opsi bawaan express-rate-limit
type RateLimitConfig = Partial<Options>;

export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  // Pembatasan umum (Catch-all) untuk seluruh endpoint API
  GENERAL_API: {
    windowMs: 15 * 60 * 1000, // Periode waktu evaluasi: 15 menit
    max: 5000, // Batas maksimal request. Dibuat besar karena polling dari frontend menghasilkan request yang tinggi.
    message: {
      success: false,
      message: 'Terlalu banyak permintaan dari IP ini, silakan coba lagi nanti.',
    },
    standardHeaders: true, // Mengirimkan info limit dalam header standar RateLimit-*
    legacyHeaders: false,  // Menonaktifkan header usang X-RateLimit-*
  },

  // Pembatasan ketat untuk endpoint login/autentikasi — mencegah serangan tebak sandi (Brute-Force)
  AUTH_LOGIN: {
    windowMs: 15 * 60 * 1000, // Periode waktu evaluasi: 15 menit
    max: process.env['NODE_ENV'] === 'production' ? 5 : 100, // Di produksi dibatasi 5 kali gagal, di development 100 kali untuk testing.
    skipSuccessfulRequests: true, // Jika login berhasil, jangan masukkan ke hitungan limitasi
    message: {
      success: false,
      message: 'Terlalu banyak percobaan autentikasi gagal, silakan coba lagi beberapa saat lagi.',
    },
    standardHeaders: true,
    legacyHeaders: false,
  },

  // Pembatasan ekspor data. Karena proses ekspor memakan CPU tinggi, diatur batas wajarnya per jam.
  EXPORT_API: {
    windowMs: 60 * 60 * 1000, // Periode waktu evaluasi: 1 jam
    max: 10_000, // Batas maksimal yang sangat longgar
    standardHeaders: true,
    legacyHeaders: false,
  },

  // Pembatasan data summary/analitik — proses perhitungan query database berat
  SUMMARY_API: {
    windowMs: 5 * 60 * 1000, // Periode waktu evaluasi: 5 menit
    max: 500,
    message: {
      success: false,
      message: 'Terlalu banyak memanggil laporan ringkasan. Silakan coba lagi dalam beberapa menit.',
    },
    standardHeaders: true,
    legacyHeaders: false,
  },

  // Pembatasan baca dashboard (Dashboard reads)
  DASHBOARD_API: {
    windowMs: 60 * 1000, // Periode waktu evaluasi: 1 menit
    max: 20, // Maksimal 20 kali refresh per menit
    message: {
      success: false,
      message: 'Terlalu banyak memanggil dashboard. Harap tunggu sebentar.',
    },
    standardHeaders: true,
    legacyHeaders: false,
  },
} as const;
