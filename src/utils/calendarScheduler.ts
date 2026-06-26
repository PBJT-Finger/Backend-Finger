/**
 * src/utils/calendarScheduler.ts
 *
 * Mendefinisikan shift jam kerja (Pagi & Siang) dan mengimplementasikan perhitungan
 * kalender yang aman dari zona waktu (timezone-safe) untuk menangani tahun kabisat (2026-2088)
 * serta verifikasi jadwal bulanan tanpa kesalahan offset indeks (off-by-one errors).
 */

import logger from './logger'; // Logger internal aplikasi

// ─── KONSTANTA & DEFINISI SHIFT JAM KERJA ────────────────────────────────────

export const SHIFT_NAMES = {
  MORNING: 'MORNING',
  AFTERNOON: 'AFTERNOON',
} as const;

export type ShiftName = (typeof SHIFT_NAMES)[keyof typeof SHIFT_NAMES];

export interface ShiftTimeWindow {
  arrivalStart: string; // Waktu mulai scan masuk (format HH:MM:SS)
  arrivalEnd: string; // Batas akhir scan masuk (format HH:MM:SS)
  departureStart: string; // Batas minimal scan pulang (format HH:MM:SS)
  departureEnd: string; // Batas maksimal scan pulang (format HH:MM:SS)
}

// Konfigurasi jam scan untuk masing-masing shift jam kerja
export const SHIFT_SCHEDULES: Record<ShiftName, ShiftTimeWindow> = {
  MORNING: {
    arrivalStart: '07:00:00',
    arrivalEnd: '08:00:00',
    departureStart: '16:00:00',
    departureEnd: '17:00:00',
  },
  AFTERNOON: {
    arrivalStart: '13:00:00',
    arrivalEnd: '14:00:00',
    departureStart: '21:00:00',
    departureEnd: '22:00:00',
  },
};

export interface ShiftScheduleDay {
  dateString: string; // Tanggal berformat YYYY-MM-DD
  dayOfWeek: number; // Indeks hari: 0 = Minggu, 1 = Senin, ... 6 = Sabtu
  dayName: string; // Nama hari dalam Bahasa Indonesia
  isWorkingDay: boolean; // Menandakan hari kerja efektif
  shift: ShiftTimeWindow;
}

// ─── LOGIKA KALENDER (TAHUN KABISAT 2026 - 2088) ──────────────────────────────

/**
 * Memvalidasi apakah tahun merupakan tahun kabisat (Leap Year).
 * Habis dibagi 4, tetapi jika habis dibagi 100, harus juga habis dibagi 400.
 */
export function isLeapYear(year: number): boolean {
  if (year < 2026 || year > 2088) {
    logger.warn(`isLeapYear: Tahun ${year} di luar rentang analisis 2026-2088.`);
  }
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Mengembalikan jumlah hari dalam satu tahun (366 hari jika kabisat, 365 jika tidak).
 */
export function getDaysInYear(year: number): number {
  return isLeapYear(year) ? 366 : 365;
}

/**
 * Mengembalikan jumlah hari dalam suatu bulan (1-indexed: 1 = Januari, 12 = Desember).
 */
export function getDaysInMonth(year: number, month: number): number {
  if (month < 1 || month > 12) {
    throw new Error(`Bulan tidak valid: ${month}. Harus berada di antara 1 sampai 12.`);
  }

  const daysMap: Record<number, number> = {
    1: 31, // Januari
    2: isLeapYear(year) ? 29 : 28, // Februari (memperhitungkan tahun kabisat)
    3: 31, // Maret
    4: 30, // April
    5: 31, // Mei
    6: 30, // Juni
    7: 31, // Juli
    8: 31, // Agustus
    9: 30, // September
    10: 31, // Oktober
    11: 30, // November
    12: 31, // Desember
  };

  const days = daysMap[month];
  if (days === undefined) {
    throw new Error(`Gagal menghitung jumlah hari pada bulan ${month} untuk tahun ${year}`);
  }
  return days;
}

// ─── PERHITUNGAN BATAS ZONA WAKTU AMAN ────────────────────────────────────────

export interface YearMonth {
  year: number;
  month: number;
}

/**
 * Mundur satu bulan secara aman (menggulung balik Januari ke Desember tahun sebelumnya).
 */
export function getPreviousMonth(year: number, month: number): YearMonth {
  if (month === 1) {
    return { year: year - 1, month: 12 };
  }
  return { year, month: month - 1 };
}

/**
 * Maju satu bulan secara aman (menggulung maju Desember ke Januari tahun berikutnya).
 */
export function getNextMonth(year: number, month: number): YearMonth {
  if (month === 12) {
    return { year: year + 1, month: 1 };
  }
  return { year, month: month + 1 };
}

/**
 * Memformat objek Date ke format string YYYY-MM-DD sesuai zona waktu lokal.
 * Mencegah offset zona waktu negatif yang menggeser tanggal ke hari sebelumnya.
 */
export function formatLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Mengambil batas awal tanggal (00:00:00) dan batas akhir tanggal (23:59:59)
 * untuk suatu bulan secara aman berdasarkan zona waktu lokal.
 */
export function getLocalMonthBoundaries(year: number, month: number): { start: Date; end: Date } {
  // Tanggal 1 pada jam 00:00:00.000 lokal
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);

  // Tanggal terakhir bulan tersebut pada jam 23:59:59.999 lokal
  const totalDays = getDaysInMonth(year, month);
  const end = new Date(year, month - 1, totalDays, 23, 59, 59, 999);

  return { start, end };
}

