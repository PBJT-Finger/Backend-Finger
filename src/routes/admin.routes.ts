// src/routes/admin.routes.ts
// Mengatur perutean (routing) endpoint API untuk manajemen Admin.
// Semua rute di sini memerlukan autentikasi token JWT (authenticateToken) 
// dan menerapkan pembatasan laju permintaan (rate limiting) tingkat sedang.

import { Router } from 'express';
import AdminController from '../controllers/admin.controller'; // Kontroler logika admin
import { authenticateToken } from '../middlewares/auth.middleware'; // Middleware verifikasi token JWT
import { userRateLimits } from '../middlewares/userRateLimit'; // Middleware pencegah spam request

const router = Router();

// Terapkan middleware autentikasi token di seluruh rute admin
router.use(authenticateToken);

// Terapkan rate limiter level 'moderate' di seluruh rute admin
router.use(userRateLimits.moderate);

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
// Endpoint untuk membuat admin baru (POST /api/admin)
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
// Endpoint untuk mengganti password admin sendiri (PUT /api/admin/password)
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
// Endpoint untuk memperbarui data admin lain berdasarkan ID (PUT /api/admin/:id)
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
// Endpoint untuk menghapus admin berdasarkan ID (DELETE /api/admin/:id)
router.delete('/:id', AdminController.deleteAdmin);

export default router;
