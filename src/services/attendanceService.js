// src/services/attendanceService.js - Service untuk logika bisnis absensi (Prisma)
const { prisma } = require('../models');
const logger = require('../utils/logger');

class AttendanceService {
  /**
   * Get attendance summary for employees
   * Main API for frontend rekap absensi
   */
  static async getAttendanceSummary(filters = {}) {
    try {
      const { startDate, endDate, nip, jabatan } = filters;

      const whereClause = {
        is_active: true
      };

      if (nip) {
        whereClause.nip = nip;
      }

      if (jabatan) {
        whereClause.jabatan = jabatan;
      }

      // Get all employees matching the filter
      const employees = await prisma.employees.findMany({
        where: whereClause,
        include: {
          shifts: true
        }
      });

      // Calculate working days (exclude weekends only)
      const totalWorkingDays = this.calculateWorkingDaysWeekendOnly(
        new Date(startDate),
        new Date(endDate)
      );

      // Get summary for each employee
      const summaries = await Promise.all(
        employees.map(employee =>
          this.getEmployeeSummary(
            employee,
            new Date(startDate),
            new Date(endDate),
            totalWorkingDays
          )
        )
      );

      return summaries.filter(summary => summary !== null);
    } catch (error) {
      logger.error('Error in getAttendanceSummary:', error);
      throw error;
    }
  }

  /**
   * Get summary for one employee
   */
  static async getEmployeeSummary(employee, startDate, endDate, totalWorkingDays) {
    try {
      // Get attendance records for this employee in date range
      const attendanceRecords = await prisma.attendance.findMany({
        where: {
          nip: employee.nip,
          tanggal: {
            gte: startDate,
            lte: endDate
          },
          is_deleted: false
        },
        orderBy: {
          tanggal: 'asc'
        }
      });

      // Calculate statistics
      const stats = {
        nip: employee.nip,
        nama: employee.nama,
        jabatan: employee.jabatan,
        shift: employee.shifts ? employee.shifts.nama_shift : null,
        total_working_days: totalWorkingDays,
        total_hadir: 0,
        total_terlambat: 0,
        persentase_kehadiran: 0
      };

      attendanceRecords.forEach(record => {
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
      logger.error(`Error getting summary for employee ${employee.nip}:`, error);
      return null;
    }
  }

  /**
   * Check if attendance time is late
   * Note: This is simplified - actual late logic now in database via status field
   */
  static isLate(waktuAbsensi, shiftTime, toleransiMenit = 0) {
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
  static async getEmployeeAttendanceDetail(nip, startDate, endDate) {
    try {
      const attendance = await prisma.attendance.findMany({
        where: {
          nip: nip,
          tanggal: {
            gte: new Date(startDate),
            lte: new Date(endDate)
          },
          is_deleted: false
        },
        orderBy: {
          tanggal: 'desc'
        }
      });

      return attendance;
    } catch (error) {
      logger.error(`Error getting attendance detail for NIP ${nip}:`, error);
      throw error;
    }
  }

  /**
   * Calculate working days (exclude weekends only, no holidays)
   * Simple version without holiday calculation
   */
  static calculateWorkingDaysWeekendOnly(startDate, endDate) {
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

module.exports = AttendanceService;
