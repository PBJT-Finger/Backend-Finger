// src/services/attendance.service.ts
// Layanan (Service) untuk mengolah data kehadiran (attendance),
// seperti memproduksi data ringkasan kehadiran (total hadir, terlambat, persentase kehadiran)
// untuk seluruh pegawai, mendeteksi status terlambat, serta menarik detail log absensi per individu.

import prisma from '../config/prisma'; // Prisma client untuk melakukan query database
import logger from '../utils/logger'; // Logger internal aplikasi

export interface AttendanceSummaryFilters {
  startDate?: string;
  endDate?: string;
  user_id?: string;
  jabatan?: 'DOSEN' | 'KARYAWAN';
}

export interface EmployeeSummary {
  user_id: string;
  nama: string;
  jabatan: string;
  shift: string | null;
  total_working_days: number; // Target hari kerja efektif dalam periode
  total_hadir: number; // Total kehadiran terdeteksi
  total_terlambat: number; // Total keterlambatan (khusus karyawan reguler)
  persentase_kehadiran: number; // Persentase kehadiran (%)
}

export class AttendanceService {
  /**
   * Mengambil data ringkasan kehadiran pegawai (Summary/Rekap) berdasarkan filter.
   * Digunakan sebagai endpoint rekap absensi di dashboard admin.
   */
  public static async getAttendanceSummary(
    filters: AttendanceSummaryFilters = {}
  ): Promise<EmployeeSummary[]> {
    try {
      const { startDate, endDate, user_id, jabatan } = filters;

      const whereClause: Record<string, unknown> = {
        is_active: true, // Hanya pegawai yang aktif
      };

      // Filter berdasarkan NIDN/NIP (user_id) jika disediakan
      if (user_id) {
        whereClause['user_id'] = user_id;
      }

      // Filter berdasarkan jabatan (Dosen atau Karyawan) jika disediakan
      if (jabatan) {
        whereClause['jabatan'] = jabatan;
      }

      // Tarik daftar pegawai dari database yang cocok dengan filter
      const employees = await prisma.employees.findMany({
        where: whereClause,
        include: {
          shifts: true, // Sertakan relasi shift jam kerjanya
        },
      });

      if (!startDate || !endDate) {
        throw new Error('Tanggal mulai dan tanggal akhir wajib diisi');
      }

      // Hitung total target hari kerja efektif (mengabaikan Sabtu & Minggu)
      const totalWorkingDays = this.calculateWorkingDaysWeekendOnly(
        new Date(startDate),
        new Date(endDate)
      );

      // Ambil summary rekap kehadiran untuk masing-masing pegawai secara paralel
      const summaries = await Promise.all(
        employees.map((employee) =>
          this.getEmployeeSummary(
            employee,
            new Date(startDate),
            new Date(endDate),
            totalWorkingDays
          )
        )
      );

      // Kembalikan daftar summary yang bernilai valid (tidak null)
      return summaries.filter((summary): summary is EmployeeSummary => summary !== null);
    } catch (error) {
      logger.error('Error saat mengambil summary absensi:', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Menghitung dan menghasilkan ringkasan (summary) kehadiran untuk satu pegawai.
   */
  public static async getEmployeeSummary(
    employee: any,
    startDate: Date,
    endDate: Date,
    totalWorkingDays: number
  ): Promise<EmployeeSummary | null> {
    try {
      // Mengambil seluruh log absensi pegawai yang bersangkutan dalam periode tanggal target
      const attendanceRecords = await prisma.attendance.findMany({
        where: {
          user_id: employee.user_id,
          tanggal: {
            gte: startDate,
            lte: endDate,
          },
          is_deleted: false, // Log yang tidak dihapus
        },
        orderBy: {
          tanggal: 'asc',
        },
      });

      // Menyiapkan struktur objek data ringkasan kehadiran awal
      const stats: EmployeeSummary = {
        user_id: employee.user_id,
        nama: employee.nama,
        jabatan: employee.jabatan,
        shift: employee.shifts ? employee.shifts.nama_shift : null,
        total_working_days: totalWorkingDays,
        total_hadir: 0,
        total_terlambat: 0,
        persentase_kehadiran: 0,
      };

      // Melakukan kalkulasi total hadir & terlambat dari log absensi
      attendanceRecords.forEach((record) => {
        if (record.jam_masuk) {
          stats.total_hadir++; // Tambah total hadir jika ada scan masuk
        }

        // Penghitungan telat hanya berlaku bagi KARYAWAN reguler (tidak berlaku untuk DOSEN)
        if (employee.jabatan === 'KARYAWAN' && record.status === 'TERLAMBAT') {
          stats.total_terlambat++;
        }
      });

      // Hitung persentase kehadiran pegawai (dibulatkan)
      stats.persentase_kehadiran =
        totalWorkingDays > 0 ? Math.round((stats.total_hadir / totalWorkingDays) * 100) : 0;

      return stats;
    } catch (error) {
      logger.error(`Error saat mengambil summary pegawai dengan ID ${String(employee.user_id)}:`, {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Memvalidasi apakah waktu absensi masuk tergolong terlambat dibanding jam shift kerja.
   * Catatan: Logika telat utama saat ini sudah tersimpan langsung di database lewat field status.
   */
  public static isLate(
    waktuAbsensi: string | null,
    shiftTime: string | null,
    toleransiMenit = 0
  ): boolean {
    if (!waktuAbsensi || !shiftTime) return false;

    // Membandingkan jam scan dengan jam shift + toleransi keterlambatan
    const waktu = new Date(`1970-01-01T${waktuAbsensi}`);
    const shift = new Date(`1970-01-01T${shiftTime}`);

    shift.setMinutes(shift.getMinutes() + toleransiMenit); // Menambahkan toleransi menit ke jam shift

    return waktu > shift;
  }

  /**
   * Mengambil detail log absensi harian untuk satu orang pegawai dalam rentang tanggal tertentu.
   */
  public static async getEmployeeAttendanceDetail(
    user_id: string,
    startDate: string,
    endDate: string
  ): Promise<any[]> {
    try {
      const attendance = await prisma.attendance.findMany({
        where: {
          user_id: user_id,
          tanggal: {
            gte: new Date(startDate),
            lte: new Date(endDate),
          },
          is_deleted: false,
        },
        orderBy: {
          tanggal: 'desc', // Mengurutkan dari hari terbaru
        },
      });

      return attendance;
    } catch (error) {
      logger.error(`Error saat mengambil detail absensi pegawai dengan ID ${user_id}:`, {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Menghitung total hari kerja efektif dalam suatu periode dengan mengecualikan akhir pekan (Sabtu & Minggu).
   */
  public static calculateWorkingDaysWeekendOnly(startDate: Date, endDate: Date): number {
    let workingDays = 0;
    const currentDate = new Date(startDate);

    // Lakukan perulangan hari dari tanggal mulai hingga tanggal selesai
    while (currentDate <= endDate) {
      const dayOfWeek = currentDate.getDay();

      // Mengecualikan hari Minggu (0) dan Sabtu (6)
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        workingDays++;
      }

      currentDate.setDate(currentDate.getDate() + 1); // Melangkah ke hari berikutnya
    }

    return workingDays;
  }
}
export default AttendanceService;
