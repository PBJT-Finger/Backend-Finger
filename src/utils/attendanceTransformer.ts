// src/utils/attendanceTransformer.ts
// Utilitas pembantu untuk mentransformasi dan mengagregasi baris data absensi mentah
// menjadi format data terstruktur siap saji untuk visualisasi dashboard dosen dan karyawan.

import prisma from '../config/prisma'; // Prisma client untuk querying DB
import logger from './logger'; // Logger aplikasi

export interface TransformedDosenRecord {
  id: string;
  user_id: string;
  nama: string;
  totalHadir: number;
  tidakHadir: number;
  totalTerlambat: number;
  totalHariKerja: number;
  persentase: number;
  attendanceDates: string;
  lastCheckIn: string;
  lastCheckOut: string;
}

export interface TransformedKaryawanRecord {
  id: string;
  user_id: string;
  nama: string;
  totalHadir: number;
  tidakHadir: number;
  totalHariKerja: number;
  persentase: number;
  attendanceDates: string;
  lastCheckIn: string;
  lastCheckOut: string;
}

export interface RawAttendanceRecord {
  tanggal: Date | string;
  user_id: string | null;
  nama: string | null;
  jabatan: string | null;
  jam_masuk: Date | string | null;
  jam_keluar: Date | string | null;
  status: string | null;
}

/**
 * Mengekstrak string waktu "HH:MM" secara aman dari berbagai format input (string, Date).
 */
