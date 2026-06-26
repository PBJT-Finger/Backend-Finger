/**
 * src/utils/errors.ts — Hirarki Kelas Eror Terstruktur (Typed Application Error Hierarchy)
 *
 * Semua kelas eror mewarisi kelas dasar AppError, yang mewarisi kelas Error bawaan JavaScript.
 * Controller dan Service HARUS melemparkan subclass AppError saja —
 * jangan melemparkan objek Error mentah untuk menjaga konsistensi tipe eror.
 *
 * Middleware errorHandler (errorHandler.middleware.ts) akan menangkap semua subclass AppError ini
 * dan memetakannya menjadi respons JSON terstandarisasi.
 *
 * Desain: Bendera (flag) isOperational digunakan untuk membedakan antara kesalahan bisnis yang wajar (4xx)
 * dengan bug pemrograman (5xx). Eror non-operational (isOperational = false) akan memicu pencatatan
 * stack trace lengkap untuk keperluan audit/debugging.
 */

import { HTTP_STATUS, type HttpStatusCode } from '../constants/app'; // Kode status HTTP dan tipe datanya

// ─── Kelas Dasar Eror (Base Error Class) ──────────────────────────────────────

export class AppError extends Error {
  public readonly statusCode: HttpStatusCode; // Kode status HTTP respons
  /** isOperational = true menandakan kesalahan input pengguna, data tidak ada, dsb (tidak merusak server) */
  public readonly isOperational: boolean;
  public readonly timestamp: string; // Waktu terjadinya eror
  /** Kode error berupa string unik yang mudah dibaca oleh client pengonsumsi API */
  public readonly code: string;

  constructor(
    message: string,
    statusCode: HttpStatusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR,
    isOperational = true,
    code = 'INTERNAL_ERROR'
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();
    this.code = code;

    // Mempertahankan stack trace asli di runtime V8 (Node.js)
    Error.captureStackTrace(this, this.constructor);
  }
}

// ─── Eror Validasi 400 (Bad Request) ──────────────────────────────────────────

/**
 * Dilemparkan jika data request input dari client tidak valid (misal field kosong, tipe data salah).
 * Properti `details` menampung detail kesalahan validasi per-field.
 */
export class ValidationError extends AppError {
  public readonly details: Record<string, unknown>[];

  constructor(message: string, details: Record<string, unknown>[] = []) {
    super(message, HTTP_STATUS.BAD_REQUEST, true, 'VALIDATION_FAILED');
    this.name = 'ValidationError';
    this.details = details;
  }
}

// ─── Eror Autentikasi 401 (Unauthorized) ──────────────────────────────────────

/**
 * Dilemparkan jika token JWT tidak ada, kadaluarsa, atau telah dicabut.
 */
export class AuthenticationError extends AppError {
  constructor(message = 'Autentikasi diperlukan') {
    super(message, HTTP_STATUS.UNAUTHORIZED, true, 'AUTHENTICATION_FAILED');
    this.name = 'AuthenticationError';
  }
}

// ─── Eror Otorisasi 403 (Forbidden) ───────────────────────────────────────────

/**
 * Dilemparkan jika user yang sah mencoba mengakses fitur atau melakukan tindakan
 * yang di luar hak akses role miliknya.
 */
export class AuthorizationError extends AppError {
  constructor(message = 'Hak akses tidak mencukupi') {
    super(message, HTTP_STATUS.FORBIDDEN, true, 'AUTHORIZATION_FAILED');
    this.name = 'AuthorizationError';
  }
}

// ─── Eror Data Tidak Ditemukan 404 (Not Found) ────────────────────────────────

/**
 * Dilemparkan jika data/sumber daya yang diminta tidak ada di database.
 * @param resource - Nama entitas data yang dicari (misal: 'Pegawai', 'Mesin')
 */
export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} tidak ditemukan`, HTTP_STATUS.NOT_FOUND, true, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

// ─── Eror Konflik Data 409 (Conflict) ─────────────────────────────────────────

/**
 * Dilemparkan ketika terjadi pelanggaran batasan unik database atau konflik aturan bisnis
 * (misalnya duplicate NIP, username sudah terpakai).
 */
export class ConflictError extends AppError {
  constructor(message = 'Resource sudah ada sebelumnya') {
    super(message, HTTP_STATUS.CONFLICT, true, 'CONFLICT');
    this.name = 'ConflictError';
  }
}

// ─── Eror Batas Frekuensi Request 429 (Rate Limit) ────────────────────────────

export class RateLimitError extends AppError {
  constructor(message = 'Terlalu banyak permintaan') {
    super(message, HTTP_STATUS.TOO_MANY_REQUESTS, true, 'RATE_LIMIT_EXCEEDED');
    this.name = 'RateLimitError';
  }
}

// ─── Eror Database 500 (Database Error) ───────────────────────────────────────

/**
 * Dilemparkan jika terjadi kegagalan operasi database MySQL secara tidak terduga.
 * isOperational diatur false agar memicu pencatatan log stack trace lengkap.
 * originalError tidak akan dikembalikan ke respons client demi faktor keamanan informasi.
 */
export class DatabaseError extends AppError {
  public readonly originalError: Error | null;

  constructor(message = 'Operasi database gagal dilakukan', originalError: Error | null = null) {
    super(message, HTTP_STATUS.INTERNAL_SERVER_ERROR, false, 'DATABASE_ERROR');
    this.name = 'DatabaseError';
    this.originalError = originalError;
  }
}
