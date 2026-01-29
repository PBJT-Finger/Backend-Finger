// src/routes/auth.routes.js - Routes untuk autentikasi admin
const express = require('express');
const AuthController = require('../controllers/auth.controller');
const { authenticateToken } = require('../middlewares/auth.middleware');

const router = express.Router();

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
 *     summary: Admin login
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', AuthController.login);

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refresh_token
 *             properties:
 *               refresh_token:
 *                 type: string
 *                 description: Refresh token
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *       401:
 *         description: Invalid refresh token
 */
router.post('/refresh', AuthController.refreshToken);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Admin logout
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 */
router.post('/logout', authenticateToken, AuthController.logout);

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register new admin account
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - email
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 description: Unique username (for display after login)
 *                 minLength: 3
 *                 maxLength: 50
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Admin email address
 *               password:
 *                 type: string
 *                 format: password
 *                 description: Strong password (min 8 chars, uppercase, lowercase, number)
 *     responses:
 *       201:
 *         description: Registration successful
 *       400:
 *         description: Validation error or username/email already exists
 */
router.post('/register', AuthController.register);

/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     summary: Request password reset code
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
 *                 description: Admin email address
 *     responses:
 *       200:
 *         description: Reset code sent to email
 *       400:
 *         description: Invalid email format
 */
router.post('/forgot-password', AuthController.forgotPassword);

/**
 * @swagger
 * /api/auth/verify-code:
 *   post:
 *     summary: Verify password reset code
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
 *         description: Code verified, reset token returned
 *       400:
 *         description: Invalid or expired code
 */
router.post('/verify-code', AuthController.verifyCode);

/**
 * @swagger
 * /api/auth/reset-password:
 *   post:
 *     summary: Reset password with verification token
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
 *         description: Password reset successful
 *       400:
 *         description: Invalid or expired token
 */
router.post('/reset-password', AuthController.resetPassword);

module.exports = router;