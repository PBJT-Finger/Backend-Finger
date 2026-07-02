// src/controllers/attendance.controller.ts
// Kontroler ini bertanggung jawab untuk mengelola data kehadiran (attendance),
// termasuk mengambil data rekap kehadiran dosen, karyawan, ringkasan (summary) bulanan,
// menghapus data secara logis (soft delete), memperbarui catatan admin,
// melakukan sinkronisasi dengan mesin fingerprint ZKTeco, serta mengimpor data dari file Excel/CSV.

import { Request, Response } from 'express';
import prisma from '../config/prisma'; // Mengimpor instance Prisma Client untuk akses database
import { successResponse, errorResponse } from '../utils/responseFormatter'; // Util untuk format response API
import logger from '../utils/logger'; // Util untuk mencatat log aplikasi
import { env } from '../config/env'; // Konfigurasi environment variables yang sudah divalidasi
import { ZkDeviceClient } from '../infrastructure/zk-client'; // Klien untuk berkomunikasi dengan mesin sidik jari
import AttendanceImportService from '../services/attendance.import.service'; // Service untuk mengimpor data absensi
import {
  transformDosenAttendance,
  transformKaryawanAttendance,
  calculateWorkingDays,
} from '../utils/attendanceTransformer'; // Fungsi pembantu untuk transformasi data kehadiran

/**
 * Mengubah string tanggal lokal (YYYY-MM-DD) menjadi objek Date UTC.
 * Hal ini penting agar Prisma tidak menggeser tanggal ke belakang akibat perbedaan zona waktu.
 */
function parseLocalDate(d: string | null): Date | null {
  // Jika input null atau kosong, kembalikan null
  if (!d) return null;
  // Pastikan formatnya hanya berupa bagian tanggal saja (tanpa waktu/ISO)
  const str = typeof d === 'string' ? d.split('T')[0] : String(d);
  if (!str) return null;
  // Memisahkan string berdasarkan karakter '-' untuk mengambil tahun, bulan, dan hari
  const parts = str.split('-');
  const y = Number(parts[0] || '0');
  const m = Number(parts[1] || '0');
  const day = Number(parts[2] || '0');
  // Jika ada bagian tanggal yang tidak valid, kembalikan null
  if (!y || !m || !day) return null;
  // Membuat objek Date menggunakan UTC agar waktu diatur tepat pada pukul 00:00:00 UTC
  return new Date(Date.UTC(y, m - 1, day));
}

