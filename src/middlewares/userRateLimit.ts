// src/middlewares/userRateLimit.ts
// Middleware untuk melakukan pembatasan jumlah request (Rate Limiting) per akun user.
// Saat ini diimplementasikan menggunakan simulasi mock (Mocked Redis/Fail-open logic)
// agar mempermudah pengujian di server lokal tanpa ketergantungan wajib pada server Redis.

import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger'; // Logger aplikasi

interface RateLimiterOptions {
  windowMs?: number; // Jendela waktu pembatasan (milidetik)
  max?: number; // Batas maksimal request dalam jendela waktu
  keyPrefix?: string; // Prefiks kunci penyimpanan cache
  message?: string; // Pesan respons ketika limit terlampaui
  skipFailedRequests?: boolean; // Lewati hitungan jika request berakhir dengan status eror (>= 400)
}

// ─── Simulasi Alur Multi Redis (Mocked Redis Pipeline) ────────────────────────
const mockMulti = {
  zremrangebyscore: () => mockMulti,
  zcard: () => mockMulti,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  zadd: (key: string, now: number, member: string) => mockMulti,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  expire: (key: string, seconds: number) => mockMulti,
  exec: async (): Promise<[Error | null, number][]> => [
    [null, 0],
    [null, 0],
    [null, 0],
    [null, 0],
  ],
};

const redis = {
  multi: () => mockMulti,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  zrem: async (key: string, member: string) => {},
};

let isConnected = false;

/**
 * Menginisialisasi koneksi layanan Rate Limiter berbasis Redis (Simulasi/Mocked).
 */
export async function connectUserRateLimiter(): Promise<void> {
  isConnected = false; // Tetap bernilai false agar menggunakan mekanisme toleransi bypass (fail-open)
  logger.info('Layanan pembatas request user (Rate Limiter Simulasi) diinisialisasi');
}

/**
 * Membuat instansi middleware pembatas request (Rate Limiter) per akun user.
 */
export function createUserRateLimiter(options: RateLimiterOptions = {}) {
  const {
    windowMs = 15 * 60 * 1000, // Default: 15 menit
    max = 100, // Default: maksimal 100 request
    keyPrefix = 'ratelimit:user:',
    message = 'Terlalu banyak permintaan dari akun Anda, silakan coba lagi nanti.',
    skipFailedRequests = false,
  } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void | Response> => {
    // Lewati pembatasan jika user belum terautentikasi (tidak memiliki req.user)
    if (!req.user || !req.user.id) {
      return next();
    }

    // Lewati pembatasan jika modul Redis tidak aktif (Fail-open: mengutamakan ketersediaan layanan)
    if (!isConnected) {
      return next();
    }

    const userId = req.user.id;
    const key = `${keyPrefix}${userId}`;
    const now = Date.now();
    const _windowStart = now - windowMs;

    try {
      const multi = redis.multi();

      // Hapus data request yang berada di luar rentang jendela waktu saat ini
      multi.zremrangebyscore();
      // Hitung total request tersisa dalam jendela waktu
      multi.zcard();
      const requestId = `${now}-${Math.random().toString(36).substring(7)}`;
      // Masukkan token request baru ke set
      multi.zadd(key, now, requestId);
      // Atur masa kadaluarsa kunci
      multi.expire(key, Math.ceil(windowMs / 1000) + 10);

      const results = await multi.exec();

      if (!results || results.some((r) => r[0])) {
        throw new Error('Eksekusi pipeline Redis gagal');
      }

      const zcardResult = results[1];
      const currentCount = zcardResult ? parseInt(String(zcardResult[1]), 10) : 0;

      // Periksa apakah batas request (max) telah terlampaui
      if (currentCount >= max) {
        await redis.zrem(key, requestId);

        logger.warn('Batas frekuensi request user terlampaui', {
          userId,
          username: req.user.username,
          currentCount,
          limit: max,
          window: `${windowMs / 1000}s`,
          path: req.path,
        });

        const retryAfter = Math.ceil(windowMs / 1000);
        res.setHeader('Retry-After', retryAfter);

        return res.status(429).json({
          success: false,
          message,
          retryAfter: retryAfter,
          limit: max,
          current: currentCount,
        });
      }

      // Menambahkan header informasi pembatasan request pada respons HTTP
      res.setHeader('X-RateLimit-Limit-User', max);
      res.setHeader('X-RateLimit-Remaining-User', Math.max(0, max - currentCount - 1));
      res.setHeader('X-RateLimit-Reset-User', new Date(now + windowMs).toISOString());

      const originalSend = res.send;

      // Intersepsi respons untuk menghapus hitungan jika request gagal dan skipFailedRequests aktif
      res.send = function (data: any) {
        if (skipFailedRequests && res.statusCode >= 400) {
          redis.zrem(key, requestId).catch((err) =>
            logger.error('Gagal menghapus request gagal dari log rate limit', {
              error: err instanceof Error ? err.message : String(err),
            })
          );
        }
        return originalSend.call(this, data);
      };

      next();
    } catch (error) {
      logger.error('Eror pada middleware rate limit user', {
        error: error instanceof Error ? error.message : String(error),
        userId,
        path: req.path,
      });
      next(); // Fail-open: biarkan request lewat jika terjadi eror sistem rate limiter
    }
  };
}

/**
 * Kumpulan konfigurasi Rate Limiter siap pakai berdasarkan skenario umum
 */
export const userRateLimits = {
  // Pembatasan ketat (untuk rute tulis/modifikasi data)
  strict: createUserRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 50,
    message: 'Terlalu banyak permintaan tulis dari akun Anda. Silakan coba lagi nanti.',
  }),

  // Pembatasan moderat (untuk rute baca data intensif)
  moderate: createUserRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 200,
    message: 'Terlalu banyak permintaan baca dari akun Anda. Silakan coba lagi nanti.',
  }),

  // Pembatasan longgar (untuk rute aset statis / dashboard visualisasi)
  lenient: createUserRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 500,
    message: 'Terlalu banyak permintaan dari akun Anda. Silakan coba lagi nanti.',
  }),
};
