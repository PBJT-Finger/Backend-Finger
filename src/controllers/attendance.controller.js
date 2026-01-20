// src/controllers/attendance.controller.js - Attendance Management with Prisma
const { prisma } = require('../lib/prisma');
const { successResponse, errorResponse } = require('../utils/responseFormatter');
const logger = require('../utils/logger');

class AttendanceController {
  /**
   * Get comprehensive attendance summary
   * Used by frontend for rekap/dashboard
   */
  static async getSummary(req, res) {
    try {
      const { start_date, end_date, nip, jabatan } = req.query;

      // Build where clause
      const where = {
        is_deleted: false
      };

      if (start_date && end_date) {
        where.tanggal = {
          gte: new Date(start_date),
          lte: new Date(end_date)
        };
      }

      if (nip) where.nip = nip;
      if (jabatan) where.jabatan = jabatan;

      // Get attendance records
      const attendance = await prisma.attendance.findMany({
        where,
        include: {
          employee: {
            select: {
              nip: true,
              nama: true,
              jabatan: true,
              department: true,
              fakultas: true
            }
          }
        },
        orderBy: { tanggal: 'desc' }
      });

      // Calculate statistics
      const totalRecords = attendance.length;
      const uniqueDays = new Set(attendance.map(a => a.tanggal.toISOString().split('T')[0])).size;
      const hadirCount = attendance.filter(a => a.jam_masuk !== null).length;
      const terlambatCount = attendance.filter(a => a.status === 'TERLAMBAT').length;

      const summary = {
        total_records: totalRecords,
        total_days: uniqueDays,
        hadir: hadirCount,
        terlambat: terlambatCount,
        percentage: uniqueDays > 0 ? Math.round((hadirCount / uniqueDays) * 100) : 0
      };

      return successResponse(res, {
        summary,
        attendance,
        filters: { start_date, end_date, nip, jabatan }
      }, 'Attendance summary retrieved successfully');

    } catch (error) {
      logger.error('Get attendance summary error', { error: error.message, stack: error.stack });
      return errorResponse(res, 'Failed to retrieve attendance summary', 500);
    }
  }

