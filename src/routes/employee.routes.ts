import { Router } from 'express';
import EmployeeController from '../controllers/employee.controller';
import { authenticateToken } from '../middlewares/auth.middleware';

const router = Router();

// All employee routes require authentication
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
router.delete('/:user_id', EmployeeController.deleteEmployee);

export default router;
