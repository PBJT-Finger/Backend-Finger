import { Request, Response } from 'express';
import { successResponse, errorResponse } from '../utils/responseFormatter';
import prisma from '../config/prisma';
import logger from '../utils/logger';

export class PersonalController {
  /**
   * Mengambil riwayat absensi milik pengguna (Dosen/Karyawan) yang sedang login
   * GET /api/attendance/me
   */
  public static async getMyAttendance(req: Request, res: Response): Promise<Response> {
    try {
      const user = req.user;
      
      if (!user) {
        return errorResponse(res, 'Unauthenticated', 401);
      }

      if (!user.employee_id) {
        return errorResponse(res, 'Akun Anda tidak tertaut dengan data pegawai (employee_id kosong).', 400);
      }

      // Ambil rentang waktu (misal: bulan ini)
      const { startDate, endDate } = req.query;
      let dateFilter = {};
      
      if (startDate && endDate) {
        dateFilter = {
          tanggal: {
            gte: new Date(startDate as string),
            lte: new Date(endDate as string),
          }
        };
      } else {
        // Default ke 30 hari terakhir
        const today = new Date();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(today.getDate() - 30);
        dateFilter = {
          tanggal: {
            gte: thirtyDaysAgo,
            lte: today,
          }
        };
      }

      let records = await prisma.attendance.findMany({
        where: {
          user_id: user.employee_id,
          is_deleted: false,
          ...dateFilter
        },
        orderBy: {
          tanggal: 'desc'
        },
        take: 100 // limit for safety
      });

      // Fallback jika tidak ada data di rentang waktu tersebut (untuk keperluan presentasi UI)
      if (records.length === 0 && !req.query.startDate) {
        records = await prisma.attendance.findMany({
          where: {
            user_id: user.employee_id,
            is_deleted: false,
          },
          orderBy: {
            tanggal: 'desc'
          },
          take: 30
        });
      }

      return successResponse(res, records, 'Berhasil mengambil data absensi pribadi');
    } catch (error: any) {
      logger.error('[PersonalController] Gagal getMyAttendance', { error: error.message });
      return errorResponse(res, 'Internal server error', 500);
    }
  }

  /**
   * Mengambil rekap kehadiran (hadir, terlambat) bulan ini
   * GET /api/attendance/me/summary
   */
  public static async getMySummary(req: Request, res: Response): Promise<Response> {
    try {
      const user = req.user;
      if (!user || !user.employee_id) {
        return errorResponse(res, 'Unauthenticated / Tidak tertaut', 401);
      }

      const today = new Date();
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);

      let records = await prisma.attendance.findMany({
        where: {
          user_id: user.employee_id,
          is_deleted: false,
          tanggal: {
            gte: firstDay,
            lte: lastDay,
          }
        },
        select: {
          status: true,
          status_keluar: true
        }
      });

      // Fallback: Jika bulan ini kosong (misal karena data seed lama), ambil 30 data terakhir
      if (records.length === 0) {
        records = await prisma.attendance.findMany({
          where: {
            user_id: user.employee_id,
            is_deleted: false,
          },
          orderBy: {
            tanggal: 'desc'
          },
          take: 30,
          select: {
            status: true,
            status_keluar: true
          }
        });
      }

      let hadir = 0;
      let terlambat = 0;

      records.forEach(r => {
        if (r.status === 'HADIR') hadir++;
        if (r.status === 'TERLAMBAT') terlambat++;
      });

      return successResponse(res, { hadir, terlambat, total: records.length }, 'Berhasil mengambil summary');
    } catch (error: any) {
      logger.error('[PersonalController] Gagal getMySummary', { error: error.message });
      return errorResponse(res, 'Internal server error', 500);
    }
  }
}
