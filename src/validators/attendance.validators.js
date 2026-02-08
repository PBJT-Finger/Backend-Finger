// src/validators/attendance.validators.js - Input validation for attendance endpoints
const { query, param, body } = require('express-validator');

/**
 * Validation for GET /api/attendance/summary
 */
const validateSummary = [
  query('startDate')
    .notEmpty()
    .withMessage('startDate is required')
    .isISO8601()
    .withMessage('startDate must be valid ISO date (YYYY-MM-DD)')
    .custom((value, { req }) => {
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        throw new Error('Invalid startDate format');
      }
      return true;
    }),

  query('endDate')
    .notEmpty()
    .withMessage('endDate is required')
    .isISO8601()
    .withMessage('endDate must be valid ISO date (YYYY-MM-DD)')
    .custom((value, { req }) => {
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        throw new Error('Invalid endDate format');
      }

      // Check if endDate is after startDate
      if (req.query.startDate) {
        const startDate = new Date(req.query.startDate);
        if (date < startDate) {
          throw new Error('endDate must be after or equal to startDate');
        }
      }

      return true;
    }),

  query('jabatan')
    .optional()
    .isIn(['DOSEN', 'KARYAWAN'])
    .withMessage('jabatan must be DOSEN or KARYAWAN'),

  query('nip')
    .optional()
    .isLength({ min: 5, max: 50 })
    .withMessage('nip must be 5-50 characters')
    .trim(),

  query('page').optional().isInt({ min: 1 }).withMessage('page must be positive integer').toInt(),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('limit must be between 1 and 100')
    .toInt()
];

/**
 * Validation for GET /api/attendance (list with filters)
 */
const validateAttendanceFilters = [
  query('page').optional().isInt({ min: 1 }).withMessage('page must be positive integer').toInt(),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('limit must be between 1 and 100')
    .toInt(),

  query('user_id').optional().trim(),

  query('device_id').optional().trim(),

  query('jabatan')
    .optional()
    .isIn(['DOSEN', 'KARYAWAN'])
    .withMessage('jabatan must be DOSEN or KARYAWAN'),

  query('tanggal_mulai')
    .optional()
    .isISO8601()
    .withMessage('tanggal_mulai must be valid date (YYYY-MM-DD)'),

  query('tanggal_akhir')
    .optional()
    .isISO8601()
    .withMessage('tanggal_akhir must be valid date (YYYY-MM-DD)'),

  query('tipe_absensi')
    .optional()
    .isIn(['MASUK', 'PULANG'])
    .withMessage('tipe_absensi must be MASUK or PULANG')
];

/**
 * Validation for DELETE /api/attendance/:id
 */
const validateAttendanceId = [
  param('id')
    .notEmpty()
    .withMessage('Attendance ID is required')
    .isInt({ min: 1 })
    .withMessage('Attendance ID must be positive integer')
    .toInt()
];

/**
 * Validation for GET /api/attendance/rekap
 */
const validateRekapParams = [
  query('bulan')
    .notEmpty()
    .withMessage('bulan is required')
    .isInt({ min: 1, max: 12 })
    .withMessage('bulan must be between 1 and 12')
    .toInt(),

  query('tahun')
    .notEmpty()
    .withMessage('tahun is required')
    .isInt({ min: 2020, max: 2100 })
    .withMessage('tahun must be between 2020 and 2100')
    .toInt()
];

module.exports = {
  validateSummary,
  validateAttendanceFilters,
  validateAttendanceId,
  validateRekapParams
};
