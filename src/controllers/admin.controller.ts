// src/controllers/admin.controller.ts

import { Request, Response } from 'express';
import { successResponse, errorResponse } from '../utils/responseFormatter';
import logger from '../utils/logger';
import { AdminService } from '../services/admin.service';

const VALID_ROLES = ['admin', 'super_admin', 'pimpinan'];
const adminService = new AdminService();

export class AdminController {
  private static handleError(res: Response, error: any, defaultMessage: string) {
    const errMessage = error instanceof Error ? error.message : String(error);
    logger.error(`[AdminController] ${defaultMessage}`, { error: errMessage });

    if (errMessage.startsWith('BAD_REQUEST:')) {
      return errorResponse(res, errMessage.replace('BAD_REQUEST: ', ''), 400);
    }
    if (errMessage.startsWith('NOT_FOUND:')) {
      return errorResponse(res, errMessage.replace('NOT_FOUND: ', ''), 404);
    }
    if (errMessage.startsWith('CONFLICT:')) {
      return errorResponse(res, errMessage.replace('CONFLICT: ', ''), 409);
    }
    if (errMessage.startsWith('FORBIDDEN:')) {
      return errorResponse(res, errMessage.replace('FORBIDDEN: ', ''), 403);
    }
    if (errMessage.startsWith('UNAUTHORIZED:')) {
      return errorResponse(res, errMessage.replace('UNAUTHORIZED: ', ''), 401);
    }
    return errorResponse(res, defaultMessage, 500);
  }

  public static async createAdmin(req: Request, res: Response): Promise<Response> {
    try {
      const { username, email, password, role } = req.body;

      if (!username || !email || !password || !role) {
        return errorResponse(res, 'Username, email, password, dan role wajib diisi', 400);
      }
      if (username.length < 3 || username.length > 50) {
        return errorResponse(res, 'Username harus 3-50 karakter', 400);
      }
      if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        return errorResponse(res, 'Username hanya boleh huruf, angka, dan underscore', 400);
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return errorResponse(res, 'Format email tidak valid', 400);
      }
      if (password.length < 8) {
        return errorResponse(res, 'Password minimal 8 karakter', 400);
      }
      if (!VALID_ROLES.includes(role)) {
        return errorResponse(res, `Role harus salah satu dari: ${VALID_ROLES.join(', ')}`, 400);
      }

      const actorId = req.user?.id ?? 0;
      const newAdmin = await adminService.createAdmin({ username, email, password, role }, actorId, req.ip ?? '');

      return successResponse(res, newAdmin, 'Admin berhasil dibuat', 201);
    } catch (error) {
      return AdminController.handleError(res, error, 'Gagal membuat admin');
    }
  }

  public static async updateAdmin(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const adminId = parseInt(id || '');

      if (isNaN(adminId) || adminId > 2147483647) {
        return errorResponse(res, 'ID admin tidak valid', 400);
      }

      const { email, role, is_active } = req.body;

      if (email === undefined && role === undefined && is_active === undefined) {
        return errorResponse(res, 'Minimal satu field (email, role, is_active) harus diisi', 400);
      }
      if (email !== undefined) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          return errorResponse(res, 'Format email tidak valid', 400);
        }
      }
      if (role !== undefined && !VALID_ROLES.includes(role)) {
        return errorResponse(res, `Role harus salah satu dari: ${VALID_ROLES.join(', ')}`, 400);
      }
      if (is_active !== undefined && typeof is_active !== 'boolean') {
        return errorResponse(res, 'is_active harus boolean (true/false)', 400);
      }

      const actorId = req.user?.id ?? 0;
      const updatedAdmin = await adminService.updateAdmin(adminId, { email, role, is_active }, actorId, req.ip ?? '');

      return successResponse(res, updatedAdmin, 'Admin berhasil diperbarui');
    } catch (error) {
      return AdminController.handleError(res, error, 'Gagal memperbarui admin');
    }
  }

  public static async deleteAdmin(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const adminId = parseInt(id || '');

      if (isNaN(adminId) || adminId > 2147483647) {
        return errorResponse(res, 'ID admin tidak valid', 400);
      }

      const currentUserId = req.user?.id ?? 0;
      await adminService.deleteAdmin(adminId, currentUserId, req.ip ?? '');

      return successResponse(res, null, 'Admin berhasil dihapus');
    } catch (error) {
      return AdminController.handleError(res, error, 'Gagal menghapus admin');
    }
  }

  public static async changePassword(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const { current_password, new_password } = req.body;

      if (!current_password || !new_password) {
        return errorResponse(res, 'Current password and new password are required', 400);
      }

      let adminId: number;
      if (id) {
        adminId = parseInt(id);
        if (isNaN(adminId) || adminId > 2147483647) {
          return errorResponse(res, 'ID Admin tidak valid. Harus berupa integer ID (bukan NIP/NIDN).', 400);
        }
      } else {
        adminId = req.user?.id ?? 0;
      }

      await adminService.changePassword(adminId, current_password, new_password);

      return successResponse(res, null, 'Password berhasil diubah');
    } catch (error) {
      return AdminController.handleError(res, error, 'Gagal mengubah password');
    }
  }
}
export default AdminController;
