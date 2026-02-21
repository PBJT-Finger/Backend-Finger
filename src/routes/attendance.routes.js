const express = require('express');
const multer = require('multer');
const AttendanceController = require('../controllers/attendance.controller');
const { authenticateToken } = require('../middlewares/auth.middleware');
const { handleValidationErrors, sanitizeInputs } = require('../middlewares/validate.middleware');
const { userRateLimits } = require('../middlewares/userRateLimit'); // Phase 3
const {
  validateSummary,
  validateAttendanceFilters,
  validateAttendanceId,
  validateRekapRange,
  validateMonthlyParams,
  validateImportFile
} = require('../validators/attendance.validators');

// Configure multer for file uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB max file size
  },
  fileFilter: (req, file, cb) => {
    const allowedExtensions = ['.xlsx', '.xls', '.csv'];
    const ext = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));

    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Hanya file Excel (.xlsx, .xls) atau CSV yang diperbolehkan'));
    }
  }
});

const router = express.Router();

// All routes require authentication and input sanitization
router.use(authenticateToken);
router.use(sanitizeInputs);

/**
 *Routes - Import Data (Prioritas Tinggi)
 */



/**
 * @swagger
 * /api/attendance/import:
 *   post:
 *     summary: Import data absensi dari file Excel/CSV
 *     description: |
 *       Upload dan import data absensi secara manual dari file Excel atau CSV.
 *       
 *       **Format File:**
 *       - Kolom wajib: `nip`, `tanggal`, `jam_masuk`
 *       - Kolom opsional: `nama`, `jabatan`, `jam_keluar`, `status`, `verification_method`
 *       - Format tanggal: YYYY-MM-DD (contoh: 2026-02-15)
 *       - Format jam: HH:mm:ss (contoh: 08:30:00)
 *       
 *       **Validasi:**
 *       - NIP harus terdaftar di database karyawan/dosen
 *       - Data duplikat (NIP + tanggal + jam masuk sama) akan dilewati
 *       - Maksimal ukuran file: 5MB
 *       
 *       **Auto-fill:**
 *       - Jika `nama` atau `jabatan` kosong, akan diisi otomatis dari database
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Import berhasil: 45 dari 50 baris diimport, 5 duplikat dilewati"
 *                 data:
 *                   type: object
 *                   properties:
 *                     summary:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                           description: Total baris diproses
 *                           example: 50
 *                         imported:
 *                           type: integer
 *                           description: Jumlah data berhasil diimport
 *                           example: 45
 *                         skipped:
 *                           type: integer
 *                           description: Jumlah data dilewati
 *                           example: 5
 *                         duplicates:
 *                           type: integer
 *                           description: Jumlah data duplikat
 *                           example: 5
 *                         errors:
 *                           type: integer
 *                           description: Jumlah error validasi
 *                           example: 0
 *                     errors:
 *                       type: array
 *                       items:
 *                         type: string
 *                       description: Daftar error validasi (jika ada)
 *                       example: ["Baris 10: NIP tidak ditemukan", "Baris 15: Format tanggal tidak valid"]
 *                     duplicateDetails:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           row:
 *                             type: integer
 *                           nip:
 *                             type: string
 *                           tanggal:
 *                             type: string
 *                           jam_masuk:
 *                             type: string
 *                       description: Detail data duplikat yang dilewati
 *       400:
 *         description: Validasi gagal atau tidak ada data yang berhasil diimport
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "File tidak ditemukan"
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: string
 *       500:
 *         description: Error server
 */
router.post(
  '/import',
  upload.single('file'),
  validateImportFile,
  AttendanceController.importAttendance
);

/**
 *Routes - Attendance List & Summary
 */

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
 *     description: |
 *       Mengembalikan ringkasan absensi dengan:
 *       - Hadir (hari kehadiran berdasarkan check-in)
 *       - Total Hari Kerja (hari kerja tidak termasuk akhir pekan & hari libur)
 *       - Check In/Out Terakhir (waktu check-in/out terakhir)
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
 *           example: "2026-01-01"
 *         description: Tanggal mulai (YYYY-MM-DD)
 *       - in: query
 *         name: end_date
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *           example: "2026-01-31"
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
 *           maximum: 100
 *         description: Rekaman per halaman
 *     responses:
 *       200:
 *         description: Ringkasan absensi berhasil diambil
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Attendance summary calculated successfully"
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         description: NIP / User ID
 *                       no:
 *                         type: integer
 *                       nama:
 *                         type: string
 *                       jabatan:
 *                         type: string
 *                       totalHadir:
 *                         type: integer
 *                       totalHariKerja:
 *                         type: integer
 *                       attendanceDates:
 *                         type: string
 *                         example: "1-31 Mei 2026"
 *                       lastCheckIn:
 *                         type: string
 *                         example: "08:00"
 *                       lastCheckOut:
 *                         type: string
 *                         example: "17:00"
 *       400:
 *         description: Parameter yang diperlukan hilang
 */
// Phase 3: Apply moderate user rate limit (200 req/15min) for summary
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
 *     description: Mengembalikan data ringkasan absensi untuk setiap karyawan dengan penomoran berurutan, waktu check-in/out terakhir, dan statistik kehadiran
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
 *           example: "2026-01-01"
 *         description: Tanggal mulai (YYYY-MM-DD)
 *       - in: query
 *         name: end_date
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *           example: "2026-01-31"
 *         description: Tanggal akhir (YYYY-MM-DD)
 *       - in: query
 *         name: id
 *         schema:
 *           type: string
 *         description: Filter berdasarkan ID pengguna
 *     responses:
 *       200:
 *         description: Ringkasan absensi berhasil diambil
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Attendance summary calculated successfully"
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         description: ID Pengguna
 *                       no:
 *                         type: integer
 *                       nama:
 *                         type: string
 *                       jabatan:
 *                         type: string
 *                       totalHadir:
 *                         type: integer
 *                       totalHariKerja:
 *                         type: integer
 *                       attendanceDates:
 *                         type: string
 *                         example: "1-31 Mei 2026"
 *                       lastCheckIn:
 *                         type: string
 *                         example: "08:00"
 *                       lastCheckOut:
 *                         type: string
 *                         example: "17:00"
 *                       persentase:
 *                         type: number
 *       400:
 *         description: Parameter yang diperlukan hilang (start_date atau end_date)
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
 *       404:
 *         description: Rekaman absensi tidak ditemukan
 */
router.delete(
  '/:id',
  validateAttendanceId,
  handleValidationErrors,
  AttendanceController.deleteAttendance
);

// Pindahkan endpoint legacy ke bawah atau hapus jika tidak digunakan lagi
router.get('/dosen', AttendanceController.getLecturerAttendance);
router.get('/karyawan', AttendanceController.getEmployeeAttendance);

module.exports = router;
