import { query, param, ValidationChain } from 'express-validator';
import { Request, Response, NextFunction } from 'express';

/**
 * Validation for GET /api/attendance/summary
 */
export const validateSummary: ValidationChain[] = [
  query('start_date')
    .optional()
    .isISO8601()
    .withMessage('start_date must be valid ISO date (YYYY-MM-DD)')
    .custom((value) => {
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
      if (req.query && req.query['start_date']) {
        const startDate = new Date(req.query['start_date'] as string);
        if (date < startDate) {
          throw new Error('end_date must be after or equal to start_date');
        }
      }

      return true;
    }),

  query('user_id')
    .optional()
    .isLength({ min: 1, max: 50 })
    .withMessage('user_id must be 1-50 characters')
    .trim(),

  query('page').optional().isInt({ min: 1 }).withMessage('page must be positive integer').toInt(),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 500 })
    .withMessage('limit must be between 1 and 500')
    .toInt(),
];

/**
 * Validation for GET /api/attendance (list with filters)
 */
export const validateAttendanceFilters: ValidationChain[] = [
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

  query('end_date').optional().isISO8601().withMessage('end_date must be valid date (YYYY-MM-DD)'),

  query('tipe_absensi')
    .optional()
    .isIn(['MASUK', 'PULANG'])
    .withMessage('tipe_absensi must be MASUK or PULANG'),
];

/**
 * Validation for DELETE /api/attendance/:id
 */
export const validateAttendanceId: ValidationChain[] = [
  param('id')
    .notEmpty()
    .withMessage('Attendance ID is required')
    .isInt({ min: 1 })
    .withMessage('Attendance ID must be positive integer')
    .toInt(),
];

/**
 * Validation for GET /api/attendance/rekap/bulanan (Monthly)
 */
export const validateMonthlyParams: ValidationChain[] = [
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
    .toInt(),
];

/**
 * Validation for GET /api/attendance/rekap (Date Range)
 */
export const validateRekapRange: ValidationChain[] = [
  query('start_date')
    .optional()
    .isISO8601()
    .withMessage('start_date must be valid ISO date (YYYY-MM-DD)'),

  query('end_date')
    .optional()
    .isISO8601()
    .withMessage('end_date must be valid ISO date (YYYY-MM-DD)'),
];

/**
 * Validation for POST /api/attendance/import (file upload)
 */
export const validateImportFile = (req: Request, res: Response, next: NextFunction): void | Response => {
  // Check if file exists
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'File tidak ditemukan',
      errors: ['Silakan upload file Excel (.xlsx, .xls) atau CSV (.csv)'],
    });
  }

  const allowedMimeTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
    'application/csv',
  ];

  const allowedExtensions = ['.xlsx', '.xls', '.csv'];
  const fileExtension = req.file.originalname
    .toLowerCase()
    .substring(req.file.originalname.lastIndexOf('.'));

  // Validate MIME type
  if (!allowedMimeTypes.includes(req.file.mimetype) && !allowedExtensions.includes(fileExtension)) {
    return res.status(400).json({
      success: false,
      message: 'Format file tidak valid',
      errors: ['Hanya menerima file Excel (.xlsx, .xls) atau CSV (.csv)'],
    });
  }

  // Validate file size (5MB max)
  const maxSize = 5 * 1024 * 1024;
  if (req.file.size > maxSize) {
    return res.status(400).json({
      success: false,
      message: 'Ukuran file terlalu besar',
      errors: ['Ukuran file maksimal 5MB'],
    });
  }

  next();
};
