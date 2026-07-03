// src/services/attendance.service.ts

import { EmployeeRepository } from '../repositories/employee.repository';
import { AttendanceRepository } from '../repositories/attendance.repository';
import logger from '../utils/logger'; // Logger internal aplikasi

export interface AttendanceSummaryFilters {
  startDate?: string;
  endDate?: string;
  user_id?: string;
  jabatan?: 'DOSEN' | 'KARYAWAN';
}

export interface EmployeeSummary {
  user_id: string;
  nama: string;
  jabatan: string;
  shift: string | null;
  total_working_days: number;
  total_hadir: number;
  total_terlambat: number;
  persentase_kehadiran: number;
}

const employeeRepo = new EmployeeRepository();
const attendanceRepo = new AttendanceRepository();

export class AttendanceService {
  public static async getAttendanceSummary(
    filters: AttendanceSummaryFilters = {}
  ): Promise<EmployeeSummary[]> {
    try {
      const { startDate, endDate, user_id, jabatan } = filters;

      const whereClause: any = {
        is_active: true,
      };

      if (user_id) {
        whereClause['user_id'] = user_id;
      }
      if (jabatan) {
        whereClause['jabatan'] = jabatan;
      }

      // Use employee repository instead of direct prisma call
      const [_, employees] = await employeeRepo.findAll({
        skip: 0,
        take: 999999, // Fetch all for summary
        whereClause,
      });

      if (!startDate || !endDate) {
        throw new Error('Tanggal mulai dan tanggal akhir wajib diisi');
      }

      const totalWorkingDays = this.calculateWorkingDaysWeekendOnly(
        new Date(startDate),
        new Date(endDate)
      );

      const summaries = await Promise.all(
        employees.map((employee) =>
          this.getEmployeeSummary(
            employee,
            new Date(startDate),
            new Date(endDate),
            totalWorkingDays
          )
        )
      );

      return summaries.filter((summary): summary is EmployeeSummary => summary !== null);
    } catch (error) {
      logger.error('Error saat mengambil summary absensi:', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  public static async getEmployeeSummary(
    employee: any,
    startDate: Date,
    endDate: Date,
    totalWorkingDays: number
  ): Promise<EmployeeSummary | null> {
    try {
      // Use attendance repository instead of direct prisma call
      const attendanceRecords = await attendanceRepo.findMany({
        where: {
          user_id: employee.user_id,
          tanggal: {
            gte: startDate,
            lte: endDate,
          },
          is_deleted: false,
        },
        orderBy: {
          tanggal: 'asc',
        },
      });

      const stats: EmployeeSummary = {
        user_id: employee.user_id,
        nama: employee.nama,
        jabatan: employee.jabatan,
        shift: employee.shifts ? employee.shifts.nama_shift : null,
        total_working_days: totalWorkingDays,
        total_hadir: 0,
        total_terlambat: 0,
        persentase_kehadiran: 0,
      };

      attendanceRecords.forEach((record) => {
        if (record.jam_masuk) {
          stats.total_hadir++;
        }

        if (employee.jabatan === 'KARYAWAN' && record.status === 'TERLAMBAT') {
          stats.total_terlambat++;
        }
      });

      stats.persentase_kehadiran =
        totalWorkingDays > 0 ? Math.round((stats.total_hadir / totalWorkingDays) * 100) : 0;

      return stats;
    } catch (error) {
      logger.error(`Error saat mengambil summary pegawai dengan ID ${String(employee.user_id)}:`, {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  public static isLate(
    waktuAbsensi: string | null,
    shiftTime: string | null,
    toleransiMenit = 0
  ): boolean {
    if (!waktuAbsensi || !shiftTime) return false;

    const waktu = new Date(`1970-01-01T${waktuAbsensi}`);
    const shift = new Date(`1970-01-01T${shiftTime}`);

    shift.setMinutes(shift.getMinutes() + toleransiMenit);

    return waktu > shift;
  }

  public static async getEmployeeAttendanceDetail(
    user_id: string,
    startDate: string,
    endDate: string
  ): Promise<any[]> {
    try {
      // Use attendance repository instead of direct prisma call
      const attendance = await attendanceRepo.findMany({
        where: {
          user_id: user_id,
          tanggal: {
            gte: new Date(startDate),
            lte: new Date(endDate),
          },
          is_deleted: false,
        },
        orderBy: {
          tanggal: 'desc',
        },
      });

      return attendance;
    } catch (error) {
      logger.error(`Error saat mengambil detail absensi pegawai dengan ID ${user_id}:`, {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  public static calculateWorkingDaysWeekendOnly(startDate: Date, endDate: Date): number {
    let workingDays = 0;
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const dayOfWeek = currentDate.getDay();

      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        workingDays++;
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return workingDays;
  }
}
export default AttendanceService;
