/**
 * src/utils/calendarScheduler.ts
 *
 * This module defines shifts (Morning & Afternoon) and implements robust, timezone-safe
 * calendar calculations to handle leap years (2026-2088) and monthly schedule verifications
 * without off-by-one errors, especially on the first day of the month.
 */

import logger from './logger';

// ─── CONSTANTS & SHIFT DEFINITIONS ───────────────────────────────────────────

export const SHIFT_NAMES = {
  MORNING: 'MORNING',
  AFTERNOON: 'AFTERNOON',
} as const;

export type ShiftName = (typeof SHIFT_NAMES)[keyof typeof SHIFT_NAMES];

export interface ShiftTimeWindow {
  arrivalStart: string; // HH:MM:SS format
  arrivalEnd: string; // HH:MM:SS format
  departureStart: string; // HH:MM:SS format
  departureEnd: string; // HH:MM:SS format
}

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
  dateString: string; // YYYY-MM-DD
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, ... 6 = Saturday
  dayName: string;
  isWorkingDay: boolean;
  shift: ShiftTimeWindow;
}

// ─── CALENDAR MATH (LEAP YEARS 2026 - 2088) ───────────────────────────────────

/**
 * Determines if a year is a leap year.
 * Divisible by 4, but if divisible by 100, must also be divisible by 400.
 */
export function isLeapYear(year: number): boolean {
  if (year < 2026 || year > 2088) {
    logger.warn(`isLeapYear: Year ${year} is outside the analyzed window of 2026-2088.`);
  }
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Returns the exact number of days in a year.
 * Aligning with Gregorian calendar rules: 366 days for leap years, 365 for non-leap.
 */
export function getDaysInYear(year: number): number {
  return isLeapYear(year) ? 366 : 365;
}

/**
 * Returns the number of days in a month.
 * Month parameter is 1-indexed (1 = January, 12 = December).
 */
export function getDaysInMonth(year: number, month: number): number {
  if (month < 1 || month > 12) {
    throw new Error(`Invalid month: ${month}. Must be between 1 and 12.`);
  }

  const daysMap: Record<number, number> = {
    1: 31, // January
    2: isLeapYear(year) ? 29 : 28, // February (leap year sensitive)
    3: 31, // March
    4: 30, // April
    5: 31, // May
    6: 30, // June
    7: 31, // July
    8: 31, // August
    9: 30, // September
    10: 31, // October
    11: 30, // November
    12: 31, // December
  };

  const days = daysMap[month];
  if (days === undefined) {
    throw new Error(`Unexpected error resolving days in month ${month} for year ${year}`);
  }
  return days;
}

// ─── TIMEZONE-SAFE BOUNDARY CALCULATIONS ──────────────────────────────────────

export interface YearMonth {
  year: number;
  month: number; // 1-indexed (1-12)
}

/**
 * Safe subtraction of one month.
 * Solves the first day of the month transition where subtracting one month
 * from January (1) must roll back to December (12) of the previous year.
 */
export function getPreviousMonth(year: number, month: number): YearMonth {
  if (month === 1) {
    return { year: year - 1, month: 12 };
  }
  return { year, month: month - 1 };
}

/**
 * Safe addition of one month.
 */
export function getNextMonth(year: number, month: number): YearMonth {
  if (month === 12) {
    return { year: year + 1, month: 1 };
  }
  return { year, month: month + 1 };
}

/**
 * Formats a Date object to YYYY-MM-DD in the local timezone context.
 * Avoids UTC timezone shifts where 00:00:00 local time on the 1st of a month
 * is formatted as the last day of the previous month due to negative timezone offset.
 */
export function formatLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Generates local date boundaries (start of first day, end of last day)
 * of a given month in a timezone-safe manner.
 */
export function getLocalMonthBoundaries(year: number, month: number): { start: Date; end: Date } {
  // Start on 1st of the month at 00:00:00.000 local time
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);

  // Last day of the month is obtained by passing 0 as the day in the next month context
  const totalDays = getDaysInMonth(year, month);
  const end = new Date(year, month - 1, totalDays, 23, 59, 59, 999);

  return { start, end };
}

// ─── SCHEDULE GENERATION & VERIFICATION ───────────────────────────────────────

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
 * Generates a full month schedule grid.
 * Configured by default to exclude Sundays (0) and Saturdays (6) as non-working days.
 */
export function generateMonthlySchedule(
  year: number,
  month: number,
  shiftName: ShiftName,
  excludeDays: number[] = [0, 6] // Default exclude Sunday (0) and Saturday (6)
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
      dayName: DAY_NAMES[dayOfWeek] || 'Unknown',
      isWorkingDay,
      shift,
    });
  }

  return schedule;
}

/**
 * Verify if a given scan time aligns with a specified shift on that date.
 * Performs checks with timezone-safe parsing.
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
    // Arrival window validation
    isWithinArrivalWindow =
      scanTotalSeconds >= arrivalStartSec && scanTotalSeconds <= arrivalEndSec;
    if (scanTotalSeconds > arrivalEndSec) {
      isLate = true;
      minutesLate = Math.ceil((scanTotalSeconds - arrivalEndSec) / 60);
    }
  } else {
    // Departure window validation
    isWithinDepartureWindow =
      scanTotalSeconds >= departureStartSec && scanTotalSeconds <= departureEndSec;
    if (scanTotalSeconds < departureStartSec) {
      isEarlyDeparture = true;
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
