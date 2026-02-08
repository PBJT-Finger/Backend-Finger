// src/routes/dashboard.routes.js
const express = require('express');
const DashboardController = require('../controllers/dashboard.controller');
const { authenticateToken } = require('../middlewares/auth.middleware');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * @swagger
 * /api/dashboard/summary:
 *   get:
 *     summary: Dapatkan statistik ringkasan dashboard
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: bulan
 *         schema:
 *           type: string
 *         description: Bulan (01-12), default bulan saat ini
 *       - in: query
 *         name: tahun
 *         schema:
 *           type: string
 *         description: Tahun (YYYY), default tahun saat ini
 *     responses:
 *       200:
 *         description: Ringkasan dashboard berhasil diambil
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     bulan:
 *                       type: integer
 *                     tahun:
 *                       type: integer
 *                     total_records:
 *                       type: integer
 *                     total_users:
 *                       type: integer
 *                     total_hadir:
 *                       type: integer
 *                     total_hari_kerja:
 *                       type: integer
 *                     total_keterlambatan:
 *                       type: integer
 *                     persentase_kehadiran:
 *                       type: string
 *                     check_in:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                         terakhir:
 *                           type: object
 *                           nullable: true
 *                     check_out:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                         terakhir:
 *                           type: object
 *                           nullable: true
 *                     breakdown_jabatan:
 *                       type: object
 *                       properties:
 *                         dosen:
 *                           type: integer
 *                         karyawan:
 *                           type: integer
 */
router.get('/summary', DashboardController.getSummary);

module.exports = router;
