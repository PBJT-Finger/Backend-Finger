// src/routes/export.routes.ts
// Mengatur perutean (routing) endpoint API untuk mengekspor data absensi pegawai,
// mendukung format dokumen Excel (Ringkasan/Summary), Excel Detail Harian, PDF Resmi, dan CSV.

import { Router } from 'express';
import ExportController from '../controllers/export.controller'; // Kontroler logika ekspor file
import { authenticateToken } from '../middlewares/auth.middleware'; // Middleware verifikasi token JWT

const router = Router();

// Seluruh rute ekspor memerlukan token autentikasi login admin JWT yang valid
router.use(authenticateToken);

/**
 * @swagger
 * /api/export/excel:
 *   get:
 *     summary: Ekspor data absensi ke Excel
 *     tags: [Export]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: bulan
 *         required: true
 *         schema:
 *           type: string
 *         description: Bulan (01-12)
 *       - in: query
 *         name: tahun
 *         required: true
 *         schema:
 *           type: string
 *         description: Tahun (YYYY)
 *       - in: query
 *         name: id
 *         schema:
 *           type: string
 *         description: Filter berdasarkan ID pengguna
 *     responses:
 *       200:
 *         description: File Excel berhasil diunduh
 *         content:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 */
// Endpoint ekspor ringkasan absensi ke file Excel (GET /api/export/excel)
router.get('/excel', ExportController.exportToExcel);

/**
 * @swagger
 * /api/export/excel-detail:
 *   get:
 *     summary: Ekspor data absensi ke Excel (Detail)
 *     tags: [Export]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: bulan
 *         required: true
 *         schema:
 *           type: string
 *         description: Bulan (01-12)
 *       - in: query
 *         name: tahun
 *         required: true
 *         schema:
 *           type: string
 *         description: Tahun (YYYY)
 *       - in: query
 *         name: id
 *         schema:
 *           type: string
 *         description: Filter berdasarkan ID pengguna
 *     responses:
 *       200:
 *         description: File Excel detail berhasil diunduh
 *         content:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 */
// Endpoint ekspor log detail harian absensi ke file Excel (GET /api/export/excel-detail)
router.get('/excel-detail', ExportController.exportToExcelDetail);

/**
 * @swagger
 * /api/export/pdf:
 *   get:
 *     summary: Ekspor data absensi ke PDF
 *     tags: [Export]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: bulan
 *         required: true
 *         schema:
 *           type: string
 *         description: Bulan (01-12)
 *       - in: query
 *         name: tahun
 *         required: true
 *         schema:
 *           type: string
 *         description: Tahun (YYYY)
 *       - in: query
 *         name: id
 *         schema:
 *           type: string
 *         description: Filter berdasarkan ID pengguna
 *     responses:
 *       200:
 *         description: File PDF berhasil diunduh
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 */
// Endpoint ekspor laporan rekapitulasi kehadiran ke dokumen PDF Resmi (GET /api/export/pdf)
router.get('/pdf', ExportController.exportToPDF);

/**
 * @swagger
 * /api/export/csv:
 *   get:
 *     summary: Ekspor data absensi ke CSV
 *     tags: [Export]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: bulan
 *         required: true
 *         schema:
 *           type: string
 *         description: Bulan (01-12)
 *       - in: query
 *         name: tahun
 *         required: true
 *         schema:
 *           type: string
 *         description: Tahun (YYYY)
 *     responses:
 *       200:
 *         description: File CSV berhasil diunduh
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 */
// Endpoint ekspor ringkasan rekapitulasi ke file CSV (GET /api/export/csv)
router.get('/csv', ExportController.exportToCSV);

export default router;