export class AttendanceController {
  /**
   * Mengambil data rekap kehadiran Dosen.
   * GET /api/attendance/dosen
   */
  public static async getLecturerAttendance(req: Request, res: Response): Promise<Response> {
    try {
      // Mengambil parameter query filter dari request
      const { start_date, end_date, dosen_id, page = 1, limit = 50 } = req.query;

      // Konversi tipe data start_date dan end_date ke string
      const startDateStr = typeof start_date === 'string' ? start_date : null;
      const endDateStr = typeof end_date === 'string' ? end_date : null;

      // [FIX] Mengambil daftar pegawai yang AKTIF dan jabatannya adalah DOSEN.
      // Ini memastikan pengguna yang belum terdaftar di tabel pegawai tidak muncul di rekap dosen.
      const activeDosenEmployees = await prisma.employees.findMany({
        where: { jabatan: 'DOSEN', is_active: true },
        select: { user_id: true, nama: true, jabatan: true },
      });
      // Mengambil seluruh user_id dari dosen yang aktif
      const activeDosenUserIds = activeDosenEmployees.map((e) => e.user_id);
      // Membuat Map untuk pencarian nama/jabatan dosen berdasarkan user_id secara cepat
      const employeeMap = new Map(activeDosenEmployees.map((e) => [e.user_id, e]));

      // Jika tidak ada dosen aktif yang terdaftar di database, langsung kembalikan respon kosong
      if (activeDosenUserIds.length === 0) {
        return successResponse(res, [], 'Tidak ada dosen aktif yang terdaftar.');
      }

      // Menyiapkan kondisi pencarian (where clause) untuk Prisma
      const whereClause: Record<string, any> = {
        jabatan: 'DOSEN',
        is_deleted: false, // Hanya ambil data yang belum dihapus secara logis
        user_id: { in: activeDosenUserIds }, // Filter hanya untuk dosen yang aktif
      };

      // Jika rentang tanggal diisi, tambahkan filter rentang tanggal pada query database
      if (startDateStr && endDateStr) {
        whereClause['tanggal'] = {
          gte: parseLocalDate(startDateStr), // Lebih besar atau sama dengan tanggal mulai
          lte: parseLocalDate(endDateStr),   // Lebih kecil atau sama dengan tanggal akhir
        };
      }

      // Jika spesifik dosen_id dipilih, tambahkan ke filter query
      if (dosen_id) {
        whereClause['user_id'] = dosen_id;
      }

      // Mengambil seluruh data mentah kehadiran dosen dari database (diurutkan berdasarkan tanggal terbaru)
      const attendance = await prisma.attendance.findMany({
        where: whereClause,
        orderBy: [{ tanggal: 'desc' }, { jam_masuk: 'asc' }],
      });

      // Mengambil daftar hari libur nasional dalam rentang tanggal yang dipilih
      const holidayWhere: any = {};
      const startLocalDate = startDateStr ? parseLocalDate(startDateStr) : null;
      const endLocalDate = endDateStr ? parseLocalDate(endDateStr) : null;
      if (startLocalDate || endLocalDate) {
        holidayWhere.tanggal = {};
        if (startLocalDate) holidayWhere.tanggal.gte = startLocalDate;
        if (endLocalDate) holidayWhere.tanggal.lte = endLocalDate;
      }
      const holidays = await prisma.holidays.findMany({
        where: holidayWhere,
        select: { tanggal: true },
      });
      // Menyimpan daftar tanggal libur ke dalam set string dengan format YYYY-MM-DD
      const holidaySet = new Set(
        holidays.map((h) => {
          const t = h.tanggal;
          return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
        })
      );

      // Menghitung jumlah hari kerja efektif (tidak termasuk Sabtu & Minggu) dalam rentang waktu tersebut
      const totalWorkingDays =
        startDateStr && endDateStr ? await calculateWorkingDays(startDateStr, endDateStr) : 0;

      // Memfilter scan yang tidak valid (seperti ID 5, 6, 7) dan mengabaikan absensi salah untuk Aziz (ID 8) pada 3 Juni 2026
      const filteredAttendance = attendance.filter((a) => {
        if (['1', '5', '6', '7'].includes(a.user_id)) return false;
        if (a.user_id === '8') {
          const t = a.tanggal;
          const dateStr =
            typeof (t as any) === 'string'
              ? (t as any).split('T')[0]
              : `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
          if (dateStr === '2026-06-03') return false;
        }
        return true;
      });

      // Mentransformasikan data kehadiran mentah menjadi data rekap teragregasi
      const transformedData = transformDosenAttendance(
        filteredAttendance.map((a) => {
          const emp = employeeMap.get(a.user_id);
          return {
            tanggal: a.tanggal,
            user_id: a.user_id,
            nama: emp?.nama ?? a.nama, // Gunakan nama dari database Pegawai agar akurat
            jabatan: emp?.jabatan ?? a.jabatan,
            jam_masuk: a.jam_masuk,
            jam_keluar: a.jam_keluar,
            status: a.status,
          };
        }),
        startDateStr || undefined,
        endDateStr || undefined,
        totalWorkingDays,
        holidaySet,
        activeDosenEmployees.map((e) => ({ user_id: e.user_id, nama: e.nama }))
      );

      // Menerapkan paginasi pada data hasil transformasi
      const pageNum = parseInt(page as string) || 1;
      const limitNum = parseInt(limit as string) || 50;
      const skip = (pageNum - 1) * limitNum;
      const paginatedData = transformedData.slice(skip, skip + limitNum);

      return successResponse(res, paginatedData, 'Berhasil mengambil rekap kehadiran dosen');
    } catch (error) {
      logger.error('Error saat mengambil rekap kehadiran dosen', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return errorResponse(res, 'Gagal mengambil data kehadiran dosen', 500);
    }
  }

  /**
   * Mengambil data rekap kehadiran Karyawan/Staf.
   * GET /api/attendance/karyawan
   */
  public static async getEmployeeAttendance(req: Request, res: Response): Promise<Response> {
    try {
      // Mengambil parameter query filter dari request
      const { start_date, end_date, karyawan_id, page = 1, limit = 50 } = req.query;

      // Konversi tipe data parameter filter ke string
      const startDateStr = typeof start_date === 'string' ? start_date : null;
      const endDateStr = typeof end_date === 'string' ? end_date : null;

      // [FIX] Mengambil daftar pegawai aktif dengan jabatan KARYAWAN
      const activeKaryawanEmployees = await prisma.employees.findMany({
        where: { jabatan: 'KARYAWAN', is_active: true },
        select: { user_id: true, nama: true, jabatan: true },
      });
      const activeKaryawanUserIds = activeKaryawanEmployees.map((e) => e.user_id);
      const employeeMap = new Map(activeKaryawanEmployees.map((e) => [e.user_id, e]));

      // Jika tidak ada karyawan aktif terdaftar, kembalikan respon kosong
      if (activeKaryawanUserIds.length === 0) {
        return successResponse(res, [], 'Tidak ada karyawan aktif yang terdaftar.');
      }

      // Menyiapkan parameter filter database untuk karyawan
      const whereClause: Record<string, any> = {
        jabatan: 'KARYAWAN',
        is_deleted: false,
        user_id: { in: activeKaryawanUserIds },
      };

      if (startDateStr && endDateStr) {
        whereClause['tanggal'] = {
          gte: parseLocalDate(startDateStr),
          lte: parseLocalDate(endDateStr),
        };
      }

      if (karyawan_id) {
        whereClause['user_id'] = karyawan_id;
      }

      // Mengambil data kehadiran dari database
      const attendance = await prisma.attendance.findMany({
        where: whereClause,
        orderBy: [{ tanggal: 'desc' }, { jam_masuk: 'asc' }],
      });

      // Mengambil data libur nasional
      const holidayWhere: any = {};
      const startLocalDate = startDateStr ? parseLocalDate(startDateStr) : null;
      const endLocalDate = endDateStr ? parseLocalDate(endDateStr) : null;
      if (startLocalDate || endLocalDate) {
        holidayWhere.tanggal = {};
        if (startLocalDate) holidayWhere.tanggal.gte = startLocalDate;
        if (endLocalDate) holidayWhere.tanggal.lte = endLocalDate;
      }
      const holidays = await prisma.holidays.findMany({
        where: holidayWhere,
        select: { tanggal: true },
      });
      const holidaySet = new Set(
        holidays.map((h) => {
          const t = h.tanggal;
          return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
        })
      );

      // Menghitung jumlah hari kerja efektif
      const totalWorkingDays =
        startDateStr && endDateStr ? await calculateWorkingDays(startDateStr, endDateStr) : 0;

      // Filter scan ID tidak valid dan kasus khusus Aziz
      const filteredAttendance = attendance.filter((a) => {
        if (['1', '5', '6', '7'].includes(a.user_id)) return false;
        if (a.user_id === '8') {
          const t = a.tanggal;
          const dateStr =
            typeof (t as any) === 'string'
              ? (t as any).split('T')[0]
              : `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
          if (dateStr === '2026-06-03') return false;
        }
        return true;
      });

      // Transformasi data rekap karyawan menggunakan formatter khusus karyawan
      const transformedData = transformKaryawanAttendance(
        filteredAttendance.map((a) => {
          const emp = employeeMap.get(a.user_id);
          return {
            tanggal: a.tanggal,
            user_id: a.user_id,
            nama: emp?.nama ?? a.nama,
            jabatan: emp?.jabatan ?? a.jabatan,
            jam_masuk: a.jam_masuk,
            jam_keluar: a.jam_keluar,
            status: a.status,
          };
        }),
        startDateStr || undefined,
        endDateStr || undefined,
        totalWorkingDays,
        holidaySet,
        activeKaryawanEmployees.map((e) => ({ user_id: e.user_id, nama: e.nama }))
      );

      // Pagination
      const pageNum = parseInt(page as string) || 1;
      const limitNum = parseInt(limit as string) || 50;
      const skip = (pageNum - 1) * limitNum;
      const paginatedData = transformedData.slice(skip, skip + limitNum);

      return successResponse(res, paginatedData, 'Berhasil mengambil rekap kehadiran karyawan');
    } catch (error) {
      logger.error('Error saat mengambil rekap kehadiran karyawan', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return errorResponse(res, 'Gagal mengambil data kehadiran karyawan', 500);
    }
  }

  /**
   * Mengambil semua data absensi secara umum/generik (digunakan di halaman riwayat absensi log).
   * GET /api/attendance
   */
  public static async getAttendance(req: Request, res: Response): Promise<Response> {
    try {
      const {
        start_date,
        end_date,
        user_id,
        id,
        jabatan,
        status,
        page = 1,
        limit = 50,
      } = req.query;

      const whereClause: Record<string, any> = {
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

      // Menghitung jumlah total data absensi untuk paginasi
      const total = await prisma.attendance.count({ where: whereClause });

      const pageNum = parseInt(page as string) || 1;
      const limitNum = parseInt(limit as string) || 50;
      const skip = (pageNum - 1) * limitNum;

      // Mengambil data log absensi berpaginasi
      const attendance = await prisma.attendance.findMany({
        where: whereClause,
        orderBy: [
          { tanggal: 'desc' },
          { jam_masuk: 'desc' },
          { id: 'desc' },
        ],
        skip: skip,
        take: limitNum,
      });

      // Mengambil daftar pegawai untuk memetakan nama yang paling update secara langsung
      const employees = await prisma.employees.findMany({
        select: { user_id: true, nama: true, jabatan: true, is_active: true },
      });
      const employeeMap = new Map(employees.map((e) => [e.user_id, e]));

      const mappedAttendance = attendance.map((a) => {
        const emp = employeeMap.get(a.user_id);
        return {
          ...a,
          nama: emp?.nama ?? a.nama,
          jabatan: emp?.jabatan ?? a.jabatan,
          is_active: emp?.is_active ?? false,
        };
      });

      return successResponse(
        res,
        {
          data: mappedAttendance,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            total_pages: Math.ceil(total / limitNum),
          },
        },
        'Berhasil mengambil log data kehadiran'
      );
    } catch (error) {
      logger.error('Error saat mengambil data kehadiran', {
        error: error instanceof Error ? error.message : String(error),
      });
      return errorResponse(res, 'Gagal mengambil data log absensi', 500);
    }
  }

  /**
   * Mengambil Ringkasan / Rekapitulasi Statistik Kehadiran Pegawai.
   * Metode internal untuk menghitung persentase kehadiran, keterlambatan, dll.
   */
  public static async getAttendanceSummary(req: Request, res: Response): Promise<Response> {
    try {
      let startDate = req.query['startDate'] || req.query['start_date'];
      let endDate = req.query['endDate'] || req.query['end_date'];
      const { id, user_id, jabatan } = req.query;

      // Jika tidak ada parameter tanggal, default ke rentang awal sampai akhir bulan berjalan saat ini
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
          'Kedua parameter tanggal (start_date dan end_date) harus diisi jika ingin melakukan filter rentang',
          400
        );
      }

      // Menentukan pegawai yang akan dihitung ringkasannya (hanya yang aktif)
      const employeeWhere: Record<string, any> = { is_active: true };
      if (id || user_id) employeeWhere['user_id'] = id || user_id;
      if (jabatan) {
        employeeWhere['jabatan'] = jabatan;
      } else {
        employeeWhere['jabatan'] = { in: ['DOSEN', 'KARYAWAN'] };
      }

      const activeEmployees = await prisma.employees.findMany({
        where: employeeWhere,
        select: { user_id: true, nama: true, jabatan: true },
      });

      if (activeEmployees.length === 0) {
        return successResponse(res, [], 'Tidak ada pegawai aktif yang terdaftar.');
      }

      const activeEmployeeUserIds = activeEmployees.map((e) => e.user_id);
      const employeeMap = new Map(activeEmployees.map((e) => [e.user_id, e]));

      // Struktur objek penampung statistik per pegawai
      const employeeStats: Record<string, any> = {};

      activeEmployees.forEach((u) => {
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

      const whereClause: Record<string, any> = {
        tanggal: {
          gte: parseLocalDate(startDate as string),
          lte: parseLocalDate(endDate as string),
        },
        is_deleted: false,
        user_id: { in: activeEmployeeUserIds },
      };

      // Mengambil libur nasional dalam periode ini
      const holidayWhere: any = {};
      const startLocalDate = parseLocalDate(startDate as string);
      const endLocalDate = parseLocalDate(endDate as string);
      if (startLocalDate || endLocalDate) {
        holidayWhere.tanggal = {};
        if (startLocalDate) holidayWhere.tanggal.gte = startLocalDate;
        if (endLocalDate) holidayWhere.tanggal.lte = endLocalDate;
      }

      const holidays = await prisma.holidays.findMany({
        where: holidayWhere,
        select: { tanggal: true },
      });
      const _holidaySet = new Set(
        holidays.map((h) => {
          const t = h.tanggal;
          return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
        })
      );

      // Mengambil data absensi terurut untuk pemetaan check-in pertama dan check-out terakhir
      const attendance = await prisma.attendance.findMany({
        where: whereClause,
        orderBy: [{ tanggal: 'desc' }, { jam_keluar: 'desc' }, { jam_masuk: 'desc' }],
      });

      // Filter scan tidak valid
      const filteredAttendance = attendance.filter((a) => {
        if (['1', '5', '6', '7'].includes(a.user_id)) return false;
        if (a.user_id === '8') {
          const t = a.tanggal;
          const dateStr =
            typeof (t as any) === 'string'
              ? (t as any).split('T')[0]
              : `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
          if (dateStr === '2026-06-03') return false;
        }
        return true;
      });

      // Mengumpulkan statistik kehadiran
      filteredAttendance.forEach((record) => {
        const key = record.user_id;
        if (!key) return;
        if (!employeeStats[key]) {
          const emp = employeeMap.get(record.user_id);
          employeeStats[key] = {
            user_id: record.user_id,
            nama: emp?.nama ?? record.nama,
            jabatan: emp?.jabatan ?? record.jabatan,
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
              : `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;

          if (dateStr) {
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
              hour = new Date(record.jam_masuk).getUTCHours();
            }
            if (hour >= 0) {
              if (hour >= 6 && hour < 15) stats.hadir_pagi.add(dateStr);
              else if (hour >= 15 && hour <= 22) stats.hadir_malam.add(dateStr);
            }
          }
        }
      });

      // Mengubah objek waktu menjadi string berformat HH:MM
      const formatTimeOnly = (dateTime: Date | string | null): string | null => {
        if (!dateTime) return null;
        if (typeof dateTime === 'string') return dateTime.substring(0, 5);
        const d = new Date(dateTime);
        if (isNaN(d.getTime())) return null;

        const hours = String(d.getUTCHours()).padStart(2, '0');
        const minutes = String(d.getUTCMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
      };

      // Memformat daftar tanggal menjadi string rentang tanggal yang representatif
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

      const totalWorkingDaysInPeriod = await calculateWorkingDays(
        startDate as string,
        endDate as string
      );

      // Memetakan ke bentuk objek final rekap untuk API response
      const summary = Object.values(employeeStats)
        .map((emp) => {
          const attendanceDatesArray = Array.from(emp.attendanceDates as Set<string>).sort();
          const totalHadir = attendanceDatesArray.length;
          const totalHariKerja = totalWorkingDaysInPeriod;
          const tidakHadir = Math.max(0, totalHariKerja - totalHadir);

          return {
            id: emp.user_id,
            nama: emp.nama,
            jabatan: emp.jabatan,
            totalHadir: totalHadir,
            tidakHadir: tidakHadir,
            hadirPagi: emp.hadir_pagi.size,
            hadirMalam: emp.hadir_malam.size,
            totalTerlambat: emp.terlambat_dates ? emp.terlambat_dates.size : 0,
            totalHariKerja: totalHariKerja,
            persentase:
              totalHariKerja > 0
                ? Math.min(100, Math.round((totalHadir / totalHariKerja) * 100))
                : totalHadir > 0
                  ? 100
                  : 0,
            attendanceDates: formatDateRange(attendanceDatesArray),
            lastCheckIn: formatTimeOnly(emp.last_check_in),
            lastCheckOut: formatTimeOnly(emp.last_check_out),
          };
        })
        .map((emp, index) => ({
          ...emp,
          no: index + 1, // Penomoran tabel baris
        }));

      return successResponse(res, summary, 'Berhasil menghitung summary statistik absensi');
    } catch (error) {
      logger.error('Error saat mengambil summary absensi', {
        error: error instanceof Error ? error.message : String(error),
      });
      return errorResponse(res, 'Gagal menghitung ringkasan statistik kehadiran', 500);
    }
  }

  /**
   * Menghapus log absensi secara logis (Soft Delete, is_deleted = true).
   * DELETE /api/attendance/:id
   */
  public static async deleteAttendance(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const attendanceId = parseInt(id || '');

      if (isNaN(attendanceId)) {
        return errorResponse(res, 'ID Absensi tidak valid', 400);
      }

      // Pastikan data yang akan dihapus memang ada di database
      const attendance = await prisma.attendance.findUnique({
        where: { id: attendanceId },
      });

      if (!attendance) {
        return errorResponse(res, 'Data absensi tidak ditemukan', 404);
      }

      // Mengubah field is_deleted menjadi true
      await prisma.attendance.update({
        where: { id: attendanceId },
        data: { is_deleted: true },
      });

      const actorId = (req as any).user?.id ?? 0;
      // Mencatat log audit penghapusan data untuk keamanan
      logger.audit('ATTENDANCE_DELETED', actorId, {
        attendance_id: id,
        user_id: attendance.user_id,
        tanggal: attendance.tanggal,
      });

      return successResponse(res, null, 'Data absensi berhasil dihapus');
    } catch (error) {
      logger.error('Error saat menghapus data absensi', {
        error: error instanceof Error ? error.message : String(error),
      });
      return errorResponse(res, 'Gagal menghapus data absensi', 500);
    }
  }

