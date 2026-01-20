// src/routes/attendance.routes.js
const express = require('express');
const AttendanceController = require('../controllers/attendance.controller');
const { authenticateToken } = require('../middlewares/auth.middleware');
const { handleValidationErrors, sanitizeInputs } = require('../middlewares/validate.middleware');
const { userRateLimits } = require('../middlewares/userRateLimit'); // Phase 3
const {
    validateSummary,
    validateAttendanceFilters,
    validateAttendanceId,
    validateRekapParams
} = require('../validators/attendance.validators');

const router = express.Router();

// All routes require authentication and input sanitization
router.use(authenticateToken);
router.use(sanitizeInputs);

/**
 * @swagger
 * /api/attendance/summary:
 *   get:
 *     summary: Get comprehensive attendance summary for frontend rekap
 *     description: |
 *       Returns attendance summary with:
 *       - Hadir (days present based on check-in)
 *       - Total Hari Kerja (working days excluding weekends & holidays)
 *       - Terlambat (late days based on shift for KARYAWAN)
 *       - Presentase (attendance percentage)
 *       - Check In/Out Terakhir (last check-in/out times)
 *     tags: [Attendance Summary]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *           example: "2026-01-01"
 *         description: Start date (YYYY-MM-DD)
 *       - in: query
 *         name: endDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *           example: "2026-01-31"
 *         description: End date (YYYY-MM-DD)
 *       - in: query
 *         name: jabatan
 *         schema:
 *           type: string
 *           enum: [DOSEN, KARYAWAN]
 *         description: Filter by position (DOSEN or KARYAWAN)
 *       - in: query
 *         name: nip
 *         schema:
 *           type: string
 *         description: Filter by specific NIP
 *       - in: query
 *         name: department
 *         schema:
 *           type: string
 *         description: Filter by department
 *       - in: query
 *         name: fakultas
 *         schema:
 *           type: string
 *         description: Filter by faculty
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *           maximum: 100
 *         description: Records per page
 *     responses:
 *       200:
 *         description: Attendance summary retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       nip:
 *                         type: string
 *                       nama:
 *                         type: string
 *                       jabatan:
 *                         type: string
 *                       shift:
 *                         type: string
 *                       hadir:
 *                         type: integer
 *                       totalHariKerja:
 *                         type: integer
 *                       terlambat:
 *                         type: integer
 *                       presentase:
 *                         type: number
 *                       checkInTerakhir:
 *                         type: object
 *                       checkOutTerakhir:
 *                         type: object
 *                 pagination:
 *                   type: object
 *       400:
 *         description: Missing required parameters
 */
/**
 * Routes - Public API endpoints
 */

// Phase 3: Apply moderate user rate limit (200 req/15min) for summary
router.get('/summary',
    userRateLimits.moderate,
    validateSummary,
    handleValidationErrors,
    AttendanceController.getSummary
);

/**
 * @swagger
 * /api/attendance:
 *   get:
 *     summary: Get all attendance records with filtering
 *     tags: [Attendance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Records per page
 *       - in: query
 *         name: user_id
 *         schema:
 *           type: string
 *         description: Filter by user ID
 *       - in: query
 *         name: jabatan
 *         schema:
 *           type: string
 *           enum: [DOSEN, KARYAWAN]
 *         description: Filter by position
 *       - in: query
 *         name: tanggal_mulai
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date (YYYY-MM-DD)
 *       - in: query
 *         name: tanggal_akhir
 *         schema:
 *           type: string
 *           format: date
 *         description: End date (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: Attendance records retrieved successfully
 */
router.get('/', validateAttendanceFilters, handleValidationErrors, AttendanceController.getAttendance);

/**
 * @swagger
 * /api/attendance/dosen:
 *   get:
 *     summary: Get attendance records for lecturers only
 *     tags: [Attendance]
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
 *         name: tanggal_mulai
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: tanggal_akhir
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Lecturer attendance records retrieved successfully
 */
