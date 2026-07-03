// src/repositories/attendance.repository.ts
import prisma from '../config/prisma';
import { Prisma } from '@prisma/client';

export class AttendanceRepository {
  /**
   * Mengambil riwayat absensi terbaru (Recent Attendance)
   */
  public async getRecentAttendance(limit: number) {
    return prisma.attendance.findMany({
      where: {
        is_deleted: false,
        user_id: { not: '1' },
      },
      orderBy: {
        tanggal: 'desc',
      },
      take: limit,
    });
  }

  /**
   * Mengambil data absensi dalam rentang tanggal tertentu (misalnya untuk hari ini, atau 7 hari terakhir)
   */
  public async findRecordsByPeriod(start: Date, end: Date) {
    return prisma.attendance.findMany({
      where: {
        user_id: { not: '1' },
        tanggal: {
          gte: start,
          lt: end,
        },
        is_deleted: false,
      },
    });
  }

  /**
   * Menghitung total transaksi absensi dalam rentang waktu tertentu
   */
  public async countByPeriod(start: Date, end: Date) {
    return prisma.attendance.count({
      where: {
        user_id: { not: '1' },
        tanggal: {
          gte: start,
          lt: end,
        },
        is_deleted: false,
      },
    });
  }

  /**
   * Menghitung total karyawan dan dosen aktif (digunakan untuk Dashboard Statistik)
   */
  public async getEmployeeCounts() {
    const [dosenCount, karyawanCount, deviceCount] = await Promise.all([
      prisma.employees.count({ where: { jabatan: 'DOSEN', is_active: true, user_id: { notIn: ['1'] } } }),
      prisma.employees.count({ where: { jabatan: 'KARYAWAN', is_active: true, user_id: { notIn: ['1'] } } }),
      prisma.devices.count({ where: { is_active: true } }),
    ]);

    return { dosenCount, karyawanCount, deviceCount };
  }

  public async findMany(params: {
    where: Prisma.attendanceWhereInput;
    orderBy?: Prisma.attendanceOrderByWithRelationInput | Prisma.attendanceOrderByWithRelationInput[];
    skip?: number;
    take?: number;
  }) {
    return prisma.attendance.findMany(params);
  }

  public async count(where: Prisma.attendanceWhereInput) {
    return prisma.attendance.count({ where });
  }

  public async findById(id: number) {
    return prisma.attendance.findUnique({ where: { id } });
  }

  public async update(id: number, data: Prisma.attendanceUpdateInput) {
    return prisma.attendance.update({ where: { id }, data });
  }
}