  /**
   * Memperbarui catatan/alasan dari admin untuk record absensi tertentu.
   * PATCH /api/attendance/:id/notes
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

      // Memperbarui kolom admin_notes di database
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
      logger.error('Error saat memperbarui catatan admin', {
        error: error instanceof Error ? error.message : String(error),
      });
      return errorResponse(res, 'Gagal memperbarui catatan admin', 500);
    }
  }

  /**
   * Mengambil ringkasan data absensi (fungsi jembatan/alias untuk route /summary).
   */
  public static async getSummary(req: Request, res: Response): Promise<Response> {
    try {
      return AttendanceController.getAttendanceSummary(req, res);
    } catch (error) {
      logger.error('Error pada routing getSummary', {
        error: error instanceof Error ? error.message : String(error),
      });
      return errorResponse(res, 'Gagal mengambil ringkasan absensi', 500);
    }
  }

  /**
   * Mengambil laporan bulanan.
   * GET /api/attendance/report/monthly
   */
  public static async getMonthlyReport(req: Request, res: Response): Promise<Response> {
    try {
      const { bulan, tahun } = req.query;

      if (!bulan || !tahun) {
        return errorResponse(res, 'Bulan dan Tahun wajib diisi', 400);
      }

      // Menghitung rentang tanggal mulai hari pertama hingga hari terakhir pada bulan tersebut
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

      // Memasukkan kembali rentang tanggal ke query request
      req.query['start_date'] = startDate;
      req.query['end_date'] = endDate;
      req.query['startDate'] = startDate;
      req.query['endDate'] = endDate;

      logger.info(
        `Memproses pembuatan laporan bulanan untuk periode ${String(bulan)}/${String(tahun)} (${startDate} s.d. ${endDate})`
      );

      // Memanfaatkan method rekap yang sudah ada
      return AttendanceController.getAttendanceSummary(req, res);
    } catch (error) {
      logger.error('Error saat memproses laporan bulanan', {
        error: error instanceof Error ? error.message : String(error),
      });
      return errorResponse(res, 'Gagal memproses laporan bulanan', 500);
    }
  }

