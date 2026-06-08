import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { successResponse, errorResponse } from '../utils/responseFormatter';
import logger from '../utils/logger';
import bcrypt from 'bcrypt';

const BCRYPT_SALT_ROUNDS = 12;
const VALID_ROLES = ['admin', 'super_admin', 'pimpinan'];

export class AdminController {
  /**
   * Create a new admin
   * POST /api/admin
   */
  public static async createAdmin(req: Request, res: Response): Promise<Response> {
    try {
      const { username, email, password, role } = req.body;

      // --- Input validation ---
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

      // --- Check duplicates ---
      const existingAdmin = await prisma.admins.findFirst({
        where: {
          OR: [{ username: username }, { email: email.toLowerCase() }],
        },
        select: { username: true, email: true },
      });

      if (existingAdmin) {
        const field = existingAdmin.username === username ? 'Username' : 'Email';
        return errorResponse(res, `${field} sudah digunakan`, 409);
      }

      // --- Hash password & create admin ---
      const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

      const newAdmin = await prisma.admins.create({
        data: {
          username,
          email: email.toLowerCase(),
          password_hash: hashedPassword,
          role,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          is_active: true,
          created_at: true,
        },
      });

      const actorId = req.user?.id ?? 0;

      logger.audit('ADMIN_CREATED', actorId, {
        created_admin_id: newAdmin.id,
        username: newAdmin.username,
        role: newAdmin.role,
        ip: req.ip,
      });

      return successResponse(res, newAdmin, 'Admin berhasil dibuat', 201);
    } catch (error) {
      logger.error('Create admin error', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return errorResponse(res, 'Gagal membuat admin', 500);
    }
  }

  /**
   * Update an existing admin
   * PUT /api/admin/:id
   */
  public static async updateAdmin(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const adminId = parseInt(id || '');

      if (isNaN(adminId) || adminId > 2147483647) {
        return errorResponse(res, 'ID admin tidak valid', 400);
      }

      const { email, role, is_active } = req.body;

      // At least one field must be provided
      if (email === undefined && role === undefined && is_active === undefined) {
        return errorResponse(res, 'Minimal satu field (email, role, is_active) harus diisi', 400);
      }

      // Validate individual fields if provided
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

      // Check admin exists
      const existingAdmin = await prisma.admins.findUnique({
        where: { id: adminId },
      });

      if (!existingAdmin) {
        return errorResponse(res, 'Admin tidak ditemukan', 404);
      }

      // Check email uniqueness if email is being updated
      if (email && email.toLowerCase() !== existingAdmin.email) {
        const emailTaken = await prisma.admins.findUnique({
          where: { email: email.toLowerCase() },
        });
        if (emailTaken) {
          return errorResponse(res, 'Email sudah digunakan oleh admin lain', 409);
        }
      }

      // Build update data
      const updateData: Record<string, unknown> = { updated_at: new Date() };
      if (email !== undefined) updateData['email'] = email.toLowerCase();
      if (role !== undefined) updateData['role'] = role;
      if (is_active !== undefined) updateData['is_active'] = is_active;

      const updatedAdmin = await prisma.admins.update({
        where: { id: adminId },
        data: updateData,
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          is_active: true,
          updated_at: true,
        },
      });

      const actorId = req.user?.id ?? 0;

      logger.audit('ADMIN_UPDATED', actorId, {
        target_admin_id: adminId,
        fields_updated: Object.keys(updateData).filter((k) => k !== 'updated_at'),
        ip: req.ip,
      });

      return successResponse(res, updatedAdmin, 'Admin berhasil diperbarui');
    } catch (error) {
      logger.error('Update admin error', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return errorResponse(res, 'Gagal memperbarui admin', 500);
    }
  }

  /**
   * Delete an admin
   * DELETE /api/admin/:id
   */
  public static async deleteAdmin(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const adminId = parseInt(id || '');

      if (isNaN(adminId) || adminId > 2147483647) {
        return errorResponse(res, 'ID admin tidak valid', 400);
      }

      const currentUserId = req.user?.id ?? 0;

      // Prevent self-deletion
      if (adminId === currentUserId) {
        return errorResponse(res, 'Tidak dapat menghapus akun sendiri', 403);
      }

      // Check admin exists
      const existingAdmin = await prisma.admins.findUnique({
        where: { id: adminId },
        select: { id: true, username: true },
      });

      if (!existingAdmin) {
        return errorResponse(res, 'Admin tidak ditemukan', 404);
      }

      // Delete related password_resets first (cascade), then the admin
      await prisma.$transaction([
        prisma.password_resets.deleteMany({ where: { admin_id: adminId } }),
        prisma.admins.delete({ where: { id: adminId } }),
      ]);

      logger.audit('ADMIN_DELETED', currentUserId, {
        deleted_admin_id: adminId,
        deleted_username: existingAdmin.username,
        ip: req.ip,
      });

      return successResponse(res, null, 'Admin berhasil dihapus');
    } catch (error) {
      logger.error('Delete admin error', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return errorResponse(res, 'Gagal menghapus admin', 500);
    }
  }

  /**
   * Change admin password
   * PUT /api/admin/password
   */
  public static async changePassword(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const { current_password, new_password } = req.body;

      if (!current_password || !new_password) {
        return errorResponse(res, 'Current password and new password are required', 400);
      }

      let adminId: number;

      // If ID is provided in params, use it (for admin changing other admins)
      if (id) {
        adminId = parseInt(id);
        if (isNaN(adminId) || adminId > 2147483647) {
          return errorResponse(
            res,
            'Invalid Admin ID. Please provide a valid integer ID (not NIP).',
            400
          );
        }
      } else {
        adminId = req.user?.id ?? 0;
      }

      // 1. Get admin
      const admin = await prisma.admins.findUnique({
        where: { id: adminId },
      });

      if (!admin) {
        return errorResponse(res, 'Admin not found', 404);
      }

      // 2. Verify current password
      const isPasswordValid = await bcrypt.compare(current_password, admin.password_hash);
      if (!isPasswordValid) {
        return errorResponse(res, 'Invalid current password', 401);
      }

      // 3. Hash new password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(new_password, salt);

      // 4. Update password
      await prisma.admins.update({
        where: { id: adminId },
        data: {
          password_hash: hashedPassword,
          updated_at: new Date(),
        },
      });

      return successResponse(res, null, 'Password changed successfully');
    } catch (error) {
      logger.error('Change password error', {
        error: error instanceof Error ? error.message : String(error),
      });
      return errorResponse(
        res,
        `Failed to change password: ${error instanceof Error ? error.message : String(error)}`,
        500
      );
    }
  }
}
export default AdminController;
