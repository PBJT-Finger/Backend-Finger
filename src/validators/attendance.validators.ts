// src/validators/attendance.validators.ts
// Kumpulan skema dan fungsi validator menggunakan express-validator untuk memeriksa parameter
// dan payload input pada endpoint API absensi (Attendance).

import { query, param, ValidationChain } from 'express-validator';
import { Request, Response, NextFunction } from 'express';

/**
 * Validasi untuk GET /api/attendance/summary
 */
export const validateSummary: ValidationChain[] = [
  query('start_date')
    .optional()
    .isISO8601()
    .withMessage('start_date harus berupa tanggal ISO yang valid (YYYY-MM-DD)')
    .custom((value) => {
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        throw new Error('Format start_date tidak valid');
      }
      return true;
    }),

  query('end_date')
    .optional()
    .isISO8601()
    .withMessage('end_date harus berupa tanggal ISO yang valid (YYYY-MM-DD)')
    .custom((value, { req }) => {
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        throw new Error('Format end_date tidak valid');
      }

      // Memastikan tanggal akhir (end_date) tidak mendahului tanggal mulai (start_date)
      if (req.query && req.query['start_date']) {
        const startDate = new Date(req.query['start_date'] as string);
        if (date < startDate) {
          throw new Error('end_date harus sama dengan atau setelah start_date');
        }
      }

      return true;
    }),

  query('user_id')
    .optional()
    .isLength({ min: 1, max: 50 })
    .withMessage('user_id harus terdiri dari 1-50 karakter')
    .trim(),

  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('page harus berupa angka bulat positif')
    .toInt(),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 500 })
    .withMessage('limit harus bernilai antara 1 sampai 500')
    .toInt(),
];

/**
 * Validasi filter pencarian GET /api/attendance (daftar absensi detail)
 */
export const validateAttendanceFilters: ValidationChain[] = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('page harus berupa angka bulat positif')
    .toInt(),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 500 })
    .withMessage('limit harus bernilai antara 1 sampai 500')
    .toInt(),

  query('user_id').optional().trim(),

  query('device_id').optional().trim(),

  query('start_date')
    .optional()
    .isISO8601()
    .withMessage('start_date harus berupa tanggal ISO (YYYY-MM-DD)'),

  query('end_date')
    .optional()
    .isISO8601()
    .withMessage('end_date harus berupa tanggal ISO (YYYY-MM-DD)'),

  query('tipe_absensi')
    .optional()
    .isIn(['MASUK', 'PULANG'])
    .withMessage('tipe_absensi harus bernilai MASUK atau PULANG'),
];

/**
 * Validasi parameter hapus log absensi DELETE /api/attendance/:id
 */
export const validateAttendanceId: ValidationChain[] = [
  param('id')
    .notEmpty()
    .withMessage('ID absensi wajib disertakan')
    .isInt({ min: 1 })
    .withMessage('ID absensi harus berupa angka bulat positif')
    .toInt(),
];

/**
 * Validasi parameter rekap bulanan GET /api/attendance/rekap/bulanan
 */
export const validateMonthlyParams: ValidationChain[] = [
  query('bulan')
    .notEmpty()
    .withMessage('Parameter bulan wajib diisi')
    .isInt({ min: 1, max: 12 })
    .withMessage('Bulan harus bernilai di antara 1 sampai 12')
    .toInt(),

  query('tahun')
    .notEmpty()
    .withMessage('Parameter tahun wajib diisi')
    .isInt({ min: 2020, max: 2100 })
    .withMessage('Tahun harus bernilai di antara 2020 sampai 2100')
    .toInt(),
];

/**
 * Validasi parameter rentang rekap absensi GET /api/attendance/rekap
 */
export const validateRekapRange: ValidationChain[] = [
  query('start_date')
    .optional()
    .isISO8601()
    .withMessage('start_date harus berupa tanggal ISO yang valid (YYYY-MM-DD)'),

  query('end_date')
    .optional()
    .isISO8601()
    .withMessage('end_date harus berupa tanggal ISO yang valid (YYYY-MM-DD)'),
];

/**
 * Validasi file unggahan (upload file Excel/CSV) POST /api/attendance/import
 */
export const validateImportFile = (
  req: Request,
  res: Response,
  next: NextFunction
): void | Response => {
  // Pastikan berkas terunggah ada
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'Berkas berkas tidak ditemukan',
      errors: ['Silakan unggah berkas Excel (.xlsx, .xls) atau CSV (.csv)'],
    });
  }

  // Daftar MIME Type berkas yang didukung
  const allowedMimeTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
    'application/csv',
  ];

  // Daftar ekstensi berkas yang didukung
  const allowedExtensions = ['.xlsx', '.xls', '.csv'];
  const fileExtension = req.file.originalname
    .toLowerCase()
    .substring(req.file.originalname.lastIndexOf('.'));

  // Validasi MIME type dan ekstensi berkas
  if (!allowedMimeTypes.includes(req.file.mimetype) && !allowedExtensions.includes(fileExtension)) {
    return res.status(400).json({
      success: false,
      message: 'Format berkas tidak valid',
      errors: ['Sistem hanya menerima file Excel (.xlsx, .xls) atau CSV (.csv)'],
    });
  }

  // Validasi ukuran berkas maksimal (Maksimal 5MB)
  const maxSize = 5 * 1024 * 1024;
  if (req.file.size > maxSize) {
    return res.status(400).json({
      success: false,
      message: 'Ukuran berkas terlalu besar',
      errors: ['Ukuran berkas maksimal adalah 5MB'],
    });
  }

  next();
};
