import bcrypt from 'bcrypt';
import { AdminRepository } from '../repositories/admin.repository';
import logger from '../utils/logger';

const BCRYPT_SALT_ROUNDS = 12;

export class AdminService {
  public async createAdmin(data: any, actorId: number, ip: string) {
    const { username, email, password, role } = data;
    
    const existingAdmin = await AdminRepository.findByUsernameOrEmail(username, email.toLowerCase());
    if (existingAdmin) {
      const field = existingAdmin.username === username ? 'Username' : 'Email';
      throw new Error(`CONFLICT: ${field} sudah digunakan`);
    }

    const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    const newAdmin = await AdminRepository.create({
      username,
      email: email.toLowerCase(),
      password_hash: hashedPassword,
      role,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    });

    logger.audit('ADMIN_CREATED', actorId, {
      created_admin_id: newAdmin.id,
      username: newAdmin.username,
      role: newAdmin.role,
      ip,
    });

    return newAdmin;
  }

  public async updateAdmin(adminId: number, data: any, actorId: number, ip: string) {
    const existingAdmin = await AdminRepository.findById(adminId);
    if (!existingAdmin) {
      throw new Error('NOT_FOUND: Admin tidak ditemukan');
    }

    if (data.email && data.email.toLowerCase() !== existingAdmin.email) {
      const emailTaken = await AdminRepository.findByEmail(data.email.toLowerCase());
      if (emailTaken) {
        throw new Error('CONFLICT: Email sudah digunakan oleh admin lain');
      }
    }

    const updateData: any = { updated_at: new Date() };
    if (data.email !== undefined) updateData.email = data.email.toLowerCase();
    if (data.role !== undefined) updateData.role = data.role;
    if (data.is_active !== undefined) updateData.is_active = data.is_active;

    const updatedAdmin = await AdminRepository.update(adminId, updateData);

    logger.audit('ADMIN_UPDATED', actorId, {
      target_admin_id: adminId,
      fields_updated: Object.keys(updateData).filter((k) => k !== 'updated_at'),
      ip,
    });

    return updatedAdmin;
  }

  public async deleteAdmin(adminId: number, currentUserId: number, ip: string) {
    if (adminId === currentUserId) {
      throw new Error('FORBIDDEN: Tidak dapat menghapus akun sendiri');
    }

    const existingAdmin = await AdminRepository.findById(adminId);
    if (!existingAdmin) {
      throw new Error('NOT_FOUND: Admin tidak ditemukan');
    }

    await AdminRepository.deleteWithResets(adminId);

    logger.audit('ADMIN_DELETED', currentUserId, {
      deleted_admin_id: adminId,
      deleted_username: existingAdmin.username,
      ip,
    });
  }

  public async changePassword(adminId: number, current_password: string, new_password: string) {
    const admin = await AdminRepository.findById(adminId);
    if (!admin) {
      throw new Error('NOT_FOUND: Admin tidak ditemukan');
    }

    const isPasswordValid = await bcrypt.compare(current_password, admin.password_hash);
    if (!isPasswordValid) {
      throw new Error('UNAUTHORIZED: Password saat ini salah');
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(new_password, salt);

    await AdminRepository.updatePassword(adminId, hashedPassword);
  }
}
