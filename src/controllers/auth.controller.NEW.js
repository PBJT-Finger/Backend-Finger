// src/controllers/auth.controller.NEW.js - Extended controller dengan response format baru
const { Admin, PasswordReset } = require('../models');
const { generateTokens, verifyRefreshToken } = require('../utils/jwt');
const { addToBlacklist, isBlacklisted } = require('../utils/tokenBlacklist');
const { body, validationResult } = require('express-validator');
const logger = require('../utils/logger');
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
const { Op } = require('sequelize');

class AuthController {
    /**
     * Admin Login
     * POST /api/auth/login
     */
    static login = [
        // Validation
        body('username')
            .trim()
            .isLength({ min: 3, max: 50 })
            .withMessage('Username harus antara 3 dan 50 karakter'),
        body('password')
            .isLength({ min: 6 })
            .withMessage('Password minimal 6 karakter'),

        async (req, res) => {
            try {
                // Check validation errors
                const errors = validationResult(req);
                if (!errors.isEmpty()) {
                    logger.warn('Login validation failed', {
                        ip: req.ip,
                        errors: errors.array()
                    });
                    return errorResponse(res, 'Validation failed', 400);
                }

                const { username, password } = req.body;

                // Find admin user
                const admin = await Admin.findOne({
                    where: { username, is_active: true }
                });

                if (!admin) {
                    logger.warn('Login failed: User not found', {
                        username,
                        ip: req.ip
                    });
                    return errorResponse(res, 'Email atau password salah', 401);
                }

                // Verify password
                const isValidPassword = await admin.checkPassword(password);
                if (!isValidPassword) {
                    logger.warn('Login failed: Invalid password', {
                        username,
                        ip: req.ip
                    });
                    return errorResponse(res, 'Email atau password salah', 401);
                }

                // Generate JWT tokens
                const { accessToken, refreshToken } = generateTokens(admin);

                // Update last login
                await admin.update({ last_login: new Date() });

                // Audit log
                logger.audit('LOGIN_SUCCESS', admin.id, {
                    username: admin.username,
                    ip: req.ip,
                    userAgent: req.get('User-Agent')
                });

                // Use new response format
                return loginResponse(res, admin, accessToken, refreshToken);

            } catch (error) {
                logger.error('Login error', {
                    error: error.message,
                    stack: error.stack,
                    ip: req.ip
                });
                return errorResponse(res, 'Internal server error', 500);
            }
        }
    ];

    /**
     * Register New Admin
     * POST /api/auth/register
     */
    static register = [
        // Validation
        body('username')
            .trim()
            .isLength({ min: 3, max: 50 })
            .withMessage('Username harus antara 3 dan 50 karakter')
            .matches(/^[a-zA-Z0-9_]+$/)
            .withMessage('Username hanya boleh mengandung huruf, angka, dan underscore'),
        body('email')
            .trim()
            .isEmail()
            .withMessage('Email tidak valid')
            .normalizeEmail(),
        body('password')
            .isLength({ min: 8 })
            .withMessage('Password minimal 8 karakter')
            .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
            .withMessage('Password harus mengandung huruf besar, huruf kecil, dan angka'),

        async (req, res) => {
            try {
                // Check validation errors
                const errors = validationResult(req);
                if (!errors.isEmpty()) {
                    logger.warn('Register validation failed', {
                        ip: req.ip,
                        errors: errors.array()
                    });
                    return errorResponse(res, errors.array()[0].msg, 400);
                }

                const { username, email, password } = req.body;

                // Check if username already exists
                const existingUsername = await Admin.findOne({ where: { username } });
                if (existingUsername) {
                    return errorResponse(res, 'Username sudah digunakan', 400);
                }

                // Check if email already exists
                const existingEmail = await Admin.findOne({ where: { email } });
                if (existingEmail) {
                    return errorResponse(res, 'Email sudah terdaftar', 400);
                }

                // Create new admin (password will be hashed by beforeCreate hook)
                const admin = await Admin.create({
                    username,
                    email,
                    password_hash: password, // Will be hashed by model hook
                    role: 'admin',
                    is_active: true
                });

                // Send welcome email
                try {
                    await sendWelcomeEmail(email, username);
                } catch (emailError) {
                    logger.warn('Failed to send welcome email', {
                        email,
                        error: emailError.message
                    });
                    // Don't fail registration if email fails
                }

                // Audit log
                logger.audit('ADMIN_REGISTERED', admin.id, {
                    username,
                    email,
                    ip: req.ip
                });

                return registerResponse(res, admin);

            } catch (error) {
                logger.error('Register error', {
                    error: error.message,
                    stack: error.stack,
                    ip: req.ip
                });
                return errorResponse(res, 'Gagal mendaftar. Silakan coba lagi.', 500);
            }
        }
    ];

