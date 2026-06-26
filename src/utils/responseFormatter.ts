// src/utils/responseFormatter.ts
// Format respons HTTP standar (Success, Error, Pagination, Login, Register) untuk API.
// Memastikan semua endpoint mengembalikan struktur envelope JSON yang seragam untuk frontend.

import { Response } from 'express';

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * Mengirim respons sukses standar (Success Response).
 */
export const successResponse = (
  res: Response,
  data: unknown = null,
  message = 'Success',
  statusCode = 200
): Response => {
  const response: Record<string, unknown> = {
    success: true,
    message,
  };

  if (data !== null) {
    response['data'] = data;
  }

  return res.status(statusCode).json(response);
};

/**
 * Mengirim respons eror standar (Error Response).
 */
export const errorResponse = (
  res: Response,
  message = 'Terjadi kesalahan',
  statusCode = 400
): Response => {
  return res.status(statusCode).json({
    success: false,
    message,
  });
};

/**
 * Mengirim respons khusus setelah login / autentikasi berhasil.
 */
export const loginResponse = (
  res: Response,
  user: any,
  token: string,
  refreshToken: string | null = null,
  message = 'Login berhasil'
): Response => {
  const response = {
    success: true,
    message,
    data: {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        name: user.username,
      },
      tokens: {
        access_token: token,
        refresh_token: refreshToken,
        token_type: 'Bearer',
        expires_in: 15 * 60, // Durasi 15 menit dalam detik
      },
    },
  };

  return res.status(200).json(response);
};

/**
 * Mengirim respons data list dengan pagination (Paginated Response).
 */
export const paginatedResponse = (
  res: Response,
  data: unknown[],
  pagination: PaginationMeta,
  message = 'Data berhasil diambil'
): Response => {
  return res.status(200).json({
    success: true,
    message,
    data,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
      totalPages: pagination.totalPages,
    },
  });
};



/**
 * Mengirim respons untuk alur reset password.
 */
export const passwordResetResponse = (
  res: Response,
  data: Record<string, unknown> | null = null,
  message = 'Kode verifikasi telah dikirim ke email Anda'
): Response => {
  const response: Record<string, unknown> = {
    success: true,
    message,
  };

  if (data) {
    Object.assign(response, data);
  }

  return res.status(200).json(response);
};
