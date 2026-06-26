/**
 * src/middlewares/auth.middleware.ts — JWT Autentikasi & Otorisasi
 *
 * Middleware ini berada di batas luar Express — semua input/header tidak dapat dipercaya secara langsung.
 * Kasus kegagalan (Failure modes) yang ditangani:
 *   - Tidak ada token di header → 401 Unauthorized
 *   - Token berada dalam daftar blacklist (sudah logout/dicabut) → 401 Unauthorized
 *   - Tanda tangan JWT tidak valid/kadaluarsa → 403 Forbidden
 *   - Payload JWT kekurangan field wajib → 403 Forbidden
 *
 * Keamanan: JWT_ACCESS_SECRET dibaca dari konfigurasi objek env yang telah divalidasi
 * saat startup, bukan langsung membaca dari process.env secara mentah.
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import logger from '../utils/logger'; // Logger aplikasi
import { isBlacklisted } from '../utils/tokenBlacklist'; // Fungsi cek token di blacklist database redis/cache
import { AuthenticationError } from '../utils/errors'; // Error khusus autentikasi
import { env } from '../config/env'; // Variabel lingkungan (.env) ter-validasi
import type { AuthenticatedUser } from '../types/express.d'; // Interface tipe req.user

// ─── Tipe Data Internal ───────────────────────────────────────────────────────

/** Struktur isi payload JWT saat token ditandatangani. */
interface JwtPayload {
  id: number;
  username: string;
  role: string;
  iat?: number;
  exp?: number;
}

// ─── Middleware ──────────────────────────────────────────────────────────────

/**
 * Validasi Bearer JWT dari header Authorization.
 * Jika sukses, mengisi properti `req.user` dengan payload yang telah didecode.
 * Jika gagal, langsung mengembalikan respons error 401/403 tanpa meneruskan error ke handler global
 * untuk mencegah kebocoran informasi detail sistem.
 */
export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader?.split(' ')[1]; // Format yang diharapkan: "Bearer <token>"

    if (!token) {
      logger.warn('Gagal Autentikasi: Token tidak disertakan', {
        ip: req.ip,
        path: req.path,
        correlationId: req.correlationId,
      });
      res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_MISSING',
          message: 'Access token wajib disertakan',
        },
      });
      return;
    }

    // Periksa status pencabutan token (blacklist) SEBELUM verifikasi tanda tangan JWT demi menghemat beban CPU
    const revoked = await isBlacklisted(token);
    if (revoked) {
      logger.warn('Gagal Autentikasi: Token telah dicabut (blacklisted)', {
        ip: req.ip,
        path: req.path,
        tokenPrefix: token.substring(0, 10) + '...',
        correlationId: req.correlationId,
      });
      res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_REVOKED',
          message: 'Token telah dicabut. Silakan login kembali.',
        },
      });
      return;
    }

    // Verifikasi JWT secara sinkron — memicu error jika tanda tangan salah atau kadaluarsa
    let decoded: JwtPayload;
    try {
      decoded = jwt.verify(token, env.JWT_ACCESS_SECRET as string) as unknown as JwtPayload;
    } catch (jwtErr) {
      const msg = jwtErr instanceof Error ? jwtErr.message : 'Token tidak valid';
      logger.warn('Gagal Autentikasi: Eror verifikasi JWT', {
        ip: req.ip,
        path: req.path,
        reason: msg,
        correlationId: req.correlationId,
      });
      res.status(403).json({
        success: false,
        error: {
          code: 'TOKEN_INVALID',
          message: 'Token tidak valid atau telah kadaluarsa',
        },
      });
      return;
    }

    // Validasi bentuk payload JWT sebelum mempercayainya
    if (typeof decoded.id !== 'number' || !decoded.username || !decoded.role) {
      throw new AuthenticationError('Struktur isi token tidak valid');
    }

    const user: AuthenticatedUser = {
      id: decoded.id,
      username: decoded.username,
      role: decoded.role,
    };

    req.user = user;

    // Larang operasi modifikasi (Write Actions: POST, PUT, DELETE, PATCH) untuk pengguna dengan role 'PIMPINAN'
    // Kecuali untuk endpoint logout
    const writeMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
    const isLogout = req.path.endsWith('/logout');
    if (
      writeMethods.includes(req.method.toUpperCase()) &&
      user.role.toUpperCase() === 'PIMPINAN' &&
      !isLogout
    ) {
      logger.warn('Gagal Autentikasi: Hak akses modifikasi ditolak untuk PIMPINAN', {
        userId: user.id,
        role: user.role,
        path: req.path,
        method: req.method,
        correlationId: req.correlationId,
      });
      res.status(403).json({
        success: false,
        error: {
          code: 'WRITE_ACCESS_DENIED',
          message: 'Akses ditolak: Pimpinan hanya memiliki hak akses baca dan ekspor.',
        },
      });
      return;
    }

    logger.info('Autentikasi berhasil', {
      userId: user.id,
      username: user.username,
      path: req.path,
      method: req.method,
      correlationId: req.correlationId,
    });

    next();
  } catch (error) {
    logger.error('Error pada middleware autentikasi', {
      error: error instanceof Error ? error.message : String(error),
      ip: req.ip,
      path: req.path,
      correlationId: req.correlationId,
    });
    res.status(500).json({
      success: false,
      error: {
        code: 'AUTHENTICATION_ERROR',
        message: 'Terjadi kegagalan pada layanan autentikasi',
      },
    });
  }
};

/**
 * Middleware Otorisasi berbasis hak akses (Role-Based Access Control).
 * Harus diletakkan SETELAH middleware authenticateToken.
 * Jika parameter allowedRoles kosong, default pengamanan hanya membolehkan ADMIN dan SUPER_ADMIN.
 */
export const requireRole =
  (...allowedRoles: string[]) =>
  (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHENTICATED', message: 'Autentikasi diperlukan' },
      });
      return;
    }

    const permitted =
      allowedRoles.length > 0 ? allowedRoles.map((r) => r.toUpperCase()) : ['ADMIN', 'SUPER_ADMIN'];

    if (!permitted.includes(req.user.role.toUpperCase())) {
      logger.warn('Gagal Otorisasi: Hak akses (role) tidak mencukupi', {
        userId: req.user.id,
        role: req.user.role,
        required: permitted,
        path: req.path,
        correlationId: req.correlationId,
      });
      res.status(403).json({
        success: false,
        error: { code: 'AUTHORIZATION_FAILED', message: 'Akses ditolak: hak akses Anda tidak mencukupi' },
      });
      return;
    }

    next();
  };

/** Shortcut: Guard pengaman rute khusus Admin/Super Admin */
export const requireAdmin = requireRole('ADMIN', 'SUPER_ADMIN');

/**
 * Middleware untuk mencatat log HTTP request.
 * Mencatat metode HTTP, path rute, kode status respons, dan durasi eksekusi.
 * Diletakkan di awal tumpukan middleware Express.
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();

  logger.http('Menerima request HTTP', {
    method: req.method,
    path: req.path,
    ip: req.ip,
    correlationId: req.correlationId,
  });

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.http('Request HTTP selesai diproses', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: duration,
      userId: req.user?.id,
      correlationId: req.correlationId,
    });
  });

  next();
};
