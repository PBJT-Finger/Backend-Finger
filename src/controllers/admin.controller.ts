// src/controllers/admin.controller.ts
// Kontroler ini digunakan untuk mengelola data akun administrator (Admin),
// termasuk pembuatan admin baru, pembaruan data admin, penghapusan admin,
// serta perubahan password admin.

import { Request, Response } from 'express';
import prisma from '../config/prisma'; // Mengimpor instance Prisma Client untuk akses database
import { successResponse, errorResponse } from '../utils/responseFormatter'; // Util untuk format standard response API
import logger from '../utils/logger'; // Util untuk logging
import bcrypt from 'bcrypt'; // Library pengaman hash password

const BCRYPT_SALT_ROUNDS = 12; // Jumlah salt round untuk proses hashing bcrypt
const VALID_ROLES = ['admin', 'super_admin', 'pimpinan']; // Role yang sah dalam sistem

export class AdminController {
  /**
   * Membuat Admin baru.
   * POST /api/admin
   */
  public static async createAdmin(req: Request, res: Response): Promise<Response> {
    try {
      // Mengambil parameter input dari body request
      const { username, email, password, role } = req.body;

      // --- Validasi Input ---
      // Pastikan semua field wajib telah diisi
      if (!username || !email || !password || !role) {
        return errorResponse(res, 'Username, email, password, dan role wajib diisi', 400);
      }

      // Validasi panjang username
      if (username.length < 3 || username.length > 50) {
        return errorResponse(res, 'Username harus 3-50 karakter', 400);
      }

      // Validasi format username (hanya boleh alphanumeric dan underscore)
      if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        return errorResponse(res, 'Username hanya boleh huruf, angka, dan underscore', 400);
      }

      // Validasi format email menggunakan regex sederhana
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return errorResponse(res, 'Format email tidak valid', 400);
      }

      // Validasi kekuatan/panjang password minimal
      if (password.length < 8) {
        return errorResponse(res, 'Password minimal 8 karakter', 400);
      }

      // Validasi apakah role yang dimasukkan sah
      if (!VALID_ROLES.includes(role)) {
        return errorResponse(res, `Role harus salah satu dari: ${VALID_ROLES.join(', ')}`, 400);
      }

      // --- Memeriksa Duplikasi data ---
      // Cek apakah username atau email sudah digunakan di database
      const existingAdmin = await prisma.admins.findFirst({
        where: {
          OR: [{ username: username }, { email: email.toLowerCase() }],
        },
        select: { username: true, email: true },
      });

      if (existingAdmin) {
        const field = existingAdmin.username === username ? 'Username' : 'Email';
        return errorResponse(res, `${field} sudah digunakan`, 409); // Kembalikan HTTP 409 Conflict
      }

      // --- Proses Hash Password & Pembuatan Admin ---
      // Mengamankan password plain-text dengan hashing bcrypt
      const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

      // Simpan data admin baru ke database
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

      // Mengambil ID aktor admin yang melakukan aksi pembuatan ini
      const actorId = req.user?.id ?? 0;

      // Mencatat log audit pembuatan akun admin baru
      logger.audit('ADMIN_CREATED', actorId, {
        created_admin_id: newAdmin.id,
        username: newAdmin.username,
        role: newAdmin.role,
        ip: req.ip,
      });

