// src/controllers/dashboard.controller.ts
// Kontroler ini bertugas mengolah statistik ringkasan dan tren data untuk ditampilkan di halaman Dashboard utama Admin.
// Data yang ditampilkan mencakup jumlah absensi hari ini, pembagian dosen/karyawan, persentase kehadiran, 
// data riwayat 10 absensi terbaru, serta tren absensi harian dalam periode tertentu (misal 7 hari terakhir).

import { Request, Response } from 'express';
import prisma from '../config/prisma'; // Instance Prisma Client untuk koneksi database
import { successResponse, errorResponse } from '../utils/responseFormatter'; // Util pembantu untuk standard response format API
import logger from '../utils/logger'; // Logger internal aplikasi

// Interface untuk data statistik tren harian
interface DailyStat {
  date: string; // Format YYYY-MM-DD
  total: number; // Total record absensi di hari tersebut
  hadir: number; // Total yang hadir tepat waktu / terlambat (jam masuk terisi)
  terlambat: number; // Total pegawai terlambat
  dosen: number; // Jumlah dosen yang hadir
  karyawan: number; // Jumlah karyawan yang hadir
}

export class DashboardController {
  /**
   * Mengambil statistik ringkasan dashboard (kehadiran hari ini, total pegawai, persentase kehadiran, dll).
   * GET /api/dashboard/summary
   */
  public static async getSummary(req: Request, res: Response): Promise<Response> {
    try {
      // Menentukan batas awal tanggal hari ini (pukul 00:00:00)
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Menentukan batas awal besok hari
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Mengambil daftar seluruh user_id pegawai aktif
      const activeEmployees = await prisma.employees.findMany({
        where: { is_active: true, user_id: { notIn: ['1'] } },
        select: { user_id: true }
      });

      // Filter untuk membuang ID khusus testing (ID 5, 6, 7) agar tidak mengacaukan statistik dashboard
      const activeUserIds = activeEmployees
        .map((e) => e.user_id)
        .filter((id) => !['1'].includes(id));

      // Mengambil data log kehadiran hari ini untuk seluruh pegawai yang tidak dihapus dan bukan ID 1
      const todayAttendance = await prisma.attendance.findMany({
        where: {
          user_id: { not: '1' }, // Tetap blokir ID 1
          tanggal: {
            gte: today,
            lt: tomorrow,
          },
          is_deleted: false,
        },
      });

      // Menyusun objek statistik hari ini
      const stats: Record<string, any> = {
        today: {
          total_attendance: todayAttendance.length, // Total scan absensi hari ini
          // Menghitung jumlah pegawai unik yang melakukan absensi hari ini
          unique_employees: new Set(todayAttendance.map((a) => a.user_id)).size,
          hadir: todayAttendance.filter((a) => a.jam_masuk !== null).length, // Jumlah terisi jam masuk
          terlambat: todayAttendance.filter((a) => a.status === 'TERLAMBAT').length, // Jumlah terlambat
          dosen: todayAttendance.filter((a) => a.jabatan === 'DOSEN').length, // Jumlah dosen absen hari ini
          karyawan: todayAttendance.filter((a) => (a.jabatan === 'KARYAWAN' || !a.jabatan)).length, // Termasuk default
        },
      };

      // Mengambil hitungan total dosen aktif, karyawan aktif, dan perangkat sidik jari yang aktif
      const [dosenCount, karyawanCount, deviceCount] = await Promise.all([
        prisma.employees.count({ where: { jabatan: 'DOSEN', is_active: true, user_id: { notIn: ['1'] } } }),
        prisma.employees.count({ where: { jabatan: 'KARYAWAN', is_active: true, user_id: { notIn: ['1'] } } }),
        prisma.devices.count({ where: { is_active: true } }),
      ]);

      // Menggabungkan ke objek statistik total
      stats['total'] = {
        employees: dosenCount + karyawanCount, // Total seluruh pegawai aktif
        dosen: dosenCount,
        karyawan: karyawanCount,
        devices: deviceCount,
      };

      // Menghitung persentase kehadiran hari ini (jumlah pegawai unik yang hadir dibanding total seluruh pegawai aktif)
      stats['today'].attendance_percentage =
        stats['total'].employees > 0
          ? Math.round((stats['today'].unique_employees / stats['total'].employees) * 100)
          : 0;

      // Menentukan tanggal awal bulan berjalan saat ini dan awal bulan berikutnya
      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const firstDayOfNextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

      // Menghitung total transaksi absensi dalam bulan berjalan saat ini
      const monthlyCount = await prisma.attendance.count({
        where: {
          user_id: { not: '1' },
          tanggal: {
            gte: firstDayOfMonth,
            lt: firstDayOfNextMonth,
          },
          is_deleted: false,
        },
      });

      stats['monthly'] = {
        total_attendance: monthlyCount,
        month: today.getMonth() + 1,
        year: today.getFullYear(),
      };

      // Mengambil SEMUA log absensi hari ini (dari pagi sampai malam) untuk feed dashboard, tanpa batasan (take dihapus)
      const recentAttendance = await prisma.attendance.findMany({
        where: {
          user_id: { not: '1' },
          is_deleted: false,
          tanggal: {
            gte: today,
            lt: tomorrow,
          },
        },
        orderBy: [
          { jam_masuk: 'desc' },
          { created_at: 'desc' }
        ],
      });

      return successResponse(
        res,
        {
          statistics: stats,
          recent_attendance: recentAttendance,
          timestamp: new Date().toISOString(),
        },
        'Berhasil mengambil statistik summary dashboard'
      );
    } catch (error) {
      logger.error('Error saat mengambil summary dashboard', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return errorResponse(res, 'Gagal mengambil statistik dashboard', 500);
    }
  }

  /**
   * Mengambil data tren grafik kehadiran harian (biasanya 7 hari terakhir).
   * GET /api/dashboard/trends?days=7
   */
  public static async getTrends(req: Request, res: Response): Promise<Response> {
    try {
      const daysQuery = req.query['days'];
      const days = typeof daysQuery === 'string' ? parseInt(daysQuery) : 7;

      // Menghitung tanggal batas awal pencarian berdasarkan parameter days
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      startDate.setHours(0, 0, 0, 0);

      // Mengambil daftar seluruh user_id pegawai aktif
      const activeEmployees = await prisma.employees.findMany({
        where: { is_active: true, user_id: { notIn: ['1'] } },
        select: { user_id: true }
      });
      const activeUserIds = activeEmployees.map((e) => e.user_id);

      // Query data absensi dalam rentang hari tersebut
      const attendance = await prisma.attendance.findMany({
        where: {
          user_id: { in: activeUserIds },
          tanggal: { gte: startDate },
          is_deleted: false,
        },
        orderBy: { tanggal: 'asc' }, // Urutkan kronologis dari tanggal terlama ke terbaru
      });

      // Mengelompokkan data absensi per tanggal (format YYYY-MM-DD)
      const dailyStats: Record<string, DailyStat> = {};

      attendance.forEach((record) => {
        const day = record.tanggal.toISOString().split('T')[0];
        if (!day) return;
        if (!dailyStats[day]) {
          dailyStats[day] = {
            date: day,
            total: 0,
            hadir: 0,
            terlambat: 0,
            dosen: 0,
            karyawan: 0,
          };
        }

        const stat = dailyStats[day];
        if (stat) {
          stat.total++; // Tambah total scan
          if (record.jam_masuk) stat.hadir++; // Tambah hadir jika jam masuk ada
          if (record.status === 'TERLAMBAT') stat.terlambat++; // Tambah terlambat
          if (record.jabatan === 'DOSEN') stat.dosen++;
          if (record.jabatan === 'KARYAWAN') stat.karyawan++;
        }
      });

      const trends = Object.values(dailyStats);

      return successResponse(
        res,
        {
          trends,
          period: {
            start_date: startDate.toISOString().split('T')[0],
            end_date: new Date().toISOString().split('T')[0],
            days,
          },
        },
        'Berhasil mengambil grafik tren kehadiran'
      );
    } catch (error) {
      logger.error('Error saat mengambil tren kehadiran dashboard', {
        error: error instanceof Error ? error.message : String(error),
      });
      return errorResponse(res, 'Gagal mengambil data tren kehadiran', 500);
    }
  }
}
export default DashboardController;
