import { Router } from 'express';
import multer from 'multer';
import AttendanceController from '../controllers/attendance.controller';
import { authenticateToken } from '../middlewares/auth.middleware';
import { handleValidationErrors, sanitizeInputs } from '../middlewares/validate.middleware';
import { userRateLimits } from '../middlewares/userRateLimit';
import {
  validateSummary,
  validateAttendanceFilters,
  validateAttendanceId,
  validateRekapRange,
  validateMonthlyParams,
  validateImportFile,
} from '../validators/attendance.validators';

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const allowedExtensions = ['.xlsx', '.xls', '.csv'];
    const ext = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));

    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Hanya file Excel (.xlsx, .xls) atau CSV yang diperbolehkan'));
    }
  },
});

const router = Router();

// All routes require authentication and input sanitization
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
router.post(
  '/import',
  upload.single('file'),
  validateImportFile,
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
router.get('/karyawan', AttendanceController.getEmployeeAttendance);

export default router;
