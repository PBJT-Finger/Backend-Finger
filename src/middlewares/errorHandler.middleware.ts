/**
 * src/middlewares/errorHandler.middleware.ts — Penanganan Eror Terpusat (Centralized Error Handler)
 *
 * Penempatan: Wajib diletakkan di baris paling AKHIR pendaftaran middleware di file app.ts.
 * Express mengenali middleware penanganan error dari tanda tangan fungsi yang memiliki 4 parameter argumen.
 *
 * Kontrak format respons error (seragam untuk semua jenis error):
 * {
 *   "success": false,
 *   "error": {
 *     "code":    "KODE_ERROR_MESIN",
 *     "message": "Deskripsi kesalahan yang ramah dibaca manusia",
 *     "details": [] | undefined   (hanya untuk eror validasi input form)
 *   }
 * }
 *
 * Keamanan: Detail stack trace kode internal HANYA disertakan jika berjalan di mode development.
 * Jangan sekali-kali membocorkan baris stack trace internal di respons server tingkat production.
 */

import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger'; // Logger aplikasi
import { AppError, ValidationError } from '../utils/errors'; // Kelas model error khusus sistem
import { HTTP_STATUS } from '../constants/app'; // Konstanta kode status HTTP

// ─── Penangan Eror Global (Global Error Handler) ──────────────────────────────

/**
 * Menangani seluruh eror yang terlempar (throw) atau diteruskan ke fungsi next(err) di aplikasi.
 * Menstandarisasi eror non-AppError (seperti eror sistem node) menjadi kelas AppError agar format respons seragam.
 *
 * @param err  - Objek eror (dapat berupa AppError atau eror sistem lainnya)
 * @param req  - Objek Express Request (untuk pencatatan log)
 * @param res  - Objek Express Response (untuk mengirim respons JSON)
 * @param _next - Dibutuhkan oleh Express untuk mendeteksi penanganan eror
 */
export const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Normalisasi eror menjadi instansi AppError
  let appError: AppError;

  if (err instanceof AppError) {
    appError = err;
  } else if (err instanceof Error) {
    appError = new AppError(
      err.message || 'Terjadi kesalahan internal pada server',
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      false, // Eror tidak terduga dianggap non-operational
      'INTERNAL_ERROR'
    );
  } else {
    appError = new AppError(
      'Terjadi kesalahan yang tidak terduga',
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      false,
      'INTERNAL_ERROR'
    );
  }

  // Tulis log berdasarkan tingkat keparahan (severity) eror
  if (appError.isOperational) {
    // Eror operasional (seperti salah input, data tidak ada) dicatat sebagai warning saja
    logger.warn('Eror Operasional Terjadi', {
      code: appError.code,
      message: appError.message,
      statusCode: appError.statusCode,
      path: req.path,
      method: req.method,
      ip: req.ip,
      userId: req.user?.id,
      correlationId: req.correlationId,
    });
  } else {
    // Eror sistem/pemrograman (seperti bug runtime) dicatat sebagai error lengkap dengan stack trace
    logger.error('Eror Pemrograman Tidak Terduga', {
      code: appError.code,
      message: appError.message,
      statusCode: appError.statusCode,
      stack: appError.stack,
      path: req.path,
      method: req.method,
      ip: req.ip,
      userId: req.user?.id,
      correlationId: req.correlationId,
    });
  }

  const isDevelopment = process.env['NODE_ENV'] !== 'production';

  // Susun struktur isi respons JSON eror
  const responseBody: Record<string, unknown> = {
    success: false,
    error: {
      code: appError.code,
      message: appError.message,
      // Hanya sertakan detail array jika merupakan ValidationError (eror validasi form)
      ...(appError instanceof ValidationError && { details: appError.details }),
      // Sertakan stack trace eror hanya jika berjalan di lingkungan development lokal
      ...(isDevelopment && { stack: appError.stack }),
    },
  };

  res.status(appError.statusCode).json(responseBody);
};

// ─── Penangan Rute Tidak Ditemukan (404 Handler) ──────────────────────────────

/**
 * Menangkap seluruh request HTTP yang jalurnya tidak cocok dengan rute mana pun yang terdaftar.
 * Harus diletakkan SEBELUM errorHandler tetapi SETELAH semua registrasi rute API selesai.
 */
export const notFoundHandler = (req: Request, res: Response, _next: NextFunction): void => {
  logger.warn('Rute tidak ditemukan (404)', {
    path: req.path,
    method: req.method,
    ip: req.ip,
    correlationId: req.correlationId,
  });

  res.status(HTTP_STATUS.NOT_FOUND).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Rute ${req.method} ${req.path} tidak ditemukan`,
    },
  });
};

// ─── Pembungkus Handler Asinkron (Async Handler Wrapper) ──────────────────────

/**
 * Membungkus fungsi handler rute Express yang bersifat asinkron (async),
 * agar jika terjadi Promise reject/error otomatis diteruskan ke errorHandler global via next(err).
 *
 * Penggunaan:
 *   router.get('/jalur', asyncHandler(async (req, res) => { ... }));
 */
export const asyncHandler =
  <T>(fn: (req: Request, res: Response, next: NextFunction) => Promise<T>) =>
  (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
