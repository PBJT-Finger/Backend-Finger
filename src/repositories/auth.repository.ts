import prisma from '../config/prisma';
import { Prisma } from '@prisma/client';

export class AuthRepository {
  public static async findActiveAdminByEmail(email: string) {
    return prisma.admins.findFirst({
      where: { email, is_active: true },
    });
  }

  public static async deleteUnusedPasswordResets(adminId: number) {
    return prisma.password_resets.deleteMany({
      where: { admin_id: adminId, used_at: null },
    });
  }

  public static async createPasswordReset(data: Prisma.password_resetsCreateInput) {
    return prisma.password_resets.create({
      data,
    });
  }

  public static async findValidResetCode(email: string, code: string) {
    return prisma.password_resets.findFirst({
      where: { email, code, used_at: null },
      include: { admins: { select: { is_active: true } } },
    });
  }

  public static async saveResetToken(id: number, resetToken: string) {
    return prisma.password_resets.update({
      where: { id },
      data: { reset_token: resetToken },
    });
  }

  public static async findValidResetToken(resetToken: string) {
    return prisma.password_resets.findFirst({
      where: { reset_token: resetToken, used_at: null },
      include: { admins: { select: { is_active: true, username: true } } },
    });
  }

  public static async executePasswordReset(adminId: number, resetEntryId: number, hashedPassword: string) {
    return prisma.$transaction([
      prisma.admins.update({
        where: { id: adminId },
        data: { password_hash: hashedPassword, updated_at: new Date() },
      }),
      prisma.password_resets.update({
        where: { id: resetEntryId },
        data: { used_at: new Date() },
      }),
    ]);
  }
}
