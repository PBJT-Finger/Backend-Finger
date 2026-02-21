// src/validators/attendance.validators.js - Input validation for attendance endpoints
const { query, param, body } = require('express-validator');

/**
 * Validation for GET /api/attendance/summary
 */
/**
 * Validation for GET /api/attendance/summary
 */
const validateSummary = [
  query('start_date')
    .optional()
    .isISO8601()
    .withMessage('start_date must be valid ISO date (YYYY-MM-DD)')
    .custom((value, { req }) => {
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        throw new Error('Invalid start_date format');
      }
      return true;
    }),

  query('end_date')
    .optional()
    .isISO8601()
    .withMessage('end_date must be valid ISO date (YYYY-MM-DD)')
    .custom((value, { req }) => {
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        throw new Error('Invalid end_date format');
      }

      // Check if end_date is after start_date
      if (req.query.start_date) {
        const startDate = new Date(req.query.start_date);
        if (date < startDate) {
          throw new Error('end_date must be after or equal to start_date');
        }
      }

      return true;
    }),

  query('nip')
    .optional()
    .isLength({ min: 5, max: 50 })
    .withMessage('nip must be 5-50 characters')
    .trim(),

  query('page').optional().isInt({ min: 1 }).withMessage('page must be positive integer').toInt(),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 500 })
    .withMessage('limit must be between 1 and 500')
    .toInt()
];

/**
 * Validation for GET /api/attendance (list with filters)
 */
const validateAttendanceFilters = [
  query('page').optional().isInt({ min: 1 }).withMessage('page must be positive integer').toInt(),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 500 })
    .withMessage('limit must be between 1 and 500')
    .toInt(),

  query('user_id').optional().trim(),

  query('device_id').optional().trim(),

  query('start_date')
    .optional()
    .isISO8601()
    .withMessage('start_date must be valid date (YYYY-MM-DD)'),

  query('end_date')
    .optional()
    .isISO8601()
    .withMessage('end_date must be valid date (YYYY-MM-DD)'),

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
 * Validation for GET /api/attendance/rekap/bulanan (Monthly)
 */
const validateMonthlyParams = [
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

/**
 * Validation for GET /api/attendance/rekap (Date Range)
 */
const validateRekapRange = [
  query('start_date')
    .optional()
    .isISO8601()
    .withMessage('start_date must be valid ISO date (YYYY-MM-DD)'),

  query('end_date')
    .optional()
    .isISO8601()
    .withMessage('end_date must be valid ISO date (YYYY-MM-DD)')
];

/**
 * Validation for POST /api/attendance/import (file upload)
 * Note: This validates req.file from multer middleware
 */
const validateImportFile = (req, res, next) => {
  // Check if file exists
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'File tidak ditemukan',
      errors: ['Silakan upload file Excel (.xlsx, .xls) atau CSV (.csv)']
    });
  }

  const allowedMimeTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel', // .xls
    'text/csv', // .csv
    'application/csv'
  ];

  const allowedExtensions = ['.xlsx', '.xls', '.csv'];
  const fileExtension = req.file.originalname.toLowerCase().substring(req.file.originalname.lastIndexOf('.'));

  // Validate MIME type
  if (!allowedMimeTypes.includes(req.file.mimetype) && !allowedExtensions.includes(fileExtension)) {
    return res.status(400).json({
      success: false,
      message: 'Format file tidak valid',
      errors: ['Hanya menerima file Excel (.xlsx, .xls) atau CSV (.csv)']
    });
  }

  // Validate file size (5MB max)
  const maxSize = 5 * 1024 * 1024; // 5MB
  if (req.file.size > maxSize) {
    return res.status(400).json({
      success: false,
      message: 'Ukuran file terlalu besar',
      errors: ['Ukuran file maksimal 5MB']
    });
  }

  next();
};

module.exports = {
  validateSummary,
  validateAttendanceFilters,
  validateAttendanceId,
  validateMonthlyParams,
  validateRekapRange,
  validateImportFile
};
