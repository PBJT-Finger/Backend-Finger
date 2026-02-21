// src/controllers/auth.controller.js - Controller untuk autentikasi admin (Prisma)
const prisma = require('../config/prisma');
const { generateTokens, verifyRefreshToken } = require('../utils/jwt');
const { addToBlacklist, isBlacklisted } = require('../utils/tokenBlacklist');
const { body, validationResult } = require('express-validator');
const logger = require('../utils/logger');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const {
  loginResponse,
  registerResponse,
  passwordResetResponse,
  successResponse,
  errorResponse
} = require('../utils/responseFormatter');
const {
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendPasswordResetConfirmation
} = require('../services/emailService');

class AuthController {
  /**
   * Admin Login
   */
  static login = [
    body('email').trim().isEmail().withMessage('Email tidak valid').normalizeEmail(),
    body('password').isLength({ min: 6 }).withMessage('Password minimal 6 karakter'),

    async (req, res) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          logger.warn('Login validation failed', {
            ip: req.ip,
            errors: errors.array()
          });
          return errorResponse(res, errors.array()[0].msg, 400);
        }

        const { email, password } = req.body;

        // Find admin by email
        const admin = await prisma.admins.findFirst({
          where: { email, is_active: true }
        });

        if (!admin) {
          logger.warn('Login failed: User not found', { email, ip: req.ip });
          return errorResponse(res, 'Email atau password salah', 401);
        }

        const isValidPassword = await bcrypt.compare(password, admin.password_hash);

        if (!isValidPassword) {
          logger.warn('Login failed: Invalid password', { email, ip: req.ip });
          return errorResponse(res, 'Email atau password salah', 401);
        }

        const { accessToken, refreshToken } = generateTokens(admin);

        // Update last login
        await prisma.admins.update({
          where: { id: admin.id },
          data: { last_login: new Date() }
        });

        logger.audit('LOGIN_SUCCESS', admin.id, {
          username: admin.username,
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });

        return loginResponse(res, admin, accessToken, refreshToken);
      } catch (error) {
        logger.error('Login error', { error: error.message, stack: error.stack, ip: req.ip });
        return errorResponse(res, 'Internal server error', 500);
      }
    }
  ];

  static register = [
    body('username')
      .trim()
      .isLength({ min: 3, max: 50 })
      .withMessage('Username harus 3-50 karakter')
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage('Username hanya boleh huruf, angka, dan underscore'),
    body('email').trim().isEmail().withMessage('Email tidak valid').normalizeEmail(),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password minimal 8 karakter')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password harus mengandung huruf besar, huruf kecil, dan angka'),

    async (req, res) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return errorResponse(res, errors.array()[0].msg, 400);
        }

        const { username, email, password } = req.body;

        // Check if username exists
        const existingUsername = await prisma.admins.findFirst({
          where: { username },
          select: { id: true }
        });
        if (existingUsername) {
          return errorResponse(res, 'Username sudah digunakan', 400);
        }

        // Check if email exists
        const existing = await prisma.admins.findFirst({
          where: { email },
          select: { id: true }
        });
        if (existing) {
          return errorResponse(res, 'Email sudah terdaftar', 400);
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        // Insert new admin
        const newAdmin = await prisma.admins.create({
          data: {
            username,
            email,
            password_hash: hashedPassword,
            role: 'admin',
            is_active: true,
            created_at: new Date(),
            updated_at: new Date()
          },
          select: {
            id: true,
            username: true,
            email: true,
            role: true,
            is_active: true
          }
        });

        try {
          await sendWelcomeEmail(email, username);
        } catch (emailError) {
          logger.warn('Failed to send welcome email', { email, error: emailError.message });
        }

        logger.audit('ADMIN_REGISTERED', newAdmin.id, { username, email, ip: req.ip });

        return registerResponse(res, newAdmin);
      } catch (error) {
        logger.error('Register error', { error: error.message, stack: error.stack, ip: req.ip });
        return errorResponse(res, 'Gagal mendaftar. Silakan coba lagi.', 500);
      }
    }
  ];

  /**
   * Forgot Password
   */
  static forgotPassword = [
    body('email').trim().isEmail().withMessage('Email tidak valid').normalizeEmail(),

    async (req, res) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return errorResponse(res, 'Email tidak valid', 400);
        }

        const { email } = req.body;

        const admin = await prisma.admins.findFirst({
          where: { email, is_active: true }
        });

        if (!admin) {
          logger.warn('Password reset requested for non-existent email', { email, ip: req.ip });
          return passwordResetResponse(res);
        }

        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

        // Delete old unused reset requests
        await prisma.password_resets.deleteMany({
          where: { admin_id: admin.id, used_at: null }
        });

        // Create new reset request
        await prisma.password_resets.create({
          data: {
            admin_id: admin.id,
            email: admin.email,
            code,
            expires_at: expiresAt,
            created_at: new Date()
          }
        });

        try {
          await sendPasswordResetEmail(email, code, admin.username);
        } catch (emailError) {
          logger.warn('Failed to send password reset email', { email, error: emailError.message });
          logger.info('PASSWORD RESET CODE (Development)', { email, code });
        }

        logger.audit('PASSWORD_RESET_REQUESTED', admin.id, { email, ip: req.ip });

        return passwordResetResponse(res);
      } catch (error) {
        logger.error('Forgot password error', {
          error: error.message,
          stack: error.stack,
          ip: req.ip
        });
        return errorResponse(res, 'Terjadi kesalahan. Silakan coba lagi.', 500);
      }
    }
  ];

  /**
   * Verify Code
   */
  static verifyCode = [
    body('email').trim().isEmail().withMessage('Email tidak valid').normalizeEmail(),
    body('code')
      .trim()
      .isLength({ min: 6, max: 6 })
      .withMessage('Kode harus 6 digit')
      .isNumeric()
      .withMessage('Kode harus berupa angka'),

    async (req, res) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return errorResponse(res, errors.array()[0].msg, 400);
        }

        const { email, code } = req.body;

        const resetEntry = await prisma.password_resets.findFirst({
          where: { email, code, used_at: null },
          include: { admins: { select: { is_active: true } } }
        });

        if (!resetEntry || !resetEntry.admins?.is_active) {
          logger.warn('Invalid verification code attempt', { email, ip: req.ip });
          return errorResponse(res, 'Kode verifikasi tidak valid', 400);
        }

        if (new Date() > new Date(resetEntry.expires_at)) {
          logger.warn('Expired verification code attempt', { email, ip: req.ip });
          return errorResponse(res, 'Kode verifikasi sudah kadaluarsa', 400);
        }

        const resetToken = crypto.randomBytes(32).toString('hex');

        await prisma.password_resets.update({
          where: { id: resetEntry.id },
          data: { reset_token: resetToken }
        });

        logger.audit('RESET_CODE_VERIFIED', resetEntry.admin_id, { email, ip: req.ip });

        return passwordResetResponse(res, { resetToken }, 'Kode valid');
      } catch (error) {
        logger.error('Verify code error', { error: error.message, stack: error.stack, ip: req.ip });
        return errorResponse(res, 'Terjadi kesalahan. Silakan coba lagi.', 500);
      }
    }
  ];

  /**
   * Reset Password
   */
  static resetPassword = [
    body('resetToken').notEmpty().withMessage('Reset token diperlukan'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('Password minimal 8 karakter')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password harus mengandung huruf besar, huruf kecil, dan angka'),

    async (req, res) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return errorResponse(res, errors.array()[0].msg, 400);
        }

        const { resetToken, newPassword } = req.body;

        const resetEntry = await prisma.password_resets.findFirst({
          where: { reset_token: resetToken, used_at: null },
          include: { admins: { select: { is_active: true, username: true } } }
        });

        if (!resetEntry || !resetEntry.admins?.is_active) {
          logger.warn('Invalid reset token attempt', { ip: req.ip });
          return errorResponse(res, 'Token reset tidak valid atau sudah digunakan', 400);
        }

        if (new Date() > new Date(resetEntry.expires_at)) {
          logger.warn('Expired reset token attempt', { ip: req.ip });
          return errorResponse(res, 'Token reset sudah kadaluarsa', 400);
        }

        const hashedPassword = await bcrypt.hash(newPassword, 12);

        // Update password and mark reset as used in a transaction
        await prisma.$transaction([
          prisma.admins.update({
            where: { id: resetEntry.admin_id },
            data: { password_hash: hashedPassword, updated_at: new Date() }
          }),
          prisma.password_resets.update({
            where: { id: resetEntry.id },
            data: { used_at: new Date() }
          })
        ]);

        try {
          await sendPasswordResetConfirmation(resetEntry.email, resetEntry.admins.username);
        } catch (emailError) {
          logger.warn('Failed to send password reset confirmation email', {
            email: resetEntry.email,
            error: emailError.message
          });
        }

        logger.audit('PASSWORD_RESET_COMPLETED', resetEntry.admin_id, {
          email: resetEntry.email,
          ip: req.ip
        });

        return passwordResetResponse(res, null, 'Password berhasil direset');
      } catch (error) {
        logger.error('Reset password error', {
          error: error.message,
          stack: error.stack,
          ip: req.ip
        });
        return errorResponse(res, 'Gagal mereset password. Silakan coba lagi.', 500);
      }
    }
  ];

  /**
   * Refresh Token
   */
  static refreshToken = async (req, res) => {
    try {
      const { refresh_token } = req.body;

      if (!refresh_token) {
        return errorResponse(res, 'Refresh token diperlukan', 400);
      }

      const blacklisted = await isBlacklisted(refresh_token);
      if (blacklisted) {
        logger.warn('Refresh token failed: Token is blacklisted', { ip: req.ip });
        return errorResponse(res, 'Refresh token has been revoked. Please login again.', 401);
      }

      const decoded = verifyRefreshToken(refresh_token);

      const admin = await prisma.admins.findUnique({
        where: { id: decoded.id }
      });

      if (!admin || !admin.is_active) {
        logger.warn('Refresh token failed: User not found or inactive', { userId: decoded.id });
        return errorResponse(res, 'Invalid refresh token', 401);
      }

      await addToBlacklist(refresh_token, 7 * 24 * 60 * 60);
      logger.info('Old refresh token blacklisted during rotation', { userId: admin.id });

      const { accessToken, refreshToken: newRefreshToken } = generateTokens(admin);

      logger.audit('TOKEN_REFRESH_ROTATED', admin.id, { ip: req.ip });

      return successResponse(
        res,
        {
          tokens: {
            access_token: accessToken,
            refresh_token: newRefreshToken,
            token_type: 'Bearer',
            expires_in: 15 * 60
          }
        },
        'Tokens refreshed successfully'
      );
    } catch (error) {
      logger.error('Refresh token error', { error: error.message, ip: req.ip });
      return errorResponse(res, 'Invalid refresh token', 401);
    }
  };

  /**
   * Logout
   */
  static logout = async (req, res) => {
    try {
      const authHeader = req.headers['authorization'];
      const accessToken = authHeader && authHeader.split(' ')[1];

      let tokensBlacklisted = 0;

      if (accessToken) {
        await addToBlacklist(accessToken, 15 * 60);
        tokensBlacklisted++;
      }

      if (req.body.refresh_token) {
        await addToBlacklist(req.body.refresh_token, 7 * 24 * 60 * 60);
        tokensBlacklisted++;
      }

      logger.audit('LOGOUT', req.user.id, {
        username: req.user.username,
        ip: req.ip,
        tokensBlacklisted
      });

      return successResponse(
        res,
        null,
        `Logout berhasil. ${tokensBlacklisted} token(s) invalidated.`
      );
    } catch (error) {
      logger.error('Logout error', { error: error.message, userId: req.user?.id });
      return errorResponse(res, 'Internal server error', 500);
    }
  };
}

module.exports = AuthController;

