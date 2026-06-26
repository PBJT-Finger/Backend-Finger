// src/routes/auth.routes.ts
// Mengatur perutean (routing) untuk endpoint autentikasi admin,
// mencakup login, registrasi admin baru, refresh token JWT, logout,
// lupa password (minta OTP), verifikasi OTP, dan reset password dengan token.

import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller'; // Kontroler logika autentikasi
import { authenticateToken } from '../middlewares/auth.middleware'; // Middleware verifikasi token JWT

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     LoginRequest:
 *       type: object
 *       required:
 *         - email
 *         - password
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           description: Admin email address
 *         password:
 *           type: string
 *           description: Password admin
 *     LoginResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         message:
 *           type: string
 *         data:
 *           type: object
 *           properties:
 *             user:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                 username:
 *                   type: string
 *                 role:
 *                   type: string
 *                 email:
 *                   type: string
 *             tokens:
 *               type: object
 *               properties:
 *                 access_token:
 *                   type: string
 *                 refresh_token:
 *                   type: string
 *                 token_type:
 *                   type: string
 *                 expires_in:
 *                   type: integer
 */

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login admin
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Login berhasil
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *       401:
 *         description: Kredensial tidak valid
 */
// Endpoint untuk proses login admin (POST /api/auth/login)
router.post('/login', AuthController.login);

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh token admin
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 description: Token refresh yang valid
 *     responses:
 *       200:
 *         description: Token berhasil diperbarui
 *       401:
 *         description: Refresh token tidak valid atau kadaluarsa
 */
// Endpoint untuk memperbarui access token (POST /api/auth/refresh)
router.post('/refresh', AuthController.refreshToken);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout admin
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout berhasil
 */
// Endpoint untuk logout admin (POST /api/auth/logout)
// Memerlukan validasi token Bearer agar tahu token siapa yang akan dicabut
router.post('/logout', authenticateToken, AuthController.logout);



/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     summary: Minta kode reset password
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Alamat email admin
 *     responses:
 *       200:
 *         description: Kode reset dikirim to email
 *       400:
 *         description: Format email tidak valid
 */
// Endpoint untuk meminta kode OTP reset password (POST /api/auth/forgot-password)
router.post('/forgot-password', AuthController.forgotPassword);

/**
 * @swagger
 * /api/auth/verify-code:
 *   post:
 *     summary: Verifikasi kode reset password
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - code
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Admin email address
 *               code:
 *                 type: string
 *                 description: 6-digit verification code
 *     responses:
 *       200:
 *         description: Kode terverifikasi, token reset dikembalikan
 *       400:
 *         description: Kode tidak valid atau kadaluarsa
 */
// Endpoint untuk memverifikasi OTP 6 digit (POST /api/auth/verify-code)
router.post('/verify-code', AuthController.verifyCode);

/**
 * @swagger
 * /api/auth/reset-password:
 *   post:
 *     summary: Reset password dengan token verifikasi
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - resetToken
 *               - newPassword
 *             properties:
 *               resetToken:
 *                 type: string
 *                 description: Token received from verify-code endpoint
 *               newPassword:
 *                 type: string
 *                 format: password
 *                 description: New password (min 8 chars, uppercase, lowercase, number)
 *     responses:
 *       200:
 *         description: Reset password berhasil
 *       400:
 *         description: Token tidak valid atau kadaluarsa
 */
// Endpoint untuk melakukan reset password menggunakan token verifikasi (POST /api/auth/reset-password)
router.post('/reset-password', AuthController.resetPassword);

export default router;