    /**
     * Forgot Password - Request reset code
     * POST /api/auth/forgot-password
     */
    static forgotPassword = [
        // Validation
        body('email')
            .trim()
            .isEmail()
            .withMessage('Email tidak valid')
            .normalizeEmail(),

        async (req, res) => {
            try {
                // Check validation errors
                const errors = validationResult(req);
                if (!errors.isEmpty()) {
                    return errorResponse(res, 'Email tidak valid', 400);
                }

                const { email } = req.body;

                // Find admin by email
                const admin = await Admin.findOne({ where: { email, is_active: true } });

                // Always return success even if email not found (security best practice)
                if (!admin) {
                    logger.warn('Password reset requested for non-existent email', {
                        email,
                        ip: req.ip
                    });
                    return passwordResetResponse(res);
                }

                // Generate 6-digit code
                const code = Math.floor(100000 + Math.random() * 900000).toString();

                // Set expiration to 15 minutes from now
                const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

                // Delete any existing unused reset codes for this admin
                await PasswordReset.destroy({
                    where: {
                        admin_id: admin.id,
                        used_at: null
                    }
                });

                // Create password reset entry
                await PasswordReset.create({
                    admin_id: admin.id,
                    email: admin.email,
                    code,
                    expires_at: expiresAt
                });

                // Send email with code
                try {
                    await sendPasswordResetEmail(email, code, admin.username);
                } catch (emailError) {
                    logger.error('Failed to send password reset email', {
                        email,
                        error: emailError.message
                    });
                    return errorResponse(res, 'Gagal mengirim email. Silakan coba lagi.', 500);
                }

                // Audit log
                logger.audit('PASSWORD_RESET_REQUESTED', admin.id, {
                    email,
                    ip: req.ip
                });

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
     * Verify Reset Code
     * POST /api/auth/verify-code
     */
    static verifyCode = [
        // Validation
        body('email')
            .trim()
            .isEmail()
            .withMessage('Email tidak valid')
            .normalizeEmail(),
        body('code')
            .trim()
            .isLength({ min: 6, max: 6 })
            .withMessage('Kode harus 6 digit')
            .isNumeric()
            .withMessage('Kode harus berupa angka'),

        async (req, res) => {
            try {
                // Check validation errors
                const errors = validationResult(req);
                if (!errors.isEmpty()) {
                    return errorResponse(res, errors.array()[0].msg, 400);
                }

                const { email, code } = req.body;

                // Find password reset entry
                const resetEntry = await PasswordReset.findOne({
                    where: {
                        email,
                        code,
                        used_at: null
                    },
                    include: [{
                        model: Admin,
                        as: 'admin',
                        where: { is_active: true }
                    }]
                });

                if (!resetEntry) {
                    logger.warn('Invalid verification code attempt', {
                        email,
                        ip: req.ip
                    });
                    return errorResponse(res, 'Kode verifikasi tidak valid', 400);
                }

                // Check if code is expired
                if (resetEntry.isExpired()) {
                    logger.warn('Expired verification code attempt', {
                        email,
                        ip: req.ip
                    });
                    return errorResponse(res, 'Kode verifikasi sudah kadaluarsa', 400);
                }

                // Generate temporary reset token
                const resetToken = crypto.randomBytes(32).toString('hex');

                // Update reset entry with token
                await resetEntry.update({ reset_token: resetToken });

                // Audit log
                logger.audit('RESET_CODE_VERIFIED', resetEntry.admin.id, {
                    email,
                    ip: req.ip
                });

                return passwordResetResponse(
                    res,
                    { resetToken },
                    'Kode valid'
                );

            } catch (error) {
                logger.error('Verify code error', {
                    error: error.message,
                    stack: error.stack,
                    ip: req.ip
                });
                return errorResponse(res, 'Terjadi kesalahan. Silakan coba lagi.', 500);
            }
        }
    ];

    /**
     * Reset Password
     * POST /api/auth/reset-password
     */
    static resetPassword = [
        // Validation
        body('resetToken')
            .notEmpty()
            .withMessage('Reset token diperlukan'),
        body('newPassword')
            .isLength({ min: 8 })
            .withMessage('Password minimal 8 karakter')
            .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
            .withMessage('Password harus mengandung huruf besar, huruf kecil, dan angka'),

        async (req, res) => {
            try {
                // Check validation errors
                const errors = validationResult(req);
                if (!errors.isEmpty()) {
                    return errorResponse(res, errors.array()[0].msg, 400);
                }

                const { resetToken, newPassword } = req.body;

                // Find reset entry by token
                const resetEntry = await PasswordReset.findOne({
                    where: {
                        reset_token: resetToken,
                        used_at: null
                    },
                    include: [{
                        model: Admin,
                        as: 'admin',
                        where: { is_active: true }
                    }]
                });

                if (!resetEntry) {
                    logger.warn('Invalid reset token attempt', {
                        ip: req.ip
                    });
                    return errorResponse(res, 'Token reset tidak valid atau sudah digunakan', 400);
                }

                // Check if token is expired
                if (resetEntry.isExpired()) {
                    logger.warn('Expired reset token attempt', {
                        ip: req.ip
                    });
                    return errorResponse(res, 'Token reset sudah kadaluarsa', 400);
                }

                // Update admin password (will be hashed by beforeUpdate hook)
                await resetEntry.admin.update({
                    password_hash: newPassword
                });

                // Mark reset entry as used
                await resetEntry.markAsUsed();

                // Send confirmation email
                try {
                    await sendPasswordResetConfirmation(
                        resetEntry.email,
                        resetEntry.admin.username
                    );
                } catch (emailError) {
                    logger.warn('Failed to send password reset confirmation email', {
                        email: resetEntry.email,
                        error: emailError.message
                    });
                    // Don't fail reset if email fails
                }

                // Audit log
                logger.audit('PASSWORD_RESET_COMPLETED', resetEntry.admin.id, {
                    email: resetEntry.email,
                    ip: req.ip
                });

                return passwordResetResponse(
                    res,
                    null,
                    'Password berhasil direset'
                );

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
     * Refresh Access Token
     * POST /api/auth/refresh
     */
    static refreshToken = async (req, res) => {
        try {
            const { refresh_token } = req.body;

            if (!refresh_token) {
                return errorResponse(res, 'Refresh token diperlukan', 400);
            }

            // Check if refresh token is blacklisted
            const blacklisted = await isBlacklisted(refresh_token);
            if (blacklisted) {
                logger.warn('Refresh token failed: Token is blacklisted', {
                    ip: req.ip
                });
                return errorResponse(res, 'Refresh token has been revoked. Please login again.', 401);
            }

            // Verify refresh token
            const decoded = verifyRefreshToken(refresh_token);

            // Find admin user
            const admin = await Admin.findByPk(decoded.id);
            if (!admin || !admin.is_active) {
                logger.warn('Refresh token failed: User not found or inactive', {
                    userId: decoded.id
                });
                return errorResponse(res, 'Invalid refresh token', 401);
            }

            // Blacklist old refresh token (rotation security)
            await addToBlacklist(refresh_token, 7 * 24 * 60 * 60);
            logger.info('Old refresh token blacklisted during rotation', {
                userId: admin.id
            });

            // Generate NEW tokens
            const { accessToken, refreshToken: newRefreshToken } = generateTokens(admin);

            // Audit log
            logger.audit('TOKEN_REFRESH_ROTATED', admin.id, {
                ip: req.ip
            });

            return successResponse(res, {
                tokens: {
                    access_token: accessToken,
                    refresh_token: newRefreshToken,
                    token_type: 'Bearer',
                    expires_in: 15 * 60
                }
            }, 'Tokens refreshed successfully');

        } catch (error) {
            logger.error('Refresh token error', {
                error: error.message,
                ip: req.ip
            });
            return errorResponse(res, 'Invalid refresh token', 401);
        }
    };

    /**
     * Logout
     * POST /api/auth/logout
     */
    static logout = async (req, res) => {
        try {
            // Extract access token from header
            const authHeader = req.headers['authorization'];
            const accessToken = authHeader && authHeader.split(' ')[1];

            let tokensBlacklisted = 0;

            // Blacklist access token (15 minutes TTL)
            if (accessToken) {
                await addToBlacklist(accessToken, 15 * 60);
                tokensBlacklisted++;
            }

            // Blacklist refresh token if provided (7 days TTL)
            if (req.body.refresh_token) {
                await addToBlacklist(req.body.refresh_token, 7 * 24 * 60 * 60);
                tokensBlacklisted++;
            }

            // Audit log
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
            logger.error('Logout error', {
                error: error.message,
                userId: req.user?.id
            });
            return errorResponse(res, 'Internal server error', 500);
        }
    };
}

module.exports = AuthController;