router.get('/dosen', AttendanceController.getLecturerAttendance);

/**
 * @swagger
 * /api/attendance/karyawan:
 *   get:
 *     summary: Get attendance records for employees only
 *     tags: [Attendance]
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
 *         name: tanggal_mulai
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: tanggal_akhir
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Employee attendance records retrieved successfully
 */
router.get('/karyawan', AttendanceController.getEmployeeAttendance);

/**
 * @swagger
 * /api/attendance/rekap:
 *   get:
 *     summary: Get employee attendance summary report
 *     description: Returns summarized attendance data for each employee with sequential numbering, last check-in/out times, and attendance statistics
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
 *         description: Start date (YYYY-MM-DD)
 *       - in: query
 *         name: end_date
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *           example: "2026-01-31"
 *         description: End date (YYYY-MM-DD)
 *       - in: query
 *         name: nip
 *         schema:
 *           type: string
 *         description: Filter by specific employee NIP
 *     responses:
 *       200:
 *         description: Attendance summary retrieved successfully
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
 *                   type: object
 *                   properties:
 *                     summary:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           no:
 *                             type: integer
 *                             description: Sequential number
 *                             example: 1
 *                           nama:
 *                             type: string
 *                             description: Full name
 *                             example: "John Doe"
 *                           nip:
 *                             type: string
 *                             description: Employee ID number
 *                             example: "123456"
 *                           jabatan:
 *                             type: string
 *                             description: Position type
 *                             enum: [DOSEN, KARYAWAN]
 *                             example: "DOSEN"
 *                           check_in_terakhir:
 *                             type: string
 *                             format: date-time
 *                             nullable: true
 *                             description: Last check-in timestamp
 *                             example: "2026-01-20T08:30:00.000Z"
 *                           check_out_terakhir:
 *                             type: string
 *                             format: date-time
 *                             nullable: true
 *                             description: Last check-out timestamp
 *                             example: "2026-01-20T17:00:00.000Z"
 *                           total_hadir:
 *                             type: integer
 *                             description: Total days present
 *                             example: 18
 *                           total_terlambat:
 *                             type: integer
 *                             description: Total days late
 *                             example: 2
 *                           total_days:
 *                             type: integer
 *                             description: Total days in period
 *                             example: 20
 *                           persentase:
 *                             type: integer
 *                             description: Attendance percentage (0-100)
 *                             example: 90
 *                     period:
 *                       type: object
 *                       properties:
 *                         start_date:
 *                           type: string
 *                           format: date
 *                         end_date:
 *                           type: string
 *                           format: date
 *                     total_employees:
 *                       type: integer
 *                       description: Total number of employees in result
 *                       example: 50
 *       400:
 *         description: Missing required parameters (start_date or end_date)
 */
router.get('/rekap', validateRekapParams, handleValidationErrors, AttendanceController.getAttendanceSummary);

/**
 * @swagger
 * /api/attendance/rekap/bulanan:
 *   get:
 *     summary: Get detailed monthly attendance report
 *     tags: [Attendance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: bulan
 *         required: true
 *         schema:
 *           type: string
 *         description: Month (01-12)
 *       - in: query
 *         name: tahun
 *         required: true
 *         schema:
 *           type: string
 *         description: Year (YYYY)
 *     responses:
 *       200:
 *         description: Monthly report retrieved successfully
 */
router.get('/rekap/bulanan', validateRekapParams, handleValidationErrors, AttendanceController.getMonthlyReport);

/**
 * @swagger
 * /api/attendance/{id}:
 *   delete:
 *     summary: Soft delete attendance record
 *     tags: [Attendance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Attendance record ID
 *     responses:
 *       200:
 *         description: Attendance record deleted successfully
 *       404:
 *         description: Attendance record not found
 */
router.delete('/:id', validateAttendanceId, handleValidationErrors, AttendanceController.deleteAttendance);

module.exports = router;