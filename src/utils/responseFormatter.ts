import { Response } from 'express';

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * Send success response
 */
export const successResponse = (res: Response, data: unknown = null, message = 'Success', statusCode = 200): Response => {
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
 * Send error response
 */
export const errorResponse = (res: Response, message = 'An error occurred', statusCode = 400): Response => {
  return res.status(statusCode).json({
    success: false,
    message,
  });
};

/**
 * Send login/authentication response
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const loginResponse = (res: Response, user: any, token: string, refreshToken: string | null = null, message = 'Login berhasil'): Response => {
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
        expires_in: 15 * 60,
      },
    },
  };

  return res.status(200).json(response);
};

/**
 * Send paginated response
 */
export const paginatedResponse = (res: Response, data: unknown[], pagination: PaginationMeta, message = 'Data retrieved successfully'): Response => {
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
 * Send registration response
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const registerResponse = (res: Response, user: any, message = 'Registrasi berhasil. Silakan login.'): Response => {
  return res.status(201).json({
    success: true,
    message,
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
    },
  });
};

/**
 * Send password reset related responses
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
