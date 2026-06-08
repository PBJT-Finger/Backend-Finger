import prisma from '../config/prisma';
import logger from '../utils/logger';

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

export class AttendanceService {
  /**
   * Get attendance summary for employees
   * Main API for frontend rekap absensi
   */
  public static async getAttendanceSummary(
    filters: AttendanceSummaryFilters = {}
  ): Promise<EmployeeSummary[]> {
    try {
      const { startDate, endDate, user_id, jabatan } = filters;

      const whereClause: Record<string, unknown> = {
        is_active: true,
      };

      if (user_id) {
        whereClause['user_id'] = user_id;
      }

      if (jabatan) {
        whereClause['jabatan'] = jabatan;
      }

      // Get all employees matching the filter
      const employees = await prisma.employees.findMany({
        where: whereClause,
        include: {
          shifts: true,
        },
      });

      if (!startDate || !endDate) {
        throw new Error('Start date and end date are required');
      }

      // Calculate working days (exclude weekends only)
      const totalWorkingDays = this.calculateWorkingDaysWeekendOnly(
        new Date(startDate),
        new Date(endDate)
      );

      // Get summary for each employee
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
      logger.error('Error in getAttendanceSummary:', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get summary for one employee
   */

  public static async getEmployeeSummary(
    employee: any,
    startDate: Date,
    endDate: Date,
    totalWorkingDays: number
  ): Promise<EmployeeSummary | null> {
    try {
      // Get attendance records for this employee in date range
      const attendanceRecords = await prisma.attendance.findMany({
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

      // Calculate statistics
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

        // Only count lateness for KARYAWAN
        if (employee.jabatan === 'KARYAWAN' && record.status === 'TERLAMBAT') {
          stats.total_terlambat++;
        }
      });

      // Calculate percentage
      stats.persentase_kehadiran =
        totalWorkingDays > 0 ? Math.round((stats.total_hadir / totalWorkingDays) * 100) : 0;

      return stats;
    } catch (error) {
      logger.error(`Error getting summary for employee ${String(employee.user_id)}:`, {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Check if attendance time is late
   * Note: This is simplified - actual late logic now in database via status field
   */
  public static isLate(
    waktuAbsensi: string | null,
    shiftTime: string | null,
    toleransiMenit = 0
  ): boolean {
    if (!waktuAbsensi || !shiftTime) return false;

    const waktu = new Date(`1970-01-01T${waktuAbsensi}`);
    const shift = new Date(`1970-01-01T${shiftTime}`);

    // Add tolerance
    shift.setMinutes(shift.getMinutes() + toleransiMenit);

    return waktu > shift;
  }

  /**
   * Get detailed attendance for one employee
   */

  public static async getEmployeeAttendanceDetail(
    user_id: string,
    startDate: string,
    endDate: string
  ): Promise<any[]> {
    try {
      const attendance = await prisma.attendance.findMany({
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
      logger.error(`Error getting attendance detail for user ID ${user_id}:`, {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Calculate working days (exclude weekends only, no holidays)
   * Simple version without holiday calculation
   */
  public static calculateWorkingDaysWeekendOnly(startDate: Date, endDate: Date): number {
    let workingDays = 0;
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const dayOfWeek = currentDate.getDay();

      // Exclude Sunday (0) and Saturday (6)
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        workingDays++;
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return workingDays;
  }
}
