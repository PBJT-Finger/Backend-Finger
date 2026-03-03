// src/controllers/attendance.controller.js - Attendance Management (Prisma)
const prisma = require('../config/prisma');
const { successResponse, errorResponse } = require('../utils/responseFormatter');
const logger = require('../utils/logger');

/**
 * Parse a YYYY-MM-DD string as a LOCAL date (not UTC).
 * Using new Date('YYYY-MM-DD') interprets the string as UTC midnight,
 * which causes a timezone shift of -7 hours in WIB (UTC+7) servers,
 * resulting in the wrong date (H-1). This helper avoids that issue.
 * @param {string|null} d - Date string in YYYY-MM-DD format
 * @returns {Date|null} Local-time Date object
 */
function parseLocalDate(d) {
  if (!d) return null;
  const str = typeof d === 'string' ? d.split('T')[0] : String(d);
  const [y, m, day] = str.split('-').map(Number);
  if (!y || !m || !day) return null;
  return new Date(y, m - 1, day); // local midnight, no UTC shift
}

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
        is_deleted: false,
      };

      if (start_date && end_date) {
        whereClause.tanggal = {
          gte: parseLocalDate(start_date),
          lte: parseLocalDate(end_date),
        };
      }

      if (dosen_id) {
        whereClause.nip = dosen_id;
      }

      const attendance = await prisma.attendance.findMany({
        where: whereClause,
        orderBy: [{ tanggal: 'desc' }, { jam_masuk: 'asc' }],
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
        is_deleted: false,
      };

      if (start_date && end_date) {
        whereClause.tanggal = {
          gte: parseLocalDate(start_date),
          lte: parseLocalDate(end_date),
        };
      }

      if (karyawan_id) {
        whereClause.nip = karyawan_id;
      }

      const attendance = await prisma.attendance.findMany({
        where: whereClause,
        orderBy: [{ tanggal: 'desc' }, { jam_masuk: 'asc' }],
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
      const { start_date, end_date, nip, id, jabatan, status, page = 1, limit = 50 } = req.query;

      const whereClause = {
        is_deleted: false,
      };

      if (start_date && end_date) {
        whereClause.tanggal = {
          gte: parseLocalDate(start_date),
          lte: parseLocalDate(end_date),
        };
      }

      // Filter by ID (or legacy term NIP)
      if (id || nip) {
        whereClause.nip = id || nip;
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
        take: parseInt(limit),
      });

      return successResponse(
        res,
        {
          data: attendance,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            total_pages: Math.ceil(total / parseInt(limit)),
          },
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
      let startDate = req.query.startDate || req.query.start_date;
      let endDate = req.query.endDate || req.query.end_date;
      const { id, nip, jabatan } = req.query;

      // If no dates provided, default to current month
      if (!startDate && !endDate) {
        const now = new Date();
        const y = now.getFullYear();
        const m = now.getMonth();
        const firstDay = new Date(y, m, 1);
        const lastDay = new Date(y, m + 1, 0);

        // Format to YYYY-MM-DD (local time)
        const formatDate = (d) => {
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        };

        startDate = formatDate(firstDay);
        endDate = formatDate(lastDay);
      } else if (!startDate || !endDate) {
        // Partial dates provided
        return errorResponse(
          res,
          'Both start_date and end_date are required for custom range',
          400
        );
      }

      const whereClause = {
        tanggal: {
          gte: parseLocalDate(startDate),
          lte: parseLocalDate(endDate),
        },
        is_deleted: false,
      };

      if (id || nip) {
        whereClause.nip = id || nip;
      }

      if (jabatan) {
        whereClause.jabatan = jabatan;
      }

      const attendance = await prisma.attendance.findMany({
        where: whereClause,
        orderBy: [
          { tanggal: 'desc' },
          // jam_keluar DESC ensures records with a clock-out surface before null ones
          // on the same date — required for the first-non-null lastCheckOut search below.
          { jam_keluar: 'desc' },
          { jam_masuk: 'desc' },
        ],
      });

      // Group by employee
      const employeeStats = {};

      attendance.forEach((record) => {
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
            last_check_out_date: null, // Track date for check-out
          };
        }

        // Add unique date — use local date methods to avoid UTC timezone shift.
        // toISOString() would shift WIB dates back by 7 hours (e.g. 2026-02-04 WIB → '2026-02-03'),
        // causing the Set to contain wrong/extra dates and inflate totalHadir.
        const t = record.tanggal;
        const dateStr =
          typeof t === 'string'
            ? t.split('T')[0]
            : `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;

        // Only count working days (Mon–Sat). Skip Sunday (dayOfWeek === 0) to keep
        // totalHadir consistent with totalHariKerja (which also excludes Sunday).
        // This prevents inflated counts when import data contains Sunday records.
        const recordDate = new Date(dateStr);
        if (recordDate.getDay() !== 0) {
          employeeStats[key].attendanceDates.add(dateStr);
        }

        // Track lastCheckIn and lastCheckOut INDEPENDENTLY.
        //
        // Strategy: iterate records in ORDER (tanggal DESC, jam_keluar DESC, jam_masuk DESC).
        // For each field, take the FIRST non-null value encountered — that is the value
        // from the most recent date that has a populated field.
        //
        // This correctly handles cases like:
        //   • Most recent date: jam_masuk=07:25, jam_keluar=null
        //     → lastCheckIn=07:25 (from today), lastCheckOut from a previous date
        //   • Most recent date has only a pulang scan: jam_masuk=null, jam_keluar=06:53
        //     → lastCheckOut=06:53 (today), lastCheckIn from a previous date
        //
        // Do NOT compare raw jam_masuk Date values across records: Prisma stores MySQL TIME
        // columns as "1970-01-01THH:MM:SS" objects. Comparing them would pick 23:16 over
        // 08:00 even when 23:16 belongs to an older date.

        if (!employeeStats[key].last_check_in && record.jam_masuk) {
          employeeStats[key].last_check_in = record.jam_masuk;
        }

        if (!employeeStats[key].last_check_out && record.jam_keluar) {
          employeeStats[key].last_check_out = record.jam_keluar;
        }

        // Count late attendance
        if (record.status === 'TERLAMBAT') {
          employeeStats[key].total_terlambat++;
        }
      });

      // Helper function to format TIME only (HH:mm)
      // MySQL stores TIME in local WIB timezone, Prisma converts to UTC internally
      // getHours() (local) converts back to original stored time
      const formatTimeOnly = (dateTime) => {
        if (!dateTime) return null;
        // If already a string (e.g. from raw SQL), return as-is
        if (typeof dateTime === 'string') return dateTime.substring(0, 5);
        const d = new Date(dateTime);
        if (isNaN(d.getTime())) return null;

        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');

        return `${hours}:${minutes}`;
      };

      // Helper to format date range in Indonesian
      const formatDateRange = (dates) => {
        if (!dates || dates.length === 0) return null;

        // Indonesian month names
        const months = [
          'Januari',
          'Februari',
          'Maret',
          'April',
          'Mei',
          'Juni',
          'Juli',
          'Agustus',
          'September',
          'Oktober',
          'November',
          'Desember',
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

      // Calculate actual working days in the selected period (Mon-Sat, excluding Sunday)
      const { calculateWorkingDays } = require('../utils/attendanceTransformer');
      const totalWorkingDaysInPeriod = calculateWorkingDays(startDate, endDate);

      const summary = Object.values(employeeStats).map((emp, index) => {
        const attendanceDatesArray = Array.from(emp.attendanceDates).sort();
        const totalHadir = attendanceDatesArray.length; // Unique dates count
        const totalHariKerja = totalWorkingDaysInPeriod; // Actual working days in the period

        return {
          id: emp.nip, // Rename NIP to ID
          no: index + 1,
          nama: emp.nama,
          jabatan: emp.jabatan,
          totalHadir: totalHadir,
          totalHariKerja: totalHariKerja,
          persentase: totalHariKerja > 0 ? Math.round((totalHadir / totalHariKerja) * 100) : 0,
          attendanceDates: formatDateRange(attendanceDatesArray), // Format: "15-31 Mei 2025"
          lastCheckIn: formatTimeOnly(emp.last_check_in),
          lastCheckOut: formatTimeOnly(emp.last_check_out),
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
        where: { id: parseInt(id) },
      });

      if (!attendance) {
        return errorResponse(res, 'Attendance record not found', 404);
      }

      await prisma.attendance.update({
        where: { id: parseInt(id) },
        data: { is_deleted: true },
      });

      logger.audit('ATTENDANCE_DELETED', req.user?.id, {
        attendance_id: id,
        nip: attendance.nip,
        tanggal: attendance.tanggal,
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
   * Get monthly report (reuse summary logic with month/year params)
   */
  static async getMonthlyReport(req, res) {
    try {
      const { bulan, tahun } = req.query;

      if (!bulan || !tahun) {
        return errorResponse(res, 'Bulan dan Tahun wajib diisi', 400);
      }

      // Calculate start and end date of the month
      // Note: Month is 1-indexed in query, buy 0-indexed in Date constructor for month argument
      // new Date(year, monthIndex, 1) -> First day of month
      // new Date(year, monthIndex + 1, 0) -> Last day of month
      const monthIndex = parseInt(bulan) - 1;
      const year = parseInt(tahun);

      const startDateObj = new Date(year, monthIndex, 1);
      const endDateObj = new Date(year, monthIndex + 1, 0);

      // Format to YYYY-MM-DD
      // Note: We need local date string to ensure correct date is used
      // Use explicit formatting to avoid timezone issues
      const formatDate = (d) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      };

      const startDate = formatDate(startDateObj);
      const endDate = formatDate(endDateObj);

      // Inject into req.query so we can reuse getAttendanceSummary logic
      req.query.start_date = startDate;
      req.query.end_date = endDate;

      // Also inject for filter usage if needed
      req.query.startDate = startDate;
      req.query.endDate = endDate;

      logger.info(`Generating monthly report for ${bulan}/${tahun} (${startDate} to ${endDate})`);

      return AttendanceController.getAttendanceSummary(req, res);
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
            where: { nip: String(nip) },
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
              is_deleted: false,
            },
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
              is_deleted: false,
            },
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
          errors: errors.length > 0 ? errors : undefined,
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
          message: 'Device is online and ready',
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
          error: 'Device is offline or unreachable',
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
        user: req.user?.id,
      });

      // Process import
      const result = await AttendanceImportService.processImport(
        req.file.buffer,
        req.file.originalname,
        {
          skipDuplicates: true, // Default behavior: skip duplicates
        }
      );

      // Log audit trail
      logger.audit('ATTENDANCE_IMPORT', req.user?.id, {
        filename: req.file.originalname,
        total: result.total,
        imported: result.imported,
        skipped: result.skipped,
        duplicates: result.duplicates,
      });

      // Return response based on result
      if (!result.success) {
        return errorResponse(res, result.message, 400, result.errors);
      }

      // Success response with detailed report
      const hasFatalErrors =
        result.errors && result.errors.length === result.total && result.total > 0;
      const statusCode = hasFatalErrors ? 400 : 200;
      return res.status(statusCode).json({
        success: !hasFatalErrors,
        message: result.message,
        data: {
          summary: {
            total: result.total,
            imported: result.imported,
            skipped: result.skipped,
            duplicates: result.duplicates,
            errors: result.errors.length,
          },
          errors: result.errors.length > 0 ? result.errors : undefined,
          duplicateDetails: result.duplicateDetails,
          warnings: result.warnings,
        },
      });
    } catch (error) {
      logger.error('Import attendance error:', { error: error.message, stack: error.stack });
      return errorResponse(res, `Gagal memproses file import: ${error.message}`, 500);
    }
  }
}

module.exports = AttendanceController;
