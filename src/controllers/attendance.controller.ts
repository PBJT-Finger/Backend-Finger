import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { successResponse, errorResponse } from '../utils/responseFormatter';
import logger from '../utils/logger';
import { env } from '../config/env';
import { ZkDeviceClient } from '../infrastructure/zk-client';
import AttendanceImportService from '../services/attendance.import.service';
import {
  transformDosenAttendance,
  transformKaryawanAttendance,
  calculateWorkingDays,
} from '../utils/attendanceTransformer';

/**
 * Parse a YYYY-MM-DD string as a UTC Date so Prisma doesn't shift it backwards.
 */
function parseLocalDate(d: string | null): Date | null {
  if (!d) return null;
  const str = typeof d === 'string' ? d.split('T')[0] : String(d);
  if (!str) return null;
  const parts = str.split('-');
  const y = Number(parts[0] || '0');
  const m = Number(parts[1] || '0');
  const day = Number(parts[2] || '0');
  if (!y || !m || !day) return null;
  return new Date(Date.UTC(y, m - 1, day));
}

export class AttendanceController {
  /**
   * Get lecturer (dosen) attendance
   * GET /api/attendance/dosen
   */
  public static async getLecturerAttendance(req: Request, res: Response): Promise<Response> {
    try {
      const { start_date, end_date, dosen_id, page = 1, limit = 50 } = req.query;

      const whereClause: Record<string, unknown> = {
        jabatan: 'DOSEN',
        is_deleted: false,
      };

      const startDateStr = typeof start_date === 'string' ? start_date : null;
      const endDateStr = typeof end_date === 'string' ? end_date : null;

      if (startDateStr && endDateStr) {
        whereClause['tanggal'] = {
          gte: parseLocalDate(startDateStr),
          lte: parseLocalDate(endDateStr),
        };
      }

      if (dosen_id) {
        whereClause['user_id'] = dosen_id;
      }

      // We load all raw records because transformer needs to process/group them
      const attendance = await prisma.attendance.findMany({
        where: whereClause,
        orderBy: [{ tanggal: 'desc' }, { jam_masuk: 'asc' }],
      });

      // Transform to aggregated data
      const transformedData = transformDosenAttendance(
        attendance.map((a) => ({
          tanggal: a.tanggal,
          user_id: a.user_id,
          nama: a.nama,
          jabatan: a.jabatan,
          jam_masuk: a.jam_masuk,
          jam_keluar: a.jam_keluar,
          status: a.status,
        })),
        startDateStr || undefined,
        endDateStr || undefined
      );

      // Apply pagination
      const pageNum = parseInt(page as string) || 1;
      const limitNum = parseInt(limit as string) || 50;
      const skip = (pageNum - 1) * limitNum;
      const paginatedData = transformedData.slice(skip, skip + limitNum);

      return successResponse(res, paginatedData, 'Lecturer attendance retrieved successfully');
    } catch (error) {
      logger.error('Get lecturer attendance error', { error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined });
      return errorResponse(res, 'Failed to retrieve lecturer attendance', 500);
    }
  }

  /**
   * Get employee (karyawan) attendance
   * GET /api/attendance/karyawan
   */
  public static async getEmployeeAttendance(req: Request, res: Response): Promise<Response> {
    try {
      const { start_date, end_date, karyawan_id, page = 1, limit = 50 } = req.query;

      const whereClause: Record<string, unknown> = {
        jabatan: 'KARYAWAN',
        is_deleted: false,
      };

      const startDateStr = typeof start_date === 'string' ? start_date : null;
      const endDateStr = typeof end_date === 'string' ? end_date : null;

      if (startDateStr && endDateStr) {
        whereClause['tanggal'] = {
          gte: parseLocalDate(startDateStr),
          lte: parseLocalDate(endDateStr),
        };
      }

      if (karyawan_id) {
        whereClause['user_id'] = karyawan_id;
      }

      const attendance = await prisma.attendance.findMany({
        where: whereClause,
        orderBy: [{ tanggal: 'desc' }, { jam_masuk: 'asc' }],
      });

      // Transform to aggregated data
      const transformedData = transformKaryawanAttendance(
        attendance.map((a) => ({
          tanggal: a.tanggal,
          user_id: a.user_id,
          nama: a.nama,
          jabatan: a.jabatan,
          jam_masuk: a.jam_masuk,
          jam_keluar: a.jam_keluar,
          status: a.status,
        })),
        startDateStr || undefined,
        endDateStr || undefined
      );

      // Apply pagination
      const pageNum = parseInt(page as string) || 1;
      const limitNum = parseInt(limit as string) || 50;
      const skip = (pageNum - 1) * limitNum;
      const paginatedData = transformedData.slice(skip, skip + limitNum);

      return successResponse(res, paginatedData, 'Employee attendance retrieved successfully');
    } catch (error) {
      logger.error('Get employee attendance error', { error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined });
      return errorResponse(res, 'Failed to retrieve employee attendance', 500);
    }
  }

