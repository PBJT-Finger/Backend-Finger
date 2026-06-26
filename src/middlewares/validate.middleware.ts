// src/middlewares/validate.middleware.ts
// Middleware untuk mengolah dan menangani kesalahan validasi input payload HTTP request
// yang dikirim dari client (menggunakan library express-validator).

import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationError } from 'express-validator';
import logger from '../utils/logger'; // Logger aplikasi

interface ExtractedValidationError {
  field: string; // Nama field input yang salah (misal: "email")
  message: string; // Pesan penjelasan kesalahan validasi
  value: unknown; // Nilai input mentah yang dikirim oleh user
}

/**
 * Middleware untuk menangani hasil validasi dari express-validator.
 * Jika terdapat kesalahan validasi, akan mengembalikan respons HTTP 400 Bad Request
 * beserta daftar field yang bermasalah.
 */
export const handleValidationErrors = (
  req: Request,
  res: Response,
  next: NextFunction
): void | Response => {
  const errors = validationResult(req);

  // Jika terdeteksi ada error validasi
  if (!errors.isEmpty()) {
    const extractedErrors: ExtractedValidationError[] = errors
      .array()
      .map((err: ValidationError) => {
        // Mendukung properti field 'path' (versi baru) atau 'param' (versi lama) dari express-validator
        const rawErr = err as Record<string, unknown>;
        const field = String(rawErr['path'] || rawErr['param'] || '');
        return {
          field,
          message: err.msg,
          value: rawErr['value'],
        };
      });

    // Catat kegagalan validasi ke dalam log warning
    logger.warn('Validasi input gagal', {
      path: req.path,
      method: req.method,
      ip: req.ip,
      errors: extractedErrors,
    });

    return res.status(400).json({
      success: false,
      message: 'Validasi input gagal dilakukan',
      errors: extractedErrors,
    });
  }

  next();
};

/**
 * Middleware sanitasi input request (membersihkan karakter null byte dan whitespace di ujung string).
 */
export const sanitizeInputs = (req: Request, res: Response, next: NextFunction): void => {
  // Membersihkan parameter URL query string
  if (req.query) {
    Object.keys(req.query).forEach((key) => {
      const val = req.query[key];
      if (typeof val === 'string') {
        req.query[key] = val.replace(/\0/g, '').trim(); // Hapus karakter null byte (\0) dan trim spasi
      }
    });
  }

  // Membersihkan isi payload body JSON
  if (req.body && typeof req.body === 'object') {
    Object.keys(req.body).forEach((key) => {
      const val = req.body[key];
      if (typeof val === 'string') {
        req.body[key] = val.replace(/\0/g, '').trim(); // Hapus karakter null byte (\0) dan trim spasi
      }
    });
  }

  next();
};
