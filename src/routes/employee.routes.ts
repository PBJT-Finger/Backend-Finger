// src/routes/employee.routes.ts
// Mengatur perutean (routing) endpoint API untuk manajemen master data Pegawai (Employees),
// mencakup pengambilan daftar pegawai dengan filter pencarian dan paginasi, pembaruan profil data pegawai,
// serta penonaktifan pegawai (soft delete).

import { Router } from 'express';
import EmployeeController from '../controllers/employee.controller'; // Kontroler logika pegawai
import { authenticateToken } from '../middlewares/auth.middleware'; // Middleware verifikasi token JWT

const router = Router();

// Seluruh rute pegawai memerlukan autentikasi login token JWT
router.use(authenticateToken);

/**
 * @swagger
 * /api/employees:
 *   get:
 *     summary: Dapatkan daftar pegawai (Dosen / Karyawan)
 *     tags: [Employees]
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
 *           default: 50
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Cari berdasarkan nama atau user_id
 *       - in: query
 *         name: jabatan
 *         schema:
 *           type: string
 *           enum: [DOSEN, KARYAWAN]
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [AKTIF, CUTI, RESIGN, NON_AKTIF]
 *       - in: query
 *         name: is_active
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Daftar pegawai berhasil diambil
 */
// Endpoint untuk mengambil daftar pegawai berpaginasi (GET /api/employees)
router.get('/', EmployeeController.getEmployees);

/**
 * @swagger
 * /api/employees/{user_id}:
 *   put:
 *     summary: Perbarui data master pegawai
 *     tags: [Employees]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: user_id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nama:
 *                 type: string
 *               jabatan:
 *                 type: string
 *                 enum: [DOSEN, KARYAWAN]
 *               shift_id:
 *                 type: integer
 *                 nullable: true
 *               status:
 *                 type: string
 *                 enum: [AKTIF, CUTI, RESIGN, NON_AKTIF]
 *     responses:
 *       200:
 *         description: Data pegawai berhasil diperbarui
 */
// Endpoint untuk memperbarui data pegawai berdasarkan ID (PUT /api/employees/:user_id)
router.put('/:user_id', EmployeeController.updateEmployee);

/**
 * @swagger
 * /api/employees/{user_id}:
 *   delete:
 *     summary: Nonaktifkan pegawai (Soft delete)
 *     tags: [Employees]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: user_id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Pegawai berhasil dinonaktifkan
 */
// Endpoint untuk menonaktifkan akun pegawai (DELETE /api/employees/:user_id)
router.delete('/:user_id', EmployeeController.deleteEmployee);

export default router;
