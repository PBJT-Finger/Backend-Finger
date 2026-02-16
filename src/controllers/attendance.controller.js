// src/controllers/attendance.controller.js - Attendance Management (Prisma)
const prisma = require('../config/prisma');
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
        orderBy: [{ tanggal: 'desc' }, { jam_masuk: 'asc' }]
      });

      // Transform to aggregated data
      const { transformDosenAttendance } = require('../utils/attendanceTransformer');
      const transformedData = transformDosenAttendance(attendance, start_date, end_date);

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
        orderBy: [{ tanggal: 'desc' }, { jam_masuk: 'asc' }]
      });

      // Transform to aggregated data
      const { transformKaryawanAttendance } = require('../utils/attendanceTransformer');
      const transformedData = transformKaryawanAttendance(attendance, start_date, end_date);

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
      const { start_date, end_date, nip, jabatan, status, page = 1, limit = 50 } = req.query;

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

      return successResponse(
        res,
        {
          data: attendance,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            total_pages: Math.ceil(total / parseInt(limit))
          }
        },
        'Attendance retrieved successfully'
      );
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
      // Support both camelCase (frontend) and snake_case (legacy) parameter names
      const startDate = req.query.startDate || req.query.start_date;
      const endDate = req.query.endDate || req.query.end_date;
      const nip = req.query.nip;
      const jabatan = req.query.jabatan;

      if (!startDate || !endDate) {
        return errorResponse(res, 'startDate and endDate are required', 400);
      }

      const whereClause = {
        tanggal: {
          gte: new Date(startDate),
          lte: new Date(endDate)
        },
        is_deleted: false
      };

      if (nip) {
        whereClause.nip = nip;
      }

      if (jabatan) {
        whereClause.jabatan = jabatan;
      }

      const attendance = await prisma.attendance.findMany({
        where: whereClause,
        orderBy: [{ tanggal: 'desc' }, { jam_masuk: 'desc' }]
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
            attendanceDates: new Set(), // Track unique dates
            total_terlambat: 0,
            last_check_in: null,
            last_check_out: null,
            last_check_in_date: null, // Track date for check-in
            last_check_out_date: null  // Track date for check-out
          };
        }

        // Add unique date (convert to date string)
        const dateStr = record.tanggal.toISOString().split('T')[0];
        employeeStats[key].attendanceDates.add(dateStr);

        // Track latest check-in time (combine date + time)
        if (record.jam_masuk) {
          const checkInDateTime = new Date(record.jam_masuk);
          if (
            !employeeStats[key].last_check_in ||
            checkInDateTime > new Date(employeeStats[key].last_check_in)
          ) {
            employeeStats[key].last_check_in = checkInDateTime;
            employeeStats[key].last_check_in_date = record.tanggal; // Store associated date
          }
        }

        // Track latest check-out time (combine date + time)
        if (record.jam_keluar) {
          const checkOutDateTime = new Date(record.jam_keluar);
          if (
            !employeeStats[key].last_check_out ||
            checkOutDateTime > new Date(employeeStats[key].last_check_out)
          ) {
            employeeStats[key].last_check_out = checkOutDateTime;
            employeeStats[key].last_check_out_date = record.tanggal; // Store associated date
          }
        }

        // Count late attendance
        if (record.status === 'TERLAMBAT') {
          employeeStats[key].total_terlambat++;
        }
      });

      // Helper function to format TIME only (HH:mm:ss)
      const formatTimeOnly = (dateTime) => {
        if (!dateTime) return null;
        const d = new Date(dateTime);
        if (isNaN(d.getTime())) return null;

        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        const seconds = String(d.getSeconds()).padStart(2, '0');

        return `${hours}:${minutes}:${seconds}`;
      };

      // Helper to format date range in Indonesian
      const formatDateRange = (dates) => {
        if (!dates || dates.length === 0) return null;

        // Indonesian month names
        const months = [
          'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
          'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
        ];

        const firstDate = new Date(dates[0]);
        const lastDate = new Date(dates[dates.length - 1]);

        const startDay = firstDate.getDate();
        const startMonth = months[firstDate.getMonth()];
        const startYear = firstDate.getFullYear();

        const endDay = lastDate.getDate();
        const endMonth = months[lastDate.getMonth()];
        const endYear = lastDate.getFullYear();

        if (startMonth === endMonth && startYear === endYear) {
          return `${startDay} ${startMonth} ${startYear} - ${endDay} ${endMonth} ${endYear}`;
        }
        return `${startDay} ${startMonth} ${startYear} - ${endDay} ${endMonth} ${endYear}`;
      };

      const summary = Object.values(employeeStats).map((emp, index) => {
        const attendanceDatesArray = Array.from(emp.attendanceDates).sort();
        const totalHadir = attendanceDatesArray.length; // Unique dates count
        const totalHariKerja = totalHadir; // Same for now, can be adjusted for work days calculation

        return {
          id: index + 1,
          no: index + 1,
          nama: emp.nama,
          nip: emp.nip,
          jabatan: emp.jabatan,
          totalHadir: totalHadir,
          totalTerlambat: emp.total_terlambat,
          totalHariKerja: totalHariKerja,
          attendanceDates: formatDateRange(attendanceDatesArray), // Format: "15-31 Mei 2025"
          lastCheckIn: formatTimeOnly(emp.last_check_in),
          lastCheckOut: formatTimeOnly(emp.last_check_out),
          persentase: totalHariKerja > 0 ? Math.round((totalHadir / totalHariKerja) * 100) : 0
        };
      });

      return successResponse(
        res,
        summary, // Return summary array directly as 'data' field
        'Attendance summary calculated successfully'
      );
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

  /**
   * Sync attendance data from fingerprint device
   * POST /api/attendance/sync-fingerprint
   */
  static async syncFromFingerprint(req, res) {
    try {
      const fingerprintService = require('../services/fingerprint.service');

      logger.info('Starting fingerprint sync...');

      // Get attendance logs from device
      const logs = await fingerprintService.getAttendanceLogs();

      if (!logs || logs.length === 0) {
        return successResponse(res, { synced: 0 }, 'No new attendance records found');
      }

      let syncedCount = 0;
      let skippedCount = 0;
      const errors = [];

      // Process each log
      for (const log of logs) {
        try {
          // Map device user ID to NIP
          const nip = log.deviceUserId || log.userSn;

          if (!nip) {
            skippedCount++;
            continue;
          }

          // Get employee info
          const employee = await prisma.employees.findUnique({
            where: { nip: String(nip) }
          });

          if (!employee) {
            logger.warn(`Employee not found for NIP: ${nip}`);
            skippedCount++;
            continue;
          }

          // Parse attendance date and time
          const recordTime = new Date(log.recordTime);
          const tanggal = new Date(recordTime.toDateString()); // Date only
          const jamMasuk = recordTime.toTimeString().split(' ')[0]; // Time only

          // Check if record already exists
          const existing = await prisma.attendance.findFirst({
            where: {
              nip: employee.nip,
              tanggal: tanggal,
              jam_masuk: jamMasuk,
              is_deleted: false
            }
          });

          if (existing) {
            skippedCount++;
            continue;
          }

          // Create new attendance record
          await prisma.attendance.create({
            data: {
              user_id: employee.nip,
              nip: employee.nip,
              nama: employee.nama,
              jabatan: employee.jabatan,
              tanggal: tanggal,
              jam_masuk: jamMasuk,
              jam_keluar: null, // Will be updated on check-out
              device_id: process.env.FINGERPRINT_DEVICE_ID || 'FP-MAIN-001',
              verification_method: 'SIDIK_JARI',
              status: 'HADIR',
              is_deleted: false
            }
          });

          syncedCount++;
          logger.info(`Synced attendance for ${employee.nama} (${employee.nip})`);
        } catch (err) {
          logger.error(`Error processing log for user ${log.deviceUserId}:`, err);
          errors.push({ userId: log.deviceUserId, error: err.message });
        }
      }

      logger.info(`Sync completed: ${syncedCount} synced, ${skippedCount} skipped`);

      return successResponse(
        res,
        {
          synced: syncedCount,
          skipped: skippedCount,
          total: logs.length,
          errors: errors.length > 0 ? errors : undefined
        },
        `Successfully synced ${syncedCount} attendance records`
      );
    } catch (error) {
      logger.error('Fingerprint sync error:', { error: error.message, stack: error.stack });
      return errorResponse(res, `Failed to sync fingerprint data: ${error.message}`, 500);
    }
  }

  /**
   * Get fingerprint device status
   * GET /api/attendance/device-status
   */
  static async getDeviceStatus(req, res) {
    try {
      const fingerprintService = require('../services/fingerprint.service');

      // Try to connect to device
      await fingerprintService.connect();
      await fingerprintService.disconnect();

      return successResponse(
        res,
        {
          status: 'connected',
          ip: process.env.FINGERPRINT_IP || '192.168.1.201',
          port: process.env.FINGERPRINT_PORT || 4370,
          message: 'Device is online and ready'
        },
        'Device status retrieved successfully'
      );
    } catch (error) {
      logger.error('Device status check error:', { error: error.message });
      return successResponse(
        res,
        {
          status: 'disconnected',
          ip: process.env.FINGERPRINT_IP || '192.168.1.201',
          port: process.env.FINGERPRINT_PORT || 4370,
          message: error.message,
          error: 'Device is offline or unreachable'
        },
        'Device is offline'
      );
    }
  }

  /**
   * Import attendance data from Excel/CSV file
   * POST /api/attendance/import
   */
  static async importAttendance(req, res) {
    try {
      // Check if file exists (should be caught by validator, but double-check)
      if (!req.file) {
        return errorResponse(res, 'File tidak ditemukan', 400);
      }

      const AttendanceImportService = require('../services/attendance.import.service');

      logger.info('Processing attendance import', {
        filename: req.file.originalname,
        size: req.file.size,
        user: req.user?.id
      });

      // Process import
      const result = await AttendanceImportService.processImport(
        req.file.buffer,
        req.file.originalname,
        {
          skipDuplicates: true // Default behavior: skip duplicates
        }
      );

      // Log audit trail
      logger.audit('ATTENDANCE_IMPORT', req.user?.id, {
        filename: req.file.originalname,
        total: result.total,
        imported: result.imported,
        skipped: result.skipped,
        duplicates: result.duplicates
      });

      // Return response based on result
      if (!result.success) {
        return errorResponse(res, result.message, 400, result.errors);
      }

      // Success response with detailed report
      const statusCode = result.imported > 0 ? 200 : 400;
      return res.status(statusCode).json({
        success: result.imported > 0,
        message: result.message,
        data: {
          summary: {
            total: result.total,
            imported: result.imported,
            skipped: result.skipped,
            duplicates: result.duplicates,
            errors: result.errors.length
          },
          errors: result.errors.length > 0 ? result.errors : undefined,
          duplicateDetails: result.duplicateDetails
        }
      });
    } catch (error) {
      logger.error('Import attendance error:', { error: error.message, stack: error.stack });
      return errorResponse(res, `Gagal memproses file import: ${error.message}`, 500);
    }
  }

  /**
   * Download import template
   * GET /api/attendance/import/template
   */
  static async downloadImportTemplate(req, res) {
    try {
      const XLSX = require('xlsx');
      const path = require('path');

      // Create workbook
      const wb = XLSX.utils.book_new();

      // Create sample data with headers in Indonesian
      const sampleData = [
        {
          nip: '123456',
          nama: 'John Doe',
          jabatan: 'DOSEN',
          tanggal: '2026-02-15',
          jam_masuk: '08:00:00',
          jam_keluar: '17:00:00',
          status: 'HADIR',
          verification_method: 'MANUAL'
        },
        {
          nip: '123457',
          nama: 'Jane Smith',
          jabatan: 'KARYAWAN',
          tanggal: '2026-02-15',
          jam_masuk: '08:30:00',
          jam_keluar: '17:30:00',
          status: 'HADIR',
          verification_method: 'MANUAL'
        },
        {
          nip: '123458',
          nama: '',
          jabatan: '',
          tanggal: '2026-02-15',
          jam_masuk: '09:00:00',
          jam_keluar: '',
          status: '',
          verification_method: ''
        }
      ];

      // Convert to worksheet
      const ws = XLSX.utils.json_to_sheet(sampleData);

      // Set column widths
      ws['!cols'] = [
        { wch: 15 }, // nip
        { wch: 25 }, // nama
        { wch: 12 }, // jabatan
        { wch: 12 }, // tanggal
        { wch: 12 }, // jam_masuk
        { wch: 12 }, // jam_keluar
        { wch: 12 }, // status
        { wch: 20 }  // verification_method
      ];

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Template Absensi');

      // Generate buffer
      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      // Set headers for download
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=template_import_absensi.xlsx');
      res.setHeader('Content-Length', buffer.length);

      // Send file
      return res.send(buffer);
    } catch (error) {
      logger.error('Download template error:', { error: error.message });
      return errorResponse(res, 'Gagal mengunduh template', 500);
    }
  }
}

module.exports = AttendanceController;