  /**
   * Get all attendance (generic endpoint)
   */
  public static async getAttendance(req: Request, res: Response): Promise<Response> {
    try {
      const { start_date, end_date, user_id, id, jabatan, status, page = 1, limit = 50 } = req.query;

      const whereClause: Record<string, unknown> = {
        is_deleted: false,
      };

      const startDateStr = typeof start_date === 'string' ? start_date : null;
      const endDateStr = typeof end_date === 'string' ? end_date : null;

      if (startDateStr && endDateStr) {
        whereClause['tanggal'] = {
          gte: parseLocalDate(startDateStr),
          lte: parseLocalDate(endDateStr),
        };
      }

      if (id || user_id) {
        whereClause['user_id'] = id || user_id;
      }

      if (jabatan) {
        whereClause['jabatan'] = jabatan;
      }

      if (status) {
        whereClause['status'] = status;
      }

      // Get total count
      const total = await prisma.attendance.count({ where: whereClause });

      // Get attendance with pagination
      const pageNum = parseInt(page as string) || 1;
      const limitNum = parseInt(limit as string) || 50;
      const skip = (pageNum - 1) * limitNum;

      const attendance = await prisma.attendance.findMany({
        where: whereClause,
        orderBy: { tanggal: 'desc' },
        skip: skip,
        take: limitNum,
      });

      return successResponse(
        res,
        {
          data: attendance,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            total_pages: Math.ceil(total / limitNum),
          },
        },
        'Attendance retrieved successfully'
      );
    } catch (error) {
      logger.error('Get attendance error', { error: error instanceof Error ? error.message : String(error) });
      return errorResponse(res, 'Failed to retrieve attendance', 500);
    }
  }

  /**
   * Get attendance summary/rekap
   */
  public static async getAttendanceSummary(req: Request, res: Response): Promise<Response> {
    try {
      let startDate = req.query['startDate'] || req.query['start_date'];
      let endDate = req.query['endDate'] || req.query['end_date'];
      const { id, user_id, jabatan } = req.query;

      // If no dates provided, default to current month
      if (!startDate && !endDate) {
        const now = new Date();
        const y = now.getFullYear();
        const m = now.getMonth();
        const firstDay = new Date(y, m, 1);
        const lastDay = new Date(y, m + 1, 0);

        const formatDate = (d: Date): string => {
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        };

        startDate = formatDate(firstDay);
        endDate = formatDate(lastDay);
      } else if (!startDate || !endDate) {
        return errorResponse(
          res,
          'Both start_date and end_date are required for custom range',
          400
        );
      }

      const whereClause: Record<string, unknown> = {
        tanggal: {
          gte: parseLocalDate(startDate as string),
          lte: parseLocalDate(endDate as string),
        },
        is_deleted: false,
      };

      if (id || user_id) {
        whereClause['user_id'] = id || user_id;
      }

      if (jabatan) {
        whereClause['jabatan'] = jabatan;
      } else {
        whereClause['jabatan'] = { in: ['DOSEN', 'KARYAWAN'] };
      }

      // Get all distinct users matching the base filter
      const baseFilter: Record<string, unknown> = { is_deleted: false };
      if (id || user_id) baseFilter['user_id'] = id || user_id;
      if (jabatan) baseFilter['jabatan'] = jabatan;
      else baseFilter['jabatan'] = { in: ['DOSEN', 'KARYAWAN'] };

      const allUsers = await prisma.attendance.findMany({
        where: baseFilter,
        distinct: ['user_id'],
        select: { user_id: true, nama: true, jabatan: true }
      });

      // Initialize stats with all users
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const employeeStats: Record<string, any> = {};

      allUsers.forEach((u) => {
        employeeStats[u.user_id] = {
          user_id: u.user_id,
          nama: u.nama,
          jabatan: u.jabatan,
          attendanceDates: new Set<string>(),
          terlambat_dates: new Set<string>(),
          hadir_pagi: new Set<string>(),
          hadir_malam: new Set<string>(),
          last_check_in: null,
          last_check_out: null,
        };
      });

      const attendance = await prisma.attendance.findMany({
        where: whereClause,
        orderBy: [
          { tanggal: 'desc' },
          { jam_keluar: 'desc' },
          { jam_masuk: 'desc' },
        ],
      });

      attendance.forEach((record) => {
        const key = record.user_id;
        if (!key) return;
        if (!employeeStats[key]) {
          employeeStats[key] = {
            user_id: record.user_id,
            nama: record.nama,
            jabatan: record.jabatan,
            attendanceDates: new Set<string>(),
            terlambat_dates: new Set<string>(),
            hadir_pagi: new Set<string>(),
            hadir_malam: new Set<string>(),
            last_check_in: null,
            last_check_out: null,
          };
        }

        const stats = employeeStats[key];
        if (stats) {
          const t = record.tanggal;
          const dateStr =
            typeof (t as any) === 'string'
              ? (t as any).split('T')[0]
              : `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;

          const recordDate = new Date(dateStr || '');
          if (recordDate.getDay() !== 0) {
            stats.attendanceDates.add(dateStr);
          }

          if (!stats.last_check_in && record.jam_masuk) {
            stats.last_check_in = record.jam_masuk;
          }

          if (!stats.last_check_out && record.jam_keluar) {
            stats.last_check_out = record.jam_keluar;
          }

          if (record.status === 'TERLAMBAT') {
            stats.terlambat_dates.add(dateStr);
          }

          if (record.jam_masuk) {
            let hour = -1;
            if (typeof record.jam_masuk === 'string') {
               const match = (record.jam_masuk as string).match(/^(\d{2}):/);
               if (match) hour = parseInt(match[1] || '0', 10);
            } else {
               // Prisma returns Time as Date (1970-01-01 UTC)
               hour = new Date(record.jam_masuk).getUTCHours();
            }
            if (hour >= 0) {
               if (hour >= 6 && hour < 15) stats.hadir_pagi.add(dateStr);
               else if (hour >= 15 && hour <= 22) stats.hadir_malam.add(dateStr);
            }
          }
        }
      });

      const formatTimeOnly = (dateTime: Date | string | null): string | null => {
        if (!dateTime) return null;
        if (typeof dateTime === 'string') return dateTime.substring(0, 5);
        const d = new Date(dateTime);
        if (isNaN(d.getTime())) return null;

        const hours = String(d.getUTCHours()).padStart(2, '0');
        const minutes = String(d.getUTCMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
      };

      const formatDateRange = (dates: string[]): string | null => {
        if (!dates || dates.length === 0) return null;

        const months = [
          'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
          'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
        ];

        const firstVal = dates[0];
        const lastVal = dates[dates.length - 1];
        if (!firstVal || !lastVal) return null;

        const firstDate = new Date(firstVal);
        const lastDate = new Date(lastVal);

        const startDay = firstDate.getDate();
        const startMonth = months[firstDate.getMonth()];
        const startYear = firstDate.getFullYear();

        const endDay = lastDate.getDate();
        const endMonth = months[lastDate.getMonth()];
        const endYear = lastDate.getFullYear();

        if (startDay === endDay && startMonth === endMonth && startYear === endYear) {
          return `${startDay} ${endMonth} ${endYear}`;
        }
        if (startMonth === endMonth && startYear === endYear) {
          return `${startDay} - ${endDay} ${endMonth} ${endYear}`;
        }
        return `${startDay} ${startMonth || ''} ${startYear} - ${endDay} ${endMonth || ''} ${endYear}`;
      };

      const totalWorkingDaysInPeriod = calculateWorkingDays(startDate as string, endDate as string);

      const summary = Object.values(employeeStats).map((emp, index) => {
        const attendanceDatesArray = Array.from(emp.attendanceDates as Set<string>).sort();
        const totalHadir = attendanceDatesArray.length;
        const totalHariKerja = totalWorkingDaysInPeriod;

        return {
          id: emp.user_id,
          no: index + 1,
          nama: emp.nama,
          jabatan: emp.jabatan,
          totalHadir: totalHadir,
          hadirPagi: emp.hadir_pagi.size,
          hadirMalam: emp.hadir_malam.size,
          totalTerlambat: emp.terlambat_dates ? emp.terlambat_dates.size : 0,
          totalHariKerja: totalHariKerja,
          persentase: totalHariKerja > 0 ? Math.round((totalHadir / totalHariKerja) * 100) : 0,
          attendanceDates: formatDateRange(attendanceDatesArray),
          lastCheckIn: formatTimeOnly(emp.last_check_in),
          lastCheckOut: formatTimeOnly(emp.last_check_out),
        };
      });

      return successResponse(
        res,
        summary,
        'Attendance summary calculated successfully'
      );
    } catch (error) {
      logger.error('Get attendance summary error', { error: error instanceof Error ? error.message : String(error) });
      return errorResponse(res, 'Failed to calculate attendance summary', 500);
    }
  }

  /**
   * Delete attendance record (soft delete)
   */
  public static async deleteAttendance(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const attendanceId = parseInt(id || '');

      if (isNaN(attendanceId)) {
        return errorResponse(res, 'ID Absensi tidak valid', 400);
      }

      const attendance = await prisma.attendance.findUnique({
        where: { id: attendanceId },
      });

      if (!attendance) {
        return errorResponse(res, 'Attendance record not found', 404);
      }

      await prisma.attendance.update({
        where: { id: attendanceId },
        data: { is_deleted: true },
      });

      const actorId = (req as any).user?.id ?? 0;
      logger.audit('ATTENDANCE_DELETED', actorId, {
        attendance_id: id,
        user_id: attendance.user_id,
        tanggal: attendance.tanggal,
      });

      return successResponse(res, null, 'Attendance record deleted successfully');
    } catch (error) {
      logger.error('Delete attendance error', { error: error instanceof Error ? error.message : String(error) });
      return errorResponse(res, 'Failed to delete attendance record', 500);
    }
  }

  /**
   * Update admin notes for a specific attendance record
   */
  public static async updateAdminNotes(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const { note } = req.body;
      const attendanceId = parseInt(id || '');

      if (isNaN(attendanceId)) {
        return errorResponse(res, 'ID Absensi tidak valid', 400);
      }

      const attendance = await prisma.attendance.findUnique({
        where: { id: attendanceId },
      });

      if (!attendance) {
        return errorResponse(res, 'Data absensi tidak ditemukan', 404);
      }

      const updated = await prisma.attendance.update({
        where: { id: attendanceId },
        data: { admin_notes: note },
      });

      const actorId = (req as any).user?.id ?? 0;
      logger.audit('ADMIN_NOTE_UPDATED', actorId, {
        attendance_id: id,
        note: note,
      });

      return successResponse(res, updated, 'Catatan admin berhasil diperbarui');
    } catch (error) {
      logger.error('Update admin notes error', { error: error instanceof Error ? error.message : String(error) });
      return errorResponse(res, 'Gagal memperbarui catatan admin', 500);
    }
  }

  /**
   * Get attendance summary (stub for /summary route)
   */
  public static async getSummary(req: Request, res: Response): Promise<Response> {
    try {
      return AttendanceController.getAttendanceSummary(req, res);
    } catch (error) {
      logger.error('Get summary error', { error: error instanceof Error ? error.message : String(error) });
      return errorResponse(res, 'Failed to get attendance summary', 500);
    }
  }

  /**
   * Get monthly report
   */
  public static async getMonthlyReport(req: Request, res: Response): Promise<Response> {
    try {
      const { bulan, tahun } = req.query;

      if (!bulan || !tahun) {
        return errorResponse(res, 'Bulan dan Tahun wajib diisi', 400);
      }

      const monthIndex = parseInt(bulan as string) - 1;
      const year = parseInt(tahun as string);

      const startDateObj = new Date(year, monthIndex, 1);
      const endDateObj = new Date(year, monthIndex + 1, 0);

      const formatDate = (d: Date): string => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      };

      const startDate = formatDate(startDateObj);
      const endDate = formatDate(endDateObj);

      req.query['start_date'] = startDate;
      req.query['end_date'] = endDate;
      req.query['startDate'] = startDate;
      req.query['endDate'] = endDate;

      logger.info(`Generating monthly report for ${String(bulan)}/${String(tahun)} (${startDate} to ${endDate})`);

      return AttendanceController.getAttendanceSummary(req, res);
    } catch (error) {
      logger.error('Get monthly report error', { error: error instanceof Error ? error.message : String(error) });
      return errorResponse(res, 'Failed to get monthly report', 500);
    }
  }

  /**
   * Sync attendance data from fingerprint device
   * POST /api/attendance/sync-fingerprint
   */
  public static async syncFromFingerprint(req: Request, res: Response): Promise<Response> {
    try {
      const client = ZkDeviceClient.getInstance();
      if (client.getStatus() === 'offline') {
        await client.start();
      }
      return successResponse(
        res,
        {
          status: client.getStatus(),
          lastSyncCount: client.getLastSyncCount(),
        },
        'Fingerprint sync triggered successfully'
      );
    } catch (error) {
      logger.error('Fingerprint sync error:', { error: error instanceof Error ? error.message : String(error) });
      return errorResponse(res, `Failed to sync fingerprint data: ${error instanceof Error ? error.message : String(error)}`, 500);
    }
  }

  /**
   * Get fingerprint device status
   * GET /api/attendance/device-status
   */
  public static async getDeviceStatus(req: Request, res: Response): Promise<Response> {
    try {
      const client = ZkDeviceClient.getInstance();
      const status = client.getStatus();
      return successResponse(
        res,
        {
          status,
          ip: env.FINGERPRINT_IP,
          port: env.FINGERPRINT_PORT,
          lastSyncCount: client.getLastSyncCount(),
          message: status === 'online' ? 'Device is online and ready' : 'Device is offline or connecting',
        },
        'Device status retrieved successfully'
      );
    } catch (error) {
      logger.error('Device status check error:', { error: error instanceof Error ? error.message : String(error) });
      return errorResponse(res, `Failed to check device status: ${error instanceof Error ? error.message : String(error)}`, 500);
    }
  }

  /**
   * Import attendance data from Excel/CSV file
   */
  public static async importAttendance(req: Request, res: Response): Promise<Response> {
    try {
      if (!req.file) {
        return errorResponse(res, 'File tidak ditemukan', 400);
      }

      logger.info('Processing attendance import', {
        filename: req.file.originalname,
        size: req.file.size,
        user: (req as any).user?.id,
      });

      const result = await AttendanceImportService.processImport(
        req.file.buffer,
        req.file.originalname,
        {
          skipDuplicates: true,
        }
      );

      const actorId = (req as any).user?.id ?? 0;
      logger.audit('ATTENDANCE_IMPORT', actorId, {
        filename: req.file.originalname,
        total: result.total,
        imported: result.imported,
        skipped: result.skipped,
        duplicates: result.duplicates,
      });

      if (!result.success) {
        return errorResponse(res, result.message, 400);
      }

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
      logger.error('Import attendance error:', { error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined });
      return errorResponse(res, `Gagal memproses file import: ${error instanceof Error ? error.message : String(error)}`, 500);
    }
  }
}
export default AttendanceController;
