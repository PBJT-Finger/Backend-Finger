// src/controllers/auth.controller.ts

import { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import logger from '../utils/logger';
import { loginResponse, passwordResetResponse, successResponse, errorResponse } from '../utils/responseFormatter';
import { AuthService } from '../services/auth.service';

const authService = new AuthService();

export class AuthController {
  private static handleError(res: Response, error: any, defaultMessage: string, defaultCode: number = 500) {
    const errMessage = error instanceof Error ? error.message : String(error);
    logger.error(`[AuthController] ${defaultMessage}`, { error: errMessage });

    if (errMessage.startsWith('BAD_REQUEST:')) {
      return errorResponse(res, errMessage.replace('BAD_REQUEST: ', ''), 400);
    }
    if (errMessage.startsWith('UNAUTHORIZED:')) {
      return errorResponse(res, errMessage.replace('UNAUTHORIZED: ', ''), 401);
    }
    return errorResponse(res, defaultMessage, defaultCode);
  }

  public static login = [
    body('email').trim().isEmail().withMessage('Email tidak valid').normalizeEmail({ gmail_remove_dots: false }),
    body('password').isLength({ min: 6 }).withMessage('Password minimal 6 karakter'),
    async (req: Request, res: Response): Promise<Response> => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          logger.warn('Validasi login gagal', { ip: req.ip, errors: errors.array() });
          const firstErr = errors.array()[0];
          return errorResponse(res, firstErr ? firstErr.msg : 'Validasi gagal', 400);
        }

        const { email, password } = req.body;
        const result = await authService.login(email, password, req.ip ?? '', req.get('User-Agent'));

        return loginResponse(res, result.admin, result.accessToken, result.refreshToken);
      } catch (error) {
        return AuthController.handleError(res, error, 'Internal server error', 500);
      }
    },
  ];

  public static forgotPassword = [
    body('email').trim().isEmail().withMessage('Email tidak valid').normalizeEmail({ gmail_remove_dots: false }),
    async (req: Request, res: Response): Promise<Response> => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return errorResponse(res, 'Email tidak valid', 400);
        }

        const { email } = req.body;
        await authService.forgotPassword(email, req.ip ?? '');

        return passwordResetResponse(res);
      } catch (error) {
        return AuthController.handleError(res, error, 'Terjadi kesalahan. Silakan coba lagi.', 500);
      }
    },
  ];

  public static verifyCode = [
    body('email').trim().isEmail().withMessage('Email tidak valid').normalizeEmail({ gmail_remove_dots: false }),
    body('code').trim().isLength({ min: 6, max: 6 }).withMessage('Kode harus 6 digit').isNumeric().withMessage('Kode harus berupa angka'),
    async (req: Request, res: Response): Promise<Response> => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          const firstErr = errors.array()[0];
          return errorResponse(res, firstErr ? firstErr.msg : 'Validasi gagal', 400);
        }

        const { email, code } = req.body;
        const resetToken = await authService.verifyCode(email, code, req.ip ?? '');

        return passwordResetResponse(res, { resetToken }, 'Kode valid');
      } catch (error) {
        return AuthController.handleError(res, error, 'Terjadi kesalahan. Silakan coba lagi.', 500);
      }
    },
  ];

  public static resetPassword = [
    body('resetToken').notEmpty().withMessage('Reset token diperlukan'),
    body('newPassword').isLength({ min: 8 }).withMessage('Password minimal 8 karakter').matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Password harus mengandung huruf besar, huruf kecil, dan angka'),
    async (req: Request, res: Response): Promise<Response> => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          const firstErr = errors.array()[0];
          return errorResponse(res, firstErr ? firstErr.msg : 'Validasi gagal', 400);
        }

        const { resetToken, newPassword } = req.body;
        await authService.resetPassword(resetToken, newPassword, req.ip ?? '');

        return passwordResetResponse(res, null, 'Password berhasil direset');
      } catch (error) {
        return AuthController.handleError(res, error, 'Gagal mereset password. Silakan coba lagi.', 500);
      }
    },
  ];

  public static refreshToken = async (req: Request, res: Response): Promise<Response> => {
    try {
      const { refresh_token } = req.body;
      if (!refresh_token) {
        return errorResponse(res, 'Refresh token diperlukan', 400);
      }

      const result = await authService.refreshToken(refresh_token, req.ip ?? '');

      return successResponse(res, {
        tokens: {
          access_token: result.accessToken,
          refresh_token: result.newRefreshToken,
          token_type: 'Bearer',
          expires_in: 15 * 60,
        },
      }, 'Token berhasil diperbarui');
    } catch (error) {
      return AuthController.handleError(res, error, 'Refresh token tidak valid', 401);
    }
  };

  public static logout = async (req: Request, res: Response): Promise<Response> => {
    try {
      const authHeader = req.headers['authorization'];
      const accessToken = authHeader && authHeader.split(' ')[1];
      const refresh_token = req.body.refresh_token;
      const userId = req.user?.id ?? 0;
      const username = req.user?.username ?? 'unknown';

      const tokensBlacklisted = await authService.logout(accessToken, refresh_token, userId, username, req.ip ?? '');

      return successResponse(res, null, `Logout berhasil. ${tokensBlacklisted} token dicabut.`);
    } catch (error) {
      return AuthController.handleError(res, error, 'Internal server error', 500);
    }
  };
}
