// src/controllers/auth.controller.ts
// Kontroler untuk menangani semua operasi autentikasi admin:
// login, registrasi, lupa password, verifikasi kode, reset password, refresh token, dan logout.

import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { generateTokens, verifyRefreshToken } from '../utils/jwt';
import { addToBlacklist, isBlacklisted } from '../utils/tokenBlacklist';
import { body, validationResult } from 'express-validator';
import logger from '../utils/logger';
import bcrypt from 'bcrypt'; // Library untuk hashing dan verifikasi password secara aman
import crypto from 'crypto'; // Module bawaan Node.js untuk menghasilkan token acak yang aman
import {
  loginResponse,
  passwordResetResponse,
  successResponse,
  errorResponse,
} from '../utils/responseFormatter';
import {
  sendPasswordResetEmail,
  sendPasswordResetConfirmation,
} from '../services/email.service';

// Kelas statis berisi semua handler untuk endpoint /api/auth
export class AuthController {
  /**
   * [POST /api/auth/login] — Login Admin
   * Menerima email dan password, memverifikasi ke database, lalu mengembalikan pasangan token JWT.
   */
  public static login = [
    // Validasi input: email harus format email yang valid
    body('email').trim().isEmail().withMessage('Email tidak valid').normalizeEmail({ gmail_remove_dots: false }),
    // Validasi input: password minimal 6 karakter
    body('password').isLength({ min: 6 }).withMessage('Password minimal 6 karakter'),

    async (req: Request, res: Response): Promise<Response> => {
      try {
        // Memeriksa apakah ada error validasi dari express-validator
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          logger.warn('Validasi login gagal', {
            ip: req.ip,
            errors: errors.array(),
          });
          const firstErr = errors.array()[0];
          return errorResponse(res, firstErr ? firstErr.msg : 'Validasi gagal', 400);
        }

        // Mengambil email dan password dari body request
        const { email, password } = req.body;

        // Mencari admin berdasarkan email dan memastikan akun masih aktif
        const admin = await prisma.admins.findFirst({
          where: { email, is_active: true },
        });

        // Jika admin tidak ditemukan, kembalikan error generik (bukan "email tidak ditemukan") untuk keamanan
        if (!admin) {
          logger.warn('Login gagal: Pengguna tidak ditemukan', { email, ip: req.ip });
          return errorResponse(res, 'Email atau password salah', 401);
        }

        // Membandingkan password plain-text dari request dengan hash yang tersimpan di database
        const isValidPassword = await bcrypt.compare(password, admin.password_hash);

        // Jika password tidak cocok, kembalikan error generik yang sama
        if (!isValidPassword) {
          logger.warn('Login gagal: Password salah', { email, ip: req.ip });
          return errorResponse(res, 'Email atau password salah', 401);
        }

        // Menghasilkan access token (berlaku 15 menit) dan refresh token (berlaku 7 hari)
        const { accessToken, refreshToken } = generateTokens(admin);

        // Memperbarui waktu login terakhir admin di database
        await prisma.admins.update({
          where: { id: admin.id },
          data: { last_login: new Date() },
        });

        // Mencatat log audit bahwa login berhasil
        logger.audit('LOGIN_SUCCESS', admin.id, {
          username: admin.username,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
        });

        // Mengembalikan response sukses login beserta data admin dan token
        return loginResponse(res, admin, accessToken, refreshToken);
      } catch (error) {
        logger.error('Error saat proses login', {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          ip: req.ip,
        });
        return errorResponse(res, 'Internal server error', 500);
      }
    },
  ];


  /**
   * [POST /api/auth/forgot-password] — Lupa Password
   * Mengirimkan kode OTP 6 digit ke email admin untuk proses reset password.
   */
  public static forgotPassword = [
    // Validasi: email harus format yang valid
    body('email').trim().isEmail().withMessage('Email tidak valid').normalizeEmail({ gmail_remove_dots: false }),

    async (req: Request, res: Response): Promise<Response> => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return errorResponse(res, 'Email tidak valid', 400);
        }

        const { email } = req.body;

        // Mencari admin dengan email tersebut yang masih aktif
        const admin = await prisma.admins.findFirst({
          where: { email, is_active: true },
        });

        // Jika email tidak ditemukan, tetap kembalikan response sukses (untuk mencegah email enumeration attack)
        if (!admin) {
          logger.warn('Reset password diminta untuk email yang tidak terdaftar', { email, ip: req.ip });
          return passwordResetResponse(res);
        }

        // Membuat kode OTP 6 digit secara acak (100000–999999)
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        // Mengatur waktu kedaluwarsa: 15 menit dari sekarang
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

        // Menghapus semua permintaan reset lama yang belum digunakan milik admin ini
        await prisma.password_resets.deleteMany({
          where: { admin_id: admin.id, used_at: null },
        });

        // Menyimpan data permintaan reset baru ke database
        await prisma.password_resets.create({
          data: {
            admin_id: admin.id,
            email: admin.email,
            code,
            expires_at: expiresAt,
            created_at: new Date(),
          },
        });

        // Mengirimkan email berisi kode OTP ke admin
        try {
          await sendPasswordResetEmail(email, code, admin.username);
        } catch (emailError) {
          logger.warn('Gagal mengirim email reset password', {
            email,
            error: emailError instanceof Error ? emailError.message : String(emailError),
          });
          // Pada mode Development, tampilkan kode di log sebagai fallback
          logger.info('KODE RESET PASSWORD (Development)', { email, code });
        }

        logger.audit('PASSWORD_RESET_REQUESTED', admin.id, { email, ip: req.ip });

        return passwordResetResponse(res);
      } catch (error) {
        logger.error('Error saat proses lupa password', {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          ip: req.ip,
        });
        return errorResponse(res, 'Terjadi kesalahan. Silakan coba lagi.', 500);
      }
    },
  ];

  /**
   * [POST /api/auth/verify-code] — Verifikasi Kode OTP Reset Password
   * Memvalidasi kode OTP yang dimasukkan admin, lalu mengembalikan reset token jika kode valid.
   */
  public static verifyCode = [
    body('email').trim().isEmail().withMessage('Email tidak valid').normalizeEmail({ gmail_remove_dots: false }),
    // Kode OTP harus tepat 6 digit angka
    body('code')
      .trim()
      .isLength({ min: 6, max: 6 })
      .withMessage('Kode harus 6 digit')
      .isNumeric()
      .withMessage('Kode harus berupa angka'),

    async (req: Request, res: Response): Promise<Response> => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          const firstErr = errors.array()[0];
          return errorResponse(res, firstErr ? firstErr.msg : 'Validasi gagal', 400);
        }

        const { email, code } = req.body;

        // Mencari entri reset password yang cocok berdasarkan email + kode, dan belum digunakan
        const resetEntry = await prisma.password_resets.findFirst({
          where: { email, code, used_at: null },
          include: { admins: { select: { is_active: true } } },
        });

        // Jika tidak ditemukan atau admin sudah tidak aktif, tolak
        if (!resetEntry || !resetEntry.admins?.is_active) {
          logger.warn('Percobaan verifikasi kode tidak valid', { email, ip: req.ip });
          return errorResponse(res, 'Kode verifikasi tidak valid', 400);
        }

        // Memeriksa apakah kode OTP sudah melewati batas waktu kedaluwarsa (15 menit)
        if (new Date() > new Date(resetEntry.expires_at)) {
          logger.warn('Percobaan verifikasi kode yang sudah kadaluarsa', { email, ip: req.ip });
          return errorResponse(res, 'Kode verifikasi sudah kadaluarsa', 400);
        }

        // Menghasilkan reset token acak 32 byte (64 karakter hex) sebagai penanda verifikasi berhasil
        const resetToken = crypto.randomBytes(32).toString('hex');

        // Menyimpan reset token ke database untuk digunakan pada langkah berikutnya (ganti password)
        await prisma.password_resets.update({
          where: { id: resetEntry.id },
          data: { reset_token: resetToken },
        });

        logger.audit('RESET_CODE_VERIFIED', resetEntry.admin_id, { email, ip: req.ip });

        // Mengembalikan reset token ke client untuk digunakan di endpoint /reset-password
        return passwordResetResponse(res, { resetToken }, 'Kode valid');
      } catch (error) {
        logger.error('Error saat verifikasi kode OTP', {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          ip: req.ip,
        });
        return errorResponse(res, 'Terjadi kesalahan. Silakan coba lagi.', 500);
      }
    },
  ];

  /**
   * [POST /api/auth/reset-password] — Reset Password dengan Token
   * Menggunakan reset token yang diperoleh dari /verify-code untuk mengganti password admin.
   */
  public static resetPassword = [
    body('resetToken').notEmpty().withMessage('Reset token diperlukan'),
    // Password baru harus memenuhi syarat keamanan yang ketat
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('Password minimal 8 karakter')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password harus mengandung huruf besar, huruf kecil, dan angka'),

    async (req: Request, res: Response): Promise<Response> => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          const firstErr = errors.array()[0];
          return errorResponse(res, firstErr ? firstErr.msg : 'Validasi gagal', 400);
        }

        const { resetToken, newPassword } = req.body;

        // Mencari entri reset berdasarkan token dan memastikan belum digunakan
        const resetEntry = await prisma.password_resets.findFirst({
          where: { reset_token: resetToken, used_at: null },
          include: { admins: { select: { is_active: true, username: true } } },
        });

        if (!resetEntry || !resetEntry.admins?.is_active) {
          logger.warn('Percobaan reset dengan token tidak valid', { ip: req.ip });
          return errorResponse(res, 'Token reset tidak valid atau sudah digunakan', 400);
        }

        // Memeriksa apakah token sudah kedaluwarsa
        if (new Date() > new Date(resetEntry.expires_at)) {
          logger.warn('Percobaan reset dengan token yang sudah kadaluarsa', { ip: req.ip });
          return errorResponse(res, 'Token reset sudah kadaluarsa', 400);
        }

        // Mengenkripsi (hash) password baru dengan salt rounds 12
        const hashedPassword = await bcrypt.hash(newPassword, 12);

        // Menggunakan transaksi database untuk:
        // 1. Mengupdate password admin, dan
        // 2. Menandai entri reset sebagai sudah terpakai (used_at)
        // — dilakukan dalam satu unit atomik agar data selalu konsisten
        await prisma.$transaction([
          prisma.admins.update({
            where: { id: resetEntry.admin_id },
            data: { password_hash: hashedPassword, updated_at: new Date() },
          }),
          prisma.password_resets.update({
            where: { id: resetEntry.id },
            data: { used_at: new Date() },
          }),
        ]);

        // Mengirimkan email konfirmasi bahwa password sudah berhasil diubah
        try {
          await sendPasswordResetConfirmation(resetEntry.email, resetEntry.admins.username);
        } catch (emailError) {
          logger.warn('Gagal mengirim email konfirmasi reset password', {
            email: resetEntry.email,
            error: emailError instanceof Error ? emailError.message : String(emailError),
          });
        }

        logger.audit('PASSWORD_RESET_COMPLETED', resetEntry.admin_id, {
          email: resetEntry.email,
          ip: req.ip,
        });

        return passwordResetResponse(res, null, 'Password berhasil direset');
      } catch (error) {
        logger.error('Error saat reset password', {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          ip: req.ip,
        });
        return errorResponse(res, 'Gagal mereset password. Silakan coba lagi.', 500);
      }
    },
  ];

  /**
   * [POST /api/auth/refresh] — Perbarui Access Token
   * Menerima refresh token yang valid untuk mendapatkan pasangan token baru (rotasi token).
   */
  public static refreshToken = async (req: Request, res: Response): Promise<Response> => {
    try {
      const { refresh_token } = req.body;

      // Memastikan refresh token dikirimkan dalam body request
      if (!refresh_token) {
        return errorResponse(res, 'Refresh token diperlukan', 400);
      }

      // Memeriksa apakah refresh token sudah masuk ke daftar hitam (blacklist) karena logout sebelumnya
      const blacklisted = await isBlacklisted(refresh_token);
      if (blacklisted) {
        logger.warn('Refresh token ditolak: token sudah di-blacklist', { ip: req.ip });
        return errorResponse(res, 'Refresh token sudah dicabut. Silakan login kembali.', 401);
      }

      // Memverifikasi tanda tangan JWT pada refresh token
      const decoded = verifyRefreshToken(refresh_token);

      // Memastikan admin yang terkait dengan token masih ada di database dan masih aktif
      const admin = await prisma.admins.findUnique({
        where: { id: decoded.id },
      });

      if (!admin || !admin.is_active) {
        logger.warn('Refresh token ditolak: pengguna tidak ditemukan atau tidak aktif', { userId: decoded.id });
        return errorResponse(res, 'Refresh token tidak valid', 401);
      }

      // Memasukkan refresh token lama ke blacklist (Token Rotation) untuk mencegah penggunaan ulang
      await addToBlacklist(refresh_token, 7 * 24 * 60 * 60);
      logger.info('Refresh token lama dimasukkan blacklist saat rotasi', { userId: admin.id });

      // Menghasilkan pasangan token baru (access token + refresh token)
      const { accessToken, refreshToken: newRefreshToken } = generateTokens(admin);

      logger.audit('TOKEN_REFRESH_ROTATED', admin.id, { ip: req.ip });

      return successResponse(
        res,
        {
          tokens: {
            access_token: accessToken,
            refresh_token: newRefreshToken,
            token_type: 'Bearer',
            expires_in: 15 * 60, // Access token berlaku selama 900 detik (15 menit)
          },
        },
        'Token berhasil diperbarui'
      );
    } catch (error) {
      logger.error('Error saat refresh token', {
        error: error instanceof Error ? error.message : String(error),
        ip: req.ip,
      });
      return errorResponse(res, 'Refresh token tidak valid', 401);
    }
  };

  /**
   * [POST /api/auth/logout] — Logout Admin
   * Mencabut (memasukkan ke blacklist) access token dan refresh token saat ini agar tidak bisa digunakan lagi.
   */
  public static logout = async (req: Request, res: Response): Promise<Response> => {
    try {
      // Mengambil access token dari header Authorization (format: "Bearer <token>")
      const authHeader = req.headers['authorization'];
      const accessToken = authHeader && authHeader.split(' ')[1];

      // Menghitung berapa token yang berhasil di-blacklist
      let tokensBlacklisted = 0;

      if (accessToken) {
        // Memasukkan access token ke blacklist selama 15 menit (sesuai masa berlakunya)
        await addToBlacklist(accessToken, 15 * 60);
        tokensBlacklisted++;
      }

      if (req.body.refresh_token) {
        // Memasukkan refresh token ke blacklist selama 7 hari (sesuai masa berlakunya)
        await addToBlacklist(req.body.refresh_token, 7 * 24 * 60 * 60);
        tokensBlacklisted++;
      }

      // Mengambil informasi admin yang sedang logout dari object request (diisi middleware auth)
      const userId = req.user?.id ?? 0;
      const username = req.user?.username ?? 'unknown';

      logger.audit('LOGOUT', userId, {
        username,
        ip: req.ip,
        tokensBlacklisted,
      });

      return successResponse(
        res,
        null,
        `Logout berhasil. ${tokensBlacklisted} token dicabut.`
      );
    } catch (error) {
      logger.error('Error saat logout', {
        error: error instanceof Error ? error.message : String(error),
        userId: req.user?.id,
      });
      return errorResponse(res, 'Internal server error', 500);
    }
  };
}
