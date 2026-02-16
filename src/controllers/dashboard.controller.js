// src/controllers/dashboard.controller.js - Dashboard Statistics (Prisma)
const prisma = require('../config/prisma');
const { successResponse, errorResponse } = require('../utils/responseFormatter');
const logger = require('../utils/logger');

class DashboardController {
  /**
   * Get dashboard summary statistics
   * GET /api/dashboard/summary
   */
  static async getSummary(req, res) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Get today's attendance
      const todayAttendance = await prisma.attendance.findMany({
        where: {
          tanggal: {
            gte: today,
            lt: tomorrow
          },
          is_deleted: false
        }
      });

      // Calculate statistics
      const stats = {
        today: {
          total_attendance: todayAttendance.length,
          unique_employees: new Set(todayAttendance.map(a => a.nip)).size,
          hadir: todayAttendance.filter(a => a.jam_masuk !== null).length,
          terlambat: todayAttendance.filter(a => a.status === 'TERLAMBAT').length,
          dosen: todayAttendance.filter(a => a.jabatan === 'DOSEN').length,
          karyawan: todayAttendance.filter(a => a.jabatan === 'KARYAWAN').length
        }
      };

      // Get total employees
      const [dosenCount, karyawanCount, deviceCount] = await Promise.all([
        prisma.employees.count({ where: { jabatan: 'DOSEN', is_active: true } }),
        prisma.employees.count({ where: { jabatan: 'KARYAWAN', is_active: true } }),
        prisma.devices.count({ where: { is_active: true } })
      ]);

      stats.total = {
        employees: dosenCount + karyawanCount,
        dosen: dosenCount,
        karyawan: karyawanCount,
        devices: deviceCount
      };

      // Calculate attendance percentage
      stats.today.attendance_percentage =
        stats.total.employees > 0
          ? Math.round((stats.today.unique_employees / stats.total.employees) * 100)
          : 0;

      // Get this month's statistics
      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const firstDayOfNextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

      const monthlyCount = await prisma.attendance.count({
        where: {
          tanggal: {
            gte: firstDayOfMonth,
            lt: firstDayOfNextMonth
          },
          is_deleted: false
        }
      });

      stats.monthly = {
        total_attendance: monthlyCount,
        month: today.getMonth() + 1,
        year: today.getFullYear()
      };

      // Recent attendance (last 10)
      const recentAttendance = await prisma.attendance.findMany({
        where: { is_deleted: false },
        orderBy: { created_at: 'desc' },
        take: 10
      });

      return successResponse(
        res,
        {
          statistics: stats,
          recent_attendance: recentAttendance,
          timestamp: new Date().toISOString()
        },
        'Dashboard statistics retrieved successfully'
      );
    } catch (error) {
      logger.error('Get dashboard summary error', { error: error.message, stack: error.stack });
      return errorResponse(res, 'Failed to retrieve dashboard statistics', 500);
    }
  }

  /**
   * Get attendance trends
   * GET /api/dashboard/trends?days=7
   */
  static async getTrends(req, res) {
    try {
      const { days = 7 } = req.query;

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(days));
      startDate.setHours(0, 0, 0, 0);

      const attendance = await prisma.attendance.findMany({
        where: {
          tanggal: { gte: startDate },
          is_deleted: false
        },
        orderBy: { tanggal: 'asc' }
      });

      // Group by date
      const dailyStats = {};

      attendance.forEach(record => {
        const day = record.tanggal.toISOString().split('T')[0];
        if (!dailyStats[day]) {
          dailyStats[day] = {
            date: day,
            total: 0,
            hadir: 0,
            terlambat: 0,
            dosen: 0,
            karyawan: 0
          };
        }

        dailyStats[day].total++;
        if (record.jam_masuk) dailyStats[day].hadir++;
        if (record.status === 'TERLAMBAT') dailyStats[day].terlambat++;
        if (record.jabatan === 'DOSEN') dailyStats[day].dosen++;
        if (record.jabatan === 'KARYAWAN') dailyStats[day].karyawan++;
      });

      const trends = Object.values(dailyStats);

      return successResponse(
        res,
        {
          trends,
          period: {
            start_date: startDate.toISOString().split('T')[0],
            end_date: new Date().toISOString().split('T')[0],
            days: parseInt(days)
          }
        },
        'Attendance trends retrieved successfully'
      );
    } catch (error) {
      logger.error('Get attendance trends error', { error: error.message });
      return errorResponse(res, 'Failed to retrieve attendance trends', 500);
    }
  }
}

module.exports = DashboardController;
