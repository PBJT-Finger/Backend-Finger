// src/routes/attendance.routes.ts
// Mengatur perutean (routing) untuk seluruh operasi data kehadiran (attendance),
// mulai dari log absensi umum, detail dosen, detail karyawan, ringkasan/rekap bulanan,
// impor berkas Excel/CSV, hapus log absensi (soft delete), serta pembaruan catatan admin.

import { Router } from 'express';
import multer from 'multer'; // Middleware untuk penanganan upload berkas multipart/form-data
import AttendanceController from '../controllers/attendance.controller'; // Kontroler logika absensi
import { authenticateToken } from '../middlewares/auth.middleware'; // Middleware verifikasi token JWT
import { handleValidationErrors, sanitizeInputs } from '../middlewares/validate.middleware'; // Middleware validasi sanitasi input
import { userRateLimits } from '../middlewares/userRateLimit'; // Middleware pembatas laju request
import {
  validateSummary,
  validateAttendanceFilters,
  validateAttendanceId,
  validateRekapRange,
  validateMonthlyParams,
  validateImportFile,
} from '../validators/attendance.validators'; // Validator spesifik untuk absensi

// Konfigurasi penyimpanan multer untuk mengupload berkas ke dalam memori RAM (buffer)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // Batasi ukuran berkas maksimal 5 Megabytes (MB)
  },
  fileFilter: (req, file, cb) => {
    const allowedExtensions = ['.xlsx', '.xls', '.csv'];
    const ext = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));

    // Validasi ekstensi berkas yang diperbolehkan
    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Hanya file Excel (.xlsx, .xls) atau CSV yang diperbolehkan'));
    }
  },
});

const router = Router();

// Seluruh rute absensi di bawah ini membutuhkan verifikasi token login dan sanitasi input dari tag HTML berbahaya
router.use(authenticateToken);
router.use(sanitizeInputs);

/**
 * @swagger
 * /api/attendance/import:
 *   post:
 *     summary: Import data absensi dari file Excel/CSV
 *     tags: [Import]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: File Excel (.xlsx, .xls) atau CSV (.csv)
 *     responses:
 *       200:
 *         description: Import berhasil
 */
// Rute impor data dari file Excel/CSV (POST /api/attendance/import)
router.post(
  '/import',
  upload.single('file'), // Parsing single file dengan field 'file'
  validateImportFile, // Validasi awal keberadaan file
  AttendanceController.importAttendance
);

/**
 * @swagger
 * /api/attendance:
 *   get:
 *     summary: Dapatkan semua rekaman absensi dengan filter
 *     tags: [Attendance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Nomor halaman
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Rekaman per halaman
 *       - in: query
 *         name: id
 *         schema:
 *           type: string
 *         description: Filter berdasarkan ID pengguna
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *           format: date
 *         description: Tanggal mulai (YYYY-MM-DD)
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *           format: date
 *         description: Tanggal akhir (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: Rekaman absensi berhasil diambil
 */
// Rute mengambil log seluruh absensi (GET /api/attendance)
router.get(
  '/',
  validateAttendanceFilters,
  handleValidationErrors,
  AttendanceController.getAttendance
);

/**
 * @swagger
 * /api/attendance/summary:
 *   get:
 *     summary: Dapatkan ringkasan absensi komprehensif untuk rekap dashboard
 *     tags: [Attendance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: start_date
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: Tanggal mulai (YYYY-MM-DD)
 *       - in: query
 *         name: end_date
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: Tanggal akhir (YYYY-MM-DD)
 *       - in: query
 *         name: id
 *         schema:
 *           type: string
 *         description: Filter berdasarkan ID pengguna
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Nomor halaman
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Rekaman per halaman
 *     responses:
 *       200:
 *         description: Ringkasan absensi berhasil diambil
 */
// Rute mengambil data statistik summary (GET /api/attendance/summary)
router.get(
  '/summary',
  userRateLimits.moderate,
  validateSummary,
  handleValidationErrors,
  AttendanceController.getSummary
);

/**
 * @swagger
 * /api/attendance/rekap:
 *   get:
 *     summary: Dapatkan laporan ringkasan absensi karyawan (Detail)
 *     tags: [Report]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: start_date
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: Tanggal mulai (YYYY-MM-DD)
 *       - in: query
 *         name: end_date
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: Tanggal akhir (YYYY-MM-DD)
 *       - in: query
 *         name: id
 *         schema:
 *           type: string
 *         description: Filter berdasarkan ID pengguna
 *     responses:
 *       200:
 *         description: Ringkasan absensi berhasil diambil
 */
// Rute mengambil laporan rekapitulasi kehadiran (GET /api/attendance/rekap)
router.get(
  '/rekap',
  validateRekapRange,
  handleValidationErrors,
  AttendanceController.getAttendanceSummary
);

/**
 * @swagger
 * /api/attendance/rekap/bulanan:
 *   get:
 *     summary: Dapatkan laporan absensi bulanan detail
 *     tags: [Report]
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
 *         description: Laporan bulanan berhasil diambil
 */
// Rute mengambil laporan bulanan (GET /api/attendance/rekap/bulanan)
router.get(
  '/rekap/bulanan',
  validateMonthlyParams,
  handleValidationErrors,
  AttendanceController.getMonthlyReport
);

/**
 * @swagger
 * /api/attendance/{id}:
 *   delete:
 *     summary: Hapus rekaman absensi (soft delete)
 *     tags: [Attendance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID rekaman absensi
 *     responses:
 *       200:
 *         description: Rekaman absensi berhasil dihapus
 */
// Rute untuk melakukan soft-delete log absensi (DELETE /api/attendance/:id)
router.delete(
  '/:id',
  validateAttendanceId,
  handleValidationErrors,
  AttendanceController.deleteAttendance
);

/**
 * @swagger
 * /api/attendance/{id}/notes:
 *   patch:
 *     summary: Perbarui catatan admin
 *     tags: [Attendance]
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
 *             properties:
 *               note:
 *                 type: string
 *     responses:
 *       200:
 *         description: Berhasil
 */
// Rute memperbarui catatan admin pada log absensi (PATCH /api/attendance/:id/notes)
router.patch(
  '/:id/notes',
  validateAttendanceId,
  handleValidationErrors,
  AttendanceController.updateAdminNotes
);

/**
 * @swagger
 * /api/attendance/dosen:
 *   get:
 *     summary: Dapatkan data absensi khusus dosen
 *     tags: [Attendance]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Berhasil mengambil data dosen
 */
// Rute mengambil rekap absensi khusus dosen (GET /api/attendance/dosen)
router.get('/dosen', AttendanceController.getLecturerAttendance);

/**
 * @swagger
 * /api/attendance/karyawan:
 *   get:
 *     summary: Dapatkan data absensi khusus karyawan reguler
 *     tags: [Attendance]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Berhasil mengambil data karyawan
 */
// Rute mengambil rekap absensi khusus karyawan (GET /api/attendance/karyawan)
router.get('/karyawan', AttendanceController.getEmployeeAttendance);

export default router;
