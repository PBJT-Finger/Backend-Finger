// src/repositories/employee.repository.ts
import prisma from '../config/prisma';
import { Prisma } from '@prisma/client';

export class EmployeeRepository {
  /**
   * Mengambil daftar pegawai berdasarkan paginasi dan filter.
   */
  public async findAll(params: {
    skip: number;
    take: number;
    whereClause: Prisma.employeesWhereInput;
  }) {
    const { skip, take, whereClause } = params;
    return Promise.all([
      prisma.employees.count({ where: whereClause }),
      prisma.employees.findMany({
        where: whereClause,
        skip,
        take,
        orderBy: { updated_at: 'desc' },
        include: {
          shifts: true, // Menyertakan relasi shift kerja
        },
      }),
    ]);
  }

  /**
   * Mencari satu pegawai berdasarkan user_id.
   */
  public async findByUserId(user_id: string) {
    return prisma.employees.findUnique({
      where: { user_id },
      include: {
        shifts: true,
      }
    });
  }

  /**
   * Memperbarui data pegawai (update).
   */
  public async update(user_id: string, data: Prisma.employeesUpdateInput) {
    return prisma.employees.update({
      where: { user_id },
      data,
      include: {
        shifts: true,
      },
    });
  }

  /**
   * Mendapatkan daftar pegawai aktif (dengan opsi filter jabatan dan id)
   */
  public async findActiveEmployees(params?: {
    jabatan?: 'DOSEN' | 'KARYAWAN' | { in: string[] };
    user_id?: string;
  }) {
    const where: Prisma.employeesWhereInput = {
      is_active: true,
      user_id: { notIn: ['1'] },
    };

    if (params?.jabatan) where.jabatan = params.jabatan as any;
    if (params?.user_id) where.user_id = params.user_id;

    return prisma.employees.findMany({
      where,
      select: { user_id: true, nama: true, jabatan: true, is_active: true },
    });
  }
}
