// src/routes/admin.routes.js
const express = require('express');
const router = express.Router();
const AdminController = require('../controllers/admin.controller');
const { authenticateToken } = require('../middlewares/auth.middleware');
const { createUserRateLimiter } = require('../middlewares/userRateLimit');

// Apply authentication to all admin routes
router.use(authenticateToken);

// Apply rate limiting
const adminLimiter = createUserRateLimiter('moderate');
router.use(adminLimiter);

// Admin Management endpoints - using System tag for cleaner documentation

/**
 * @swagger
 * /api/admin:
 *   get:
 *     summary: Dapatkan semua admin (paginasi)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [admin, super_admin]
 *       - in: query
 *         name: is_active
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Daftar admin
 *       401:
 *         description: Tidak terautentikasi
 */
router.get('/', AdminController.getAdmins);

/**
 * @swagger
 * /api/admin/{id}:
 *   get:
 *     summary: Dapatkan admin berdasarkan ID
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Detail admin
 *       404:
 *         description: Admin tidak ditemukan
 */
router.get('/:id', AdminController.getAdminById);

/**
 * @swagger
 * /api/admin:
 *   post:
 *     summary: Buat admin baru
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
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
 *               - role
 *             properties:
 *               username:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 50
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 8
 *               role:
 *                 type: string
 *                 enum: [admin, super_admin]
 *     responses:
 *       201:
 *         description: Admin berhasil dibuat
 *       409:
 *         description: Username atau email sudah ada
 */
router.post('/', AdminController.createAdmin);

/**
 * @swagger
 * /api/admin/{id}:
 *   put:
 *     summary: Perbarui admin
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               role:
 *                 type: string
 *                 enum: [admin, super_admin]
 *               is_active:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Admin berhasil diperbarui
 *       404:
 *         description: Admin tidak ditemukan
 */
router.put('/:id', AdminController.updateAdmin);

/**
 * @swagger
 * /api/admin/{id}:
 *   delete:
 *     summary: Hapus admin
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Admin berhasil dihapus
 *       403:
 *         description: Tidak dapat menghapus akun sendiri
 *       404:
 *         description: Admin tidak ditemukan
 */
router.delete('/:id', AdminController.deleteAdmin);

/**
 * @swagger
 * /api/admin/{id}/password:
 *   put:
 *     summary: Ubah password admin
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - current_password
 *               - new_password
 *             properties:
 *               current_password:
 *                 type: string
 *               new_password:
 *                 type: string
 *                 minLength: 8
 *     responses:
 *       200:
 *         description: Password berhasil diubah
 *       401:
 *         description: Password saat ini salah
 */
router.put('/:id/password', AdminController.changePassword);

module.exports = router;
