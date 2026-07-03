import prisma from '../config/prisma';
import { Prisma } from '@prisma/client';

export class AdminRepository {
  public static async findByUsernameOrEmail(username: string, email: string) {
    return prisma.admins.findFirst({
      where: {
        OR: [{ username }, { email }],
      },
      select: { username: true, email: true },
    });
  }

  public static async create(data: Prisma.adminsCreateInput) {
    return prisma.admins.create({
      data,
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        is_active: true,
        created_at: true,
      },
    });
  }

  public static async findById(id: number) {
    return prisma.admins.findUnique({
      where: { id },
    });
  }

  public static async findByEmail(email: string) {
    return prisma.admins.findUnique({
      where: { email },
    });
  }

  public static async update(id: number, data: Prisma.adminsUpdateInput) {
    return prisma.admins.update({
      where: { id },
      data,
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        is_active: true,
        updated_at: true,
      },
    });
  }

  public static async updatePassword(id: number, password_hash: string) {
    return prisma.admins.update({
      where: { id },
      data: {
        password_hash,
        updated_at: new Date(),
      },
    });
  }

  public static async updateLastLogin(id: number) {
    return prisma.admins.update({
      where: { id },
      data: { last_login: new Date() },
    });
  }

  public static async deleteWithResets(adminId: number) {
    return prisma.$transaction([
      prisma.password_resets.deleteMany({ where: { admin_id: adminId } }),
      prisma.admins.delete({ where: { id: adminId } }),
    ]);
  }
}
