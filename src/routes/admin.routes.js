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
 * /api/admin/password:
 *   put:
 *     summary: Ubah password admin
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
 *               - current_password
 *               - new_password
 *             properties:
 *               current_password:
 *                 type: string
 *                 example: "password123"
 *               new_password:
 *                 type: string
 *                 minLength: 8
 *                 example: "newpassword123"
 *     responses:
 *       200:
 *         description: Password berhasil diubah
 *       400:
 *         description: Input tidak valid
 *       401:
 *         description: Password saat ini salah
 */
router.put('/password', AdminController.changePassword);

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



module.exports = router;