      return successResponse(res, newAdmin, 'Admin berhasil dibuat', 201);
    } catch (error) {
      logger.error('Error saat membuat admin', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return errorResponse(res, 'Gagal membuat admin', 500);
    }
  }

  /**
   * Memperbarui data Admin yang sudah ada.
   * PUT /api/admin/:id
   */
  public static async updateAdmin(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const adminId = parseInt(id || '');

      // Validasi ID agar berupa angka integer positif yang aman
      if (isNaN(adminId) || adminId > 2147483647) {
        return errorResponse(res, 'ID admin tidak valid', 400);
      }

      const { email, role, is_active } = req.body;

      // Memastikan minimal satu data dikirimkan untuk diperbarui
      if (email === undefined && role === undefined && is_active === undefined) {
        return errorResponse(res, 'Minimal satu field (email, role, is_active) harus diisi', 400);
      }

      // Validasi email jika dikirimkan
      if (email !== undefined) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          return errorResponse(res, 'Format email tidak valid', 400);
        }
      }

      // Validasi role jika dikirimkan
      if (role !== undefined && !VALID_ROLES.includes(role)) {
        return errorResponse(res, `Role harus salah satu dari: ${VALID_ROLES.join(', ')}`, 400);
      }

      // Validasi status aktif jika dikirimkan
      if (is_active !== undefined && typeof is_active !== 'boolean') {
        return errorResponse(res, 'is_active harus boolean (true/false)', 400);
      }

      // Pastikan target admin yang ingin diedit ada di database
      const existingAdmin = await prisma.admins.findUnique({
        where: { id: adminId },
      });

      if (!existingAdmin) {
        return errorResponse(res, 'Admin tidak ditemukan', 404);
      }

      // Pastikan email baru belum dipakai admin lain
      if (email && email.toLowerCase() !== existingAdmin.email) {
        const emailTaken = await prisma.admins.findUnique({
          where: { email: email.toLowerCase() },
        });
        if (emailTaken) {
          return errorResponse(res, 'Email sudah digunakan oleh admin lain', 409);
        }
      }

      // Menyusun data pembaruan
      const updateData: Record<string, any> = { updated_at: new Date() };
      if (email !== undefined) updateData['email'] = email.toLowerCase();
      if (role !== undefined) updateData['role'] = role;
      if (is_active !== undefined) updateData['is_active'] = is_active;

      // Eksekusi pembaruan ke database
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

      // Mencatat log audit pembaruan
      logger.audit('ADMIN_UPDATED', actorId, {
        target_admin_id: adminId,
        fields_updated: Object.keys(updateData).filter((k) => k !== 'updated_at'),
        ip: req.ip,
      });

      return successResponse(res, updatedAdmin, 'Admin berhasil diperbarui');
    } catch (error) {
      logger.error('Error saat memperbarui data admin', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return errorResponse(res, 'Gagal memperbarui admin', 500);
    }
  }

  /**
   * Menghapus Admin.
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

      // Mencegah admin menghapus dirinya sendiri demi keamanan
      if (adminId === currentUserId) {
        return errorResponse(res, 'Tidak dapat menghapus akun sendiri', 403);
      }

      // Pastikan target admin ada
      const existingAdmin = await prisma.admins.findUnique({
        where: { id: adminId },
        select: { id: true, username: true },
      });

      if (!existingAdmin) {
        return errorResponse(res, 'Admin tidak ditemukan', 404);
      }

      // Melakukan transaksi untuk menghapus data reset password terkait, baru menghapus admin
      await prisma.$transaction([
        prisma.password_resets.deleteMany({ where: { admin_id: adminId } }),
        prisma.admins.delete({ where: { id: adminId } }),
      ]);

      // Mencatat log audit penghapusan akun admin
      logger.audit('ADMIN_DELETED', currentUserId, {
        deleted_admin_id: adminId,
        deleted_username: existingAdmin.username,
        ip: req.ip,
      });

      return successResponse(res, null, 'Admin berhasil dihapus');
    } catch (error) {
      logger.error('Error saat menghapus admin', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return errorResponse(res, 'Gagal menghapus admin', 500);
    }
  }

  /**
   * Mengubah password Admin.
   * PUT /api/admin/password atau PUT /api/admin/:id/password
   */
  public static async changePassword(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const { current_password, new_password } = req.body;

      // Pastikan password lama dan baru dikirimkan
      if (!current_password || !new_password) {
        return errorResponse(res, 'Current password and new password are required', 400);
      }

      let adminId: number;

      // Jika ada parameter ID, gunakan ID tersebut (fitur super_admin mereset password admin lain)
      if (id) {
        adminId = parseInt(id);
        if (isNaN(adminId) || adminId > 2147483647) {
          return errorResponse(
            res,
            'ID Admin tidak valid. Harus berupa integer ID (bukan NIP/NIDN).',
            400
          );
        }
      } else {
        // Jika tidak ada ID di params, ubah password akun yang sedang login sendiri
        adminId = req.user?.id ?? 0;
      }

      // 1. Ambil data admin dari database
      const admin = await prisma.admins.findUnique({
        where: { id: adminId },
      });

      if (!admin) {
        return errorResponse(res, 'Admin tidak ditemukan', 404);
      }

      // 2. Verifikasi kesesuaian password lama
      const isPasswordValid = await bcrypt.compare(current_password, admin.password_hash);
      if (!isPasswordValid) {
        return errorResponse(res, 'Password saat ini salah', 401);
      }

      // 3. Hash password baru
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(new_password, salt);

      // 4. Perbarui password baru di database
      await prisma.admins.update({
        where: { id: adminId },
        data: {
          password_hash: hashedPassword,
          updated_at: new Date(),
        },
      });

      return successResponse(res, null, 'Password berhasil diubah');
    } catch (error) {
      logger.error('Error saat mengubah password admin', {
        error: error instanceof Error ? error.message : String(error),
      });
      return errorResponse(
        res,
        `Gagal mengubah password: ${error instanceof Error ? error.message : String(error)}`,
        500
      );
    }
  }
}
export default AdminController;