  /**
   * Memicu sinkronisasi data absensi secara manual dari perangkat sidik jari ZKTeco.
   * POST /api/attendance/sync-fingerprint
   */
  public static async syncFromFingerprint(req: Request, res: Response): Promise<Response> {
    try {
      const client = ZkDeviceClient.getInstance();
      // Hubungkan ke perangkat sidik jari jika statusnya sedang offline
      if (client.getStatus() === 'offline') {
        await client.start();
      }
      return successResponse(
        res,
        {
          status: client.getStatus(),
          lastSyncCount: client.getLastSyncCount(),
        },
        'Proses sinkronisasi dengan mesin sidik jari berhasil dipicu'
      );
    } catch (error) {
      logger.error('Error sinkronisasi mesin sidik jari:', {
        error: error instanceof Error ? error.message : String(error),
      });
      return errorResponse(
        res,
        `Gagal sinkronisasi data sidik jari: ${error instanceof Error ? error.message : String(error)}`,
        500
      );
    }
  }

  /**
   * Mengambil status terkini konektivitas perangkat sidik jari ZKTeco.
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
          message:
            status === 'online' ? 'Koneksi dengan mesin fingerprint stabil (Online)' : 'Mesin fingerprint terputus atau mencoba menghubungkan (Offline)',
        },
        'Berhasil mengambil status konektivitas mesin sidik jari'
      );
    } catch (error) {
      logger.error('Error saat cek status perangkat:', {
        error: error instanceof Error ? error.message : String(error),
      });
      return errorResponse(
        res,
        `Gagal memeriksa status konektivitas perangkat: ${error instanceof Error ? error.message : String(error)}`,
        500
      );
    }
  }

  /**
   * Mengimpor data log kehadiran dari berkas Excel/CSV.
   * POST /api/attendance/import
   */
  public static async importAttendance(req: Request, res: Response): Promise<Response> {
    try {
      // Memastikan berkas file ada di request
      if (!req.file) {
        return errorResponse(res, 'File tidak ditemukan', 400);
      }

      logger.info('Memproses impor file absensi', {
        filename: req.file.originalname,
        size: req.file.size,
        user: (req as any).user?.id,
      });

      // Menjalankan service pengimpor data absensi
      const result = await AttendanceImportService.processImport(
        req.file.buffer,
        req.file.originalname,
        {
          skipDuplicates: true, // Lewati jika data absensi pada hari & jam tersebut sudah ada
        }
      );

      const actorId = (req as any).user?.id ?? 0;
      // Mencatat log audit proses impor
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

      // Jika seluruh baris dalam file error, anggap sebagai fatal error
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
      logger.error('Error saat impor file absensi:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return errorResponse(
        res,
        `Gagal memproses file import: ${error instanceof Error ? error.message : String(error)}`,
        500
      );
    }
  }
}
export default AttendanceController;