// ─── GENERASI JADWAL & VERIFIKASI LOG ABSENSI ─────────────────────────────────

const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

export interface VerifyAttendanceInput {
  scanTime: Date;
  shiftName: ShiftName;
}

export interface VerificationResult {
  isWithinArrivalWindow: boolean;
  isWithinDepartureWindow: boolean;
  isLate: boolean;
  isEarlyDeparture: boolean;
  minutesLate: number;
  minutesEarlyDeparture: number;
}

/**
 * Menghasilkan susunan tabel kalender jadwal kerja bulanan.
 * Secara default mengecualikan hari Sabtu (6) dan Minggu (0) sebagai hari kerja.
 */
export function generateMonthlySchedule(
  year: number,
  month: number,
  shiftName: ShiftName,
  excludeDays: number[] = [0, 6] // Default libur Sabtu dan Minggu
): ShiftScheduleDay[] {
  const totalDays = getDaysInMonth(year, month);
  const schedule: ShiftScheduleDay[] = [];
  const shift = SHIFT_SCHEDULES[shiftName];

  for (let day = 1; day <= totalDays; day++) {
    const dateObj = new Date(year, month - 1, day);
    const dayOfWeek = dateObj.getDay();
    const isWorkingDay = !excludeDays.includes(dayOfWeek);

    const yearStr = String(year);
    const monthStr = String(month).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');

    schedule.push({
      dateString: `${yearStr}-${monthStr}-${dayStr}`,
      dayOfWeek,
      dayName: DAY_NAMES[dayOfWeek] || 'Tidak Diketahui',
      isWorkingDay,
      shift,
    });
  }

  return schedule;
}

/**
 * Memverifikasi waktu scan absensi terhadap target rentang jam shift kerja pegawai.
 */
export function verifyScanAgainstShift(
  scanTime: Date,
  shiftName: ShiftName,
  isArrivalScan: boolean
): VerificationResult {
  const shift = SHIFT_SCHEDULES[shiftName];
  const scanHours = scanTime.getHours();
  const scanMinutes = scanTime.getMinutes();
  const scanSeconds = scanTime.getSeconds();

  const scanTotalSeconds = scanHours * 3600 + scanMinutes * 60 + scanSeconds;

  const parseToSeconds = (timeStr: string): number => {
    const parts = timeStr.split(':');
    const h = parseInt(parts[0] || '0', 10);
    const m = parseInt(parts[1] || '0', 10);
    const s = parseInt(parts[2] || '0', 10);
    return h * 3600 + m * 60 + s;
  };

  const arrivalStartSec = parseToSeconds(shift.arrivalStart);
  const arrivalEndSec = parseToSeconds(shift.arrivalEnd);
  const departureStartSec = parseToSeconds(shift.departureStart);
  const departureEndSec = parseToSeconds(shift.departureEnd);

  let isWithinArrivalWindow = false;
  let isWithinDepartureWindow = false;
  let isLate = false;
  let isEarlyDeparture = false;
  let minutesLate = 0;
  let minutesEarlyDeparture = 0;

  if (isArrivalScan) {
    // Validasi jendela kedatangan (Check-In)
    isWithinArrivalWindow =
      scanTotalSeconds >= arrivalStartSec && scanTotalSeconds <= arrivalEndSec;
    if (scanTotalSeconds > arrivalEndSec) {
      isLate = true; // Terlambat jika melewati batas jam masuk
      minutesLate = Math.ceil((scanTotalSeconds - arrivalEndSec) / 60);
    }
  } else {
    // Validasi jendela kepulangan (Check-Out)
    isWithinDepartureWindow =
      scanTotalSeconds >= departureStartSec && scanTotalSeconds <= departureEndSec;
    if (scanTotalSeconds < departureStartSec) {
      isEarlyDeparture = true; // Pulang cepat jika scan keluar sebelum jam pulang shift
      minutesEarlyDeparture = Math.ceil((departureStartSec - scanTotalSeconds) / 60);
    }
  }

  return {
    isWithinArrivalWindow,
    isWithinDepartureWindow,
    isLate,
    isEarlyDeparture,
    minutesLate,
    minutesEarlyDeparture,
  };
}
