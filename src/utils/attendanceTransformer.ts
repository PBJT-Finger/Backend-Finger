import prisma from '../config/prisma';
import logger from './logger';

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
  totalTerlambat: number;
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
 * Extract time string "HH:MM" from various formats.
 */
export function extractTimeString(timeValue: string | Date | null): string | null {
  if (!timeValue) return null;
  if (typeof timeValue === 'string') {
    const match = timeValue.match(/^(\d{2}):(\d{2})/);
    if (match) {
      // Values are already the correct local time stored in UTC slots.
      // Use getUTC* to avoid double timezone offset.
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
 * Extract date string "YYYY-MM-DD" from various formats
 */
export function extractDateString(dateValue: string | Date | null): string {
  if (!dateValue) return '';
  if (typeof dateValue === 'string') return dateValue.split('T')[0] || '';
  if (dateValue instanceof Date && !isNaN(dateValue.getTime())) {
    // Use getUTC* — dates are stored as UTC-aligned (Date.UTC) in the DB
    const y = dateValue.getUTCFullYear();
    const m = String(dateValue.getUTCMonth() + 1).padStart(2, '0');
    const d = String(dateValue.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return '';
}

/**
 * Convert a TIME value (string or Date) to a UTC Date for comparison.
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
 * Calculate number of working days between two dates (excluding Saturdays, Sundays, and national holidays)
 */
export async function calculateWorkingDays(
  startDate: string | Date,
  endDate: string | Date
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

  // Retrieve holidays within the range from the database
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

  // Keep a set of YYYY-MM-DD formatted holiday date strings
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

    // Exclude Sundays (0), Saturdays (6), and holidays
    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidaySet.has(dateStr)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
}

/**
 * Transform raw attendance records into aggregated dosen data.
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

    const result = Object.values(grouped)
      .map((group) => {
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
    logger.error('Error transforming dosen attendance', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return [];
  }
}

/**
 * Transform raw attendance records into aggregated karyawan data.
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
        lateDates: Set<string>;
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
          lateDates: new Set<string>(),
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
    logger.error('Error transforming karyawan attendance', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return [];
  }
}

// Helper function to format attendance dates (timezone-safe using UTC)
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

// Helper function to format date in Indonesian format (DD/MM/YYYY) — timezone-safe
export function formatDateID(dateString: string | Date | null): string {
  if (!dateString) return '-';

  const dateStr = extractDateString(dateString);
  if (dateStr && dateStr.includes('-')) {
    const parts = dateStr.split('-');
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  return String(dateString);
}
