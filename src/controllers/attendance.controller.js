// src/controllers/attendance.controller.js - Attendance Management (Prisma)
const { prisma } = require('../models');
const { successResponse, errorResponse } = require('../utils/responseFormatter');
const logger = require('../utils/logger');

class AttendanceController {
  /**
   * Get lecturer (dosen) attendance
   * Frontend API: GET /api/attendance/dosen?start_date=X&end_date=Y&dosen_id=Z
   */
  static async getLecturerAttendance(req, res) {
    try {
      const { start_date, end_date, dosen_id, page = 1, limit = 50 } = req.query;

      const whereClause = {
        jabatan: 'DOSEN',
        is_deleted: false
      };

      if (start_date && end_date) {
        whereClause.tanggal = {
          gte: new Date(start_date),
          lte: new Date(end_date)
        };
      }

      if (dosen_id) {
        whereClause.nip = dosen_id;
      }

      const attendance = await prisma.attendance.findMany({
        where: whereClause,
        orderBy: [
          { tanggal: 'desc' },
          { jam_masuk: 'asc' }
        ]
      });

      // Transform to aggregated data
      const { transformDosenAttendance } = require('../utils/attendanceTransformer');
      const transformedData = transformDosenAttendance(attendance);

      // Apply pagination
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const take = parseInt(limit);
      const paginatedData = transformedData.slice(skip, skip + take);

      // Return array directly in data field for frontend compatibility
      return successResponse(res, paginatedData, 'Lecturer attendance retrieved successfully');

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

      const whereClause = {
        jabatan: 'KARYAWAN',
        is_deleted: false
      };

      if (start_date && end_date) {
        whereClause.tanggal = {
          gte: new Date(start_date),
          lte: new Date(end_date)
        };
      }

      if (karyawan_id) {
        whereClause.nip = karyawan_id;
      }

      const attendance = await prisma.attendance.findMany({
        where: whereClause,
        orderBy: [
          { tanggal: 'desc' },
          { jam_masuk: 'asc' }
        ]
      });

      // Transform to aggregated data
      const { transformKaryawanAttendance } = require('../utils/attendanceTransformer');
      const transformedData = transformKaryawanAttendance(attendance);

      // Apply pagination
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const take = parseInt(limit);
      const paginatedData = transformedData.slice(skip, skip + take);

      // Return array directly in data field for frontend compatibility
      return successResponse(res, paginatedData, 'Employee attendance retrieved successfully');

    } catch (error) {
      logger.error('Get employee attendance error', { error: error.message, stack: error.stack });
      return errorResponse(res, 'Failed to retrieve employee attendance', 500);
    }
  }

  /**
   * Get all attendance (generic endpoint)
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

      const whereClause = {
        is_deleted: false
      };

      if (start_date && end_date) {
        whereClause.tanggal = {
          gte: new Date(start_date),
          lte: new Date(end_date)
        };
      }

      if (nip) {
        whereClause.nip = nip;
      }

      if (jabatan) {
        whereClause.jabatan = jabatan;
      }

      if (status) {
        whereClause.status = status;
      }

      // Get total count
      const total = await prisma.attendance.count({ where: whereClause });

      // Get attendance with pagination
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const attendance = await prisma.attendance.findMany({
        where: whereClause,
        orderBy: { tanggal: 'desc' },
        skip: skip,
        take: parseInt(limit)
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
   */
  static async getAttendanceSummary(req, res) {
    try {
      const { start_date, end_date, nip } = req.query;

      if (!start_date || !end_date) {
        return errorResponse(res, 'start_date and end_date are required', 400);
      }

      const whereClause = {
        tanggal: {
          gte: new Date(start_date),
          lte: new Date(end_date)
        },
        is_deleted: false
      };

      if (nip) {
        whereClause.nip = nip;
      }

      const attendance = await prisma.attendance.findMany({
        where: whereClause,
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
          if (!employeeStats[key].last_check_in || new Date(record.jam_masuk) > new Date(employeeStats[key].last_check_in)) {
            employeeStats[key].last_check_in = record.jam_masuk;
          }
        }

        if (record.jam_keluar) {
          if (!employeeStats[key].last_check_out || new Date(record.jam_keluar) > new Date(employeeStats[key].last_check_out)) {
            employeeStats[key].last_check_out = record.jam_keluar;
          }
        }

        if (record.status === 'TERLAMBAT') {
          employeeStats[key].total_terlambat++;
        }
      });

      const summary = Object.values(employeeStats).map((emp, index) => ({
        no: index + 1,
        nama: emp.nama,
        nip: emp.nip,
        jabatan: emp.jabatan,
        check_in_terakhir: emp.last_check_in,
        check_out_terakhir: emp.last_check_out,
        total_hadir: emp.total_hadir,
        total_terlambat: emp.total_terlambat,
        total_days: emp.total_days,
        persentase: emp.total_days > 0 ? Math.round((emp.total_hadir / emp.total_days) * 100) : 0
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
   * Delete attendance record (soft delete)
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

  /**
   * Get attendance summary (stub for /summary route)
   */
  static async getSummary(req, res) {
    try {
      // This is a stub - redirecting to getAttendanceSummary
      return AttendanceController.getAttendanceSummary(req, res);
    } catch (error) {
      logger.error('Get summary error', { error: error.message });
      return errorResponse(res, 'Failed to get attendance summary', 500);
    }
  }

  /**
   * Get monthly report (stub - not implemented yet)
   */
  static async getMonthlyReport(req, res) {
    try {
      return errorResponse(res, 'Monthly report endpoint not implemented yet', 501);
    } catch (error) {
      logger.error('Get monthly report error', { error: error.message });
      return errorResponse(res, 'Failed to get monthly report', 500);
    }
  }
}

module.exports = AttendanceController;