export function extractTimeString(timeValue: string | Date | null): string | null {
  if (!timeValue) return null;
  if (typeof timeValue === 'string') {
    const match = timeValue.match(/^(\d{2}):(\d{2})/);
    if (match) {
      // Menggunakan UTC pad untuk mencegah offset zona waktu ganda
      const h = String(parseInt(match[1] || '0', 10)).padStart(2, '0');
      const m = String(parseInt(match[2] || '0', 10)).padStart(2, '0');
      return `${h}:${m}`;
    }
    return timeValue.substring(0, 5);
  }
  if (timeValue instanceof Date && !isNaN(timeValue.getTime())) {
    const h = String(timeValue.getUTCHours()).padStart(2, '0');
    const m = String(timeValue.getUTCMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }
  return String(timeValue).substring(0, 5);
}

/**
 * Mengekstrak string tanggal "YYYY-MM-DD" secara aman dari berbagai format (string, Date).
 */
export function extractDateString(dateValue: string | Date | null): string {
  if (!dateValue) return '';
  if (typeof dateValue === 'string') return dateValue.split('T')[0] || '';
  if (dateValue instanceof Date && !isNaN(dateValue.getTime())) {
    // Tanggal disimpan menggunakan UTC-aligned (Date.UTC) di database, ambil komponen UTC
    const y = dateValue.getUTCFullYear();
    const m = String(dateValue.getUTCMonth() + 1).padStart(2, '0');
    const d = String(dateValue.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return '';
}

/**
 * Mengonversi nilai waktu (string TIME atau objek Date) menjadi objek Date UTC untuk keperluan komparasi aritmatika.
 */
export function toUTCDate(timeValue: string | Date | null): Date | null {
  if (!timeValue) return null;
  if (timeValue instanceof Date) return timeValue;
  if (typeof timeValue === 'string') {
    const match = timeValue.match(/^(\d{2}):(\d{2})(:(\d{2}))?/);
    if (match) {
      return new Date(
        Date.UTC(
          1970,
          0,
          1,
          parseInt(match[1] || '0', 10),
          parseInt(match[2] || '0', 10),
          parseInt(match[4] || '0', 10)
        )
      );
    }
  }
  return null;
}

/**
 * Menghitung jumlah hari kerja efektif di antara dua tanggal.
 * Mengecualikan akhir pekan (Sabtu-Minggu) dan libur nasional yang terdaftar di database.
 */
export async function calculateWorkingDays(
  startDate: string | Date,
  endDate: string | Date,
  role?: string
): Promise<number> {
  if (!startDate || !endDate) {
    return 0;
  }

  const parseLocal = (d: string | Date): Date | null => {
    if (!d) return null;
    const str = typeof d === 'string' ? d.split('T')[0] : String(d);
    if (!str) return null;
    const parts = str.split('-');
    const y = Number(parts[0] || '0');
    const m = Number(parts[1] || '0');
    const day = Number(parts[2] || '0');
    return new Date(y, m - 1, day);
  };

  const start = parseLocal(startDate);
  const end = parseLocal(endDate);
  if (!start || !end) return 0;

  // Ambil daftar hari libur nasional dari database dalam rentang tersebut
  const holidays = await prisma.holidays.findMany({
    where: {
      tanggal: {
        gte: start,
        lte: end,
      },
    },
    select: {
      tanggal: true,
    },
  });

  // Buat set string tanggal libur (YYYY-MM-DD) untuk pencarian instan O(1)
  const holidaySet = new Set(
    holidays.map((h) => {
      const t = h.tanggal;
      return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
    })
  );

  let count = 0;
  const current = new Date(start);

  while (current <= end) {
    const dayOfWeek = current.getDay();
    const dateStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;

    const isHoliday = holidaySet.has(dateStr);
    const isSunday = dayOfWeek === 0;
    const isSaturday = dayOfWeek === 6;

    let isWorkingDay = false;
    if (!isHoliday && !isSunday) {
      if (role === 'KARYAWAN') {
        // Karyawan masuk hari Sabtu
        isWorkingDay = true;
      } else {
        // Dosen (atau default) libur hari Sabtu
        if (!isSaturday) isWorkingDay = true;
      }
    }

    if (isWorkingDay) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
}

/**
 * Mentransformasi dan mengagregasi catatan log absensi mentah menjadi rekap DOSEN.
 */
export function transformDosenAttendance(
  attendanceRecords: RawAttendanceRecord[],
  _startDate?: string | Date,
  _endDate?: string | Date,
  totalWorkingDays?: number,
  _holidaySet?: Set<string>,
  activeEmployees?: Array<{ user_id: string; nama: string }>
): TransformedDosenRecord[] {
  try {
    if ((!attendanceRecords || attendanceRecords.length === 0) && (!activeEmployees || activeEmployees.length === 0)) {
      return [];
    }

    const grouped: Record<
      string,
      {
        user_id: string;
        nama: string;
        attendanceDates: Set<string>;
        lateDates: Set<string>;
        lastCheckInUTC: Date | null;
        lastCheckOutUTC: Date | null;
      }
    > = {};

    // Isi template inisialisasi awal untuk semua pegawai aktif agar pegawai tanpa log absensi tetap muncul (status mangkir)
    if (activeEmployees) {
      activeEmployees.forEach((emp) => {
        grouped[emp.user_id] = {
          user_id: emp.user_id,
          nama: emp.nama || 'Unknown',
          attendanceDates: new Set<string>(),
          lateDates: new Set<string>(),
          lastCheckInUTC: null,
          lastCheckOutUTC: null,
        };
      });
    }

    // Kelompokkan log absen berdasarkan user_id
    if (attendanceRecords) {
      attendanceRecords.forEach((record) => {
        const user_id = record.user_id;
        if (!user_id) return;

        if (!grouped[user_id]) {
          grouped[user_id] = {
            user_id: user_id,
            nama: record.nama || 'Unknown',
            attendanceDates: new Set<string>(),
            lateDates: new Set<string>(),
            lastCheckInUTC: null,
            lastCheckOutUTC: null,
          };
        }

        const group = grouped[user_id];
        if (group) {
          const dateStr = extractDateString(record.tanggal);
          if (dateStr) {
            group.attendanceDates.add(dateStr);
            if (record.status === 'TERLAMBAT') {
              group.lateDates.add(dateStr);
            }
          }

          if (record.jam_masuk) {
            const checkInUTC = toUTCDate(record.jam_masuk);
            if (checkInUTC && (!group.lastCheckInUTC || checkInUTC > group.lastCheckInUTC)) {
              group.lastCheckInUTC = checkInUTC;
            }
          }

          if (record.jam_keluar) {
            const checkOutUTC = toUTCDate(record.jam_keluar);
            if (checkOutUTC && (!group.lastCheckOutUTC || checkOutUTC > group.lastCheckOutUTC)) {
              group.lastCheckOutUTC = checkOutUTC;
            }
          }
        }
      });
    }

    // Kalkulasi rekapitulasi data agregat
    const result = Object.values(grouped).map((group) => {
      const totalHadir = group.attendanceDates.size;
      const totalHariKerja = totalWorkingDays !== undefined ? totalWorkingDays : totalHadir;

      return {
        id: group.user_id,
        user_id: group.user_id,
        nama: group.nama,
        totalHadir,
        tidakHadir: Math.max(0, totalHariKerja - totalHadir),
        totalTerlambat: group.lateDates.size,
        totalHariKerja,
        persentase:
          totalHariKerja > 0
            ? Math.min(100, Math.round((totalHadir / totalHariKerja) * 100))
            : totalHadir > 0
              ? 100
              : 0,
        attendanceDates: formatAttendanceDates(group.attendanceDates),
        lastCheckIn: group.lastCheckInUTC
          ? extractTimeString(group.lastCheckInUTC) || 'Belum ada data'
          : 'Belum ada data',
        lastCheckOut: group.lastCheckOutUTC
          ? extractTimeString(group.lastCheckOutUTC) || 'Belum ada data'
          : 'Belum ada data',
      };
    });

    return result;
  } catch (error) {
    logger.error('Gagal mentransformasi absensi dosen', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return [];
  }
}

/**
 * Mentransformasi dan mengagregasi catatan log absensi mentah menjadi rekap KARYAWAN.
 */
export function transformKaryawanAttendance(
  attendanceRecords: RawAttendanceRecord[],
  _startDate?: string | Date,
  _endDate?: string | Date,
  totalWorkingDays?: number,
  _holidaySet?: Set<string>,
  activeEmployees?: Array<{ user_id: string; nama: string }>
): TransformedKaryawanRecord[] {
  try {
    if ((!attendanceRecords || attendanceRecords.length === 0) && (!activeEmployees || activeEmployees.length === 0)) {
      return [];
    }

    const grouped: Record<
      string,
      {
        user_id: string;
        nama: string;
        attendanceDates: Set<string>;
        lastCheckInUTC: Date | null;
        lastCheckOutUTC: Date | null;
      }
    > = {};

    if (activeEmployees) {
      activeEmployees.forEach((emp) => {
        grouped[emp.user_id] = {
          user_id: emp.user_id,
          nama: emp.nama || 'Unknown',
          attendanceDates: new Set<string>(),
          lastCheckInUTC: null,
          lastCheckOutUTC: null,
        };
      });
    }

    if (attendanceRecords) {
      attendanceRecords.forEach((record) => {
        const user_id = record.user_id;
        if (!user_id) return;

        if (!grouped[user_id]) {
          grouped[user_id] = {
            user_id: user_id,
            nama: record.nama || 'Unknown',
            attendanceDates: new Set<string>(),
            lastCheckInUTC: null,
            lastCheckOutUTC: null,
          };
        }

        const group = grouped[user_id];
        if (group) {
          const dateStr = extractDateString(record.tanggal);
          if (dateStr) {
            group.attendanceDates.add(dateStr);
          }

          if (record.jam_masuk) {
            const checkInUTC = toUTCDate(record.jam_masuk);
            if (checkInUTC && (!group.lastCheckInUTC || checkInUTC > group.lastCheckInUTC)) {
              group.lastCheckInUTC = checkInUTC;
            }
          }

          if (record.jam_keluar) {
            const checkOutUTC = toUTCDate(record.jam_keluar);
            if (checkOutUTC && (!group.lastCheckOutUTC || checkOutUTC > group.lastCheckOutUTC)) {
              group.lastCheckOutUTC = checkOutUTC;
            }
          }
        }
      });
    }

    const result = Object.values(grouped).map((group) => {
      const totalHadir = group.attendanceDates.size;
      const totalHariKerja = totalWorkingDays !== undefined ? totalWorkingDays : totalHadir;

      return {
        id: group.user_id,
        user_id: group.user_id,
        nama: group.nama,
        totalHadir,
        tidakHadir: Math.max(0, totalHariKerja - totalHadir),
        totalHariKerja,
        persentase:
          totalHariKerja > 0
            ? Math.min(100, Math.round((totalHadir / totalHariKerja) * 100))
            : totalHadir > 0
              ? 100
              : 0,
        attendanceDates: formatAttendanceDates(group.attendanceDates),
        lastCheckIn: group.lastCheckInUTC
          ? extractTimeString(group.lastCheckInUTC) || 'Belum ada data'
          : 'Belum ada data',
        lastCheckOut: group.lastCheckOutUTC
          ? extractTimeString(group.lastCheckOutUTC) || 'Belum ada data'
          : 'Belum ada data',
      };
    });

    return result;
  } catch (error) {
    logger.error('Gagal mentransformasi absensi karyawan', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return [];
  }
}

/**
 * Format rentang tanggal kehadiran menjadi string yang ramah dibaca (contoh: "1 - 15 Jun 2026").
 */
export function formatAttendanceDates(datesSet: Set<string>): string {
  if (!datesSet || datesSet.size === 0) return 'Belum ada data';

  const dates = Array.from(datesSet).sort();
  const monthNames = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'Mei',
    'Jun',
    'Jul',
    'Agu',
    'Sep',
    'Okt',
    'Nov',
    'Des',
  ];

  const parseDateParts = (dateStr: string): { year: number; month: number; day: number } => {
    const parts = dateStr.split('-');
    return {
      year: parseInt(parts[0] || '0', 10),
      month: parseInt(parts[1] || '1', 10) - 1,
      day: parseInt(parts[2] || '0', 10),
    };
  };

  const datesFirst = dates[0];
  const datesLast = dates[dates.length - 1];

  if (dates.length === 1 && datesFirst) {
    const d = parseDateParts(datesFirst);
    const month = monthNames[d.month];
    return `${d.day} ${month || ''} ${d.year}`;
  }

  if (datesFirst && datesLast) {
    const first = parseDateParts(datesFirst);
    const last = parseDateParts(datesLast);

    const firstMonth = monthNames[first.month];
    const lastMonth = monthNames[last.month];

    if (first.month === last.month && first.year === last.year) {
      return `${first.day} - ${last.day} ${lastMonth || ''} ${last.year}`;
    }

    return `${first.day} ${firstMonth || ''} - ${last.day} ${lastMonth || ''} ${last.year}`;
  }

  return 'Belum ada data';
}

/**
 * Memformat string tanggal ke format standar Indonesia (DD/MM/YYYY) secara timezone-safe.
 */
export function formatDateID(dateString: string | Date | null): string {
  if (!dateString) return '-';

  const dateStr = extractDateString(dateString);
  if (dateStr && dateStr.includes('-')) {
    const parts = dateStr.split('-');
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  return String(dateString);
}