  /**
   * Get lecturer (dosen) attendance
   * Frontend API: GET /api/attendance/dosen?start_date=X&end_date=Y&dosen_id=Z
   */
  static async getLecturerAttendance(req, res) {
    try {
      const { start_date, end_date, dosen_id, page = 1, limit = 50 } = req.query;

      // Build where clause
      const where = {
        jabatan: 'DOSEN',
        is_deleted: false
      };

      // Date range filter
      if (start_date && end_date) {
        where.tanggal = {
          gte: new Date(start_date),
          lte: new Date(end_date)
        };
      }

      // Specific dosen filter
      if (dosen_id) {
        where.nip = dosen_id;
      }

      // Pagination
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const take = parseInt(limit);

      // Get total count
      const total = await prisma.attendance.count({ where });

      // Get attendance records
      const attendance = await prisma.attendance.findMany({
        where,
        include: {
          employee: {
            select: {
              nip: true,
              nama: true,
              jabatan: true,
              department: true,
              fakultas: true,
              email: true
            }
          },
          device: {
            select: {
              device_name: true,
              device_id: true,
              location: true
            }
          }
        },
        orderBy: [
          { tanggal: 'desc' },
          { jam_masuk: 'asc' }
        ],
        skip,
        take
      });

      // Calculate summary statistics
      const summary = {
        total_records: total,
        total_returned: attendance.length,
        unique_dosen: new Set(attendance.map(a => a.nip)).size,
        hadir: attendance.filter(a => a.jam_masuk !== null).length,
        terlambat: attendance.filter(a => a.status === 'TERLAMBAT').length
      };

      return successResponse(res, {
        data: attendance,
        summary,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          total_pages: Math.ceil(total / parseInt(limit))
        },
        filters: { start_date, end_date, dosen_id }
      }, 'Lecturer attendance retrieved successfully');

    } catch (error) {
      logger.error('Get lecturer attendance error', { error: error.message, stack: error.stack });
      return errorResponse(res, 'Failed to retrieve lecturer attendance', 500);
    }
  }

  /**
   * Get employee (karyawan) attendance
   * Frontend API: GET /api/attendance/karyawan?start_date=X&end_date=Y&karyawan_id=Z
   */
  static async getEmployeeAttendance(req, res) {
    try {
      const { start_date, end_date, karyawan_id, page = 1, limit = 50 } = req.query;

      // Build where clause
      const where = {
        jabatan: 'KARYAWAN',
        is_deleted: false
      };

      // Date range filter
      if (start_date && end_date) {
        where.tanggal = {
          gte: new Date(start_date),
          lte: new Date(end_date)
        };
      }

      // Specific karyawan filter
      if (karyawan_id) {
        where.nip = karyawan_id;
      }

      // Pagination
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const take = parseInt(limit);

      // Get total count
      const total = await prisma.attendance.count({ where });

      // Get attendance records
      const attendance = await prisma.attendance.findMany({
        where,
        include: {
          employee: {
            select: {
              nip: true,
              nama: true,
              jabatan: true,
              department: true,
              email: true,
              shift: {
                select: {
                  nama_shift: true,
                  jam_masuk: true,
                  toleransi_menit: true
                }
              }
            }
          },
          device: {
            select: {
              device_name: true,
              device_id: true,
              location: true
            }
          }
        },
        orderBy: [
          { tanggal: 'desc' },
          { jam_masuk: 'asc' }
        ],
        skip,
        take
      });

      // Calculate summary statistics
      const summary = {
        total_records: total,
        total_returned: attendance.length,
        unique_karyawan: new Set(attendance.map(a => a.nip)).size,
        hadir: attendance.filter(a => a.jam_masuk !== null).length,
        terlambat: attendance.filter(a => a.status === 'TERLAMBAT').length
      };

      return successResponse(res, {
        data: attendance,
        summary,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          total_pages: Math.ceil(total / parseInt(limit))
        },
        filters: { start_date, end_date, karyawan_id }
      }, 'Employee attendance retrieved successfully');

    } catch (error) {
      logger.error('Get employee attendance error', { error: error.message, stack: error.stack });
      return errorResponse(res, 'Failed to retrieve employee attendance', 500);
    }
  }

  /**
   * Get all attendance (generic endpoint)
   * With flexible filtering
   */
  static async getAttendance(req, res) {
    try {
      const {
        start_date,
        end_date,
        nip,
        jabatan,
        status,
        page = 1,
        limit = 50
      } = req.query;

      // Build where clause
      const where = { is_deleted: false };

      if (start_date && end_date) {
        where.tanggal = {
          gte: new Date(start_date),
          lte: new Date(end_date)
        };
      }

      if (nip) where.nip = nip;
      if (jabatan) where.jabatan = jabatan;
      if (status) where.status = status;

      // Pagination
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const take = parseInt(limit);

      const total = await prisma.attendance.count({ where });

      const attendance = await prisma.attendance.findMany({
        where,
        include: {
          employee: true,
          device: true
        },
        orderBy: { tanggal: 'desc' },
        skip,
        take
      });

      return successResponse(res, {
        data: attendance,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          total_pages: Math.ceil(total / parseInt(limit))
        }
      }, 'Attendance retrieved successfully');

    } catch (error) {
      logger.error('Get attendance error', { error: error.message });
      return errorResponse(res, 'Failed to retrieve attendance', 500);
    }
  }

  /**
   * Get attendance summary/rekap
   * Aggregated statistics
   */
  static async getAttendanceSummary(req, res) {
    try {
      const { start_date, end_date, nip } = req.query;

      if (!start_date || !end_date) {
        return errorResponse(res, 'start_date and end_date are required', 400);
      }

      const where = {
        tanggal: {
          gte: new Date(start_date),
          lte: new Date(end_date)
        },
        is_deleted: false
      };

      if (nip) where.nip = nip;

      // Get all attendance in range
      const attendance = await prisma.attendance.findMany({
        where,
        include: {
          employee: {
            select: {
              nip: true,
              nama: true,
              jabatan: true
            }
          }
        },
        orderBy: [
          { tanggal: 'desc' },
          { jam_masuk: 'desc' }
        ]
      });

      // Group by employee
      const employeeStats = {};

      attendance.forEach(record => {
        const key = record.nip;
        if (!employeeStats[key]) {
          employeeStats[key] = {
            nip: record.nip,
            nama: record.nama,
            jabatan: record.jabatan,
            total_hadir: 0,
            total_terlambat: 0,
            total_days: 0,
            last_check_in: null,
            last_check_out: null
          };
        }

        employeeStats[key].total_days++;
        if (record.jam_masuk) {
          employeeStats[key].total_hadir++;
          // Update last check-in if this is more recent
          if (!employeeStats[key].last_check_in || new Date(record.jam_masuk) > new Date(employeeStats[key].last_check_in)) {
            employeeStats[key].last_check_in = record.jam_masuk;
          }
        }

        // Update last check-out if this is more recent
        if (record.jam_keluar) {
          if (!employeeStats[key].last_check_out || new Date(record.jam_keluar) > new Date(employeeStats[key].last_check_out)) {
            employeeStats[key].last_check_out = record.jam_keluar;
          }
        }

        // Track late attendance
        if (record.status === 'TERLAMBAT') {
          employeeStats[key].total_terlambat++;
        }
      });

      // Convert to array, add percentage, and filter fields
      const summary = Object.values(employeeStats).map((emp, index) => ({
        no: index + 1,
        nama: emp.nama,
        nip: emp.nip,
        jabatan: emp.jabatan,
        check_in_terakhir: emp.last_check_in ? emp.last_check_in.toISOString() : null,
        check_out_terakhir: emp.last_check_out ? emp.last_check_out.toISOString() : null,
        total_hadir: emp.total_hadir,
        total_terlambat: emp.total_terlambat,
        total_days: emp.total_days,
        persentase: emp.total_days > 0
          ? Math.round((emp.total_hadir / emp.total_days) * 100)
          : 0
      }));

      return successResponse(res, {
        summary,
        period: { start_date, end_date },
        total_employees: summary.length
      }, 'Attendance summary calculated successfully');

    } catch (error) {
      logger.error('Get attendance summary error', { error: error.message });
      return errorResponse(res, 'Failed to calculate attendance summary', 500);
    }
  }

  /**
   * Get monthly report
   * Grouped by month
   */
  static async getMonthlyReport(req, res) {
    try {
      const { year, month, jabatan } = req.query;

      if (!year || !month) {
        return errorResponse(res, 'year and month are required', 400);
      }

      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);

      const where = {
        tanggal: {
          gte: startDate,
          lte: endDate
        },
        is_deleted: false
      };

      if (jabatan) where.jabatan = jabatan;

      const attendance = await prisma.attendance.findMany({
        where,
        include: {
          employee: true
        },
        orderBy: { tanggal: 'asc' }
      });

      // Group by day
      const dailyStats = {};

      attendance.forEach(record => {
        const day = record.tanggal.toISOString().split('T')[0];
        if (!dailyStats[day]) {
          dailyStats[day] = {
            date: day,
            total: 0,
            hadir: 0,
            terlambat: 0
          };
        }

        dailyStats[day].total++;
        if (record.jam_masuk) dailyStats[day].hadir++;
        if (record.status === 'TERLAMBAT') dailyStats[day].terlambat++;
      });

      const report = Object.values(dailyStats);

      return successResponse(res, {
        report,
        period: { year: parseInt(year), month: parseInt(month) },
        summary: {
          total_days: report.length,
          total_attendance: attendance.length,
          total_unique_employees: new Set(attendance.map(a => a.nip)).size
        }
      }, 'Monthly report generated successfully');

    } catch (error) {
      logger.error('Get monthly report error', { error: error.message });
      return errorResponse(res, 'Failed to generate monthly report', 500);
    }
  }

  /**
   * Delete attendance record
   * Soft delete (mark as deleted)
   */
  static async deleteAttendance(req, res) {
    try {
      const { id } = req.params;

      const attendance = await prisma.attendance.findUnique({
        where: { id: parseInt(id) }
      });

      if (!attendance) {
        return errorResponse(res, 'Attendance record not found', 404);
      }

      // Soft delete
      await prisma.attendance.update({
        where: { id: parseInt(id) },
        data: { is_deleted: true }
      });

      logger.audit('ATTENDANCE_DELETED', req.user?.id, {
        attendance_id: id,
        nip: attendance.nip,
        tanggal: attendance.tanggal
      });

      return successResponse(res, null, 'Attendance record deleted successfully');

    } catch (error) {
      logger.error('Delete attendance error', { error: error.message });
      return errorResponse(res, 'Failed to delete attendance record', 500);
    }
  }
}

module.exports = AttendanceController;
