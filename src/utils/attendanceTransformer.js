// src/utils/attendanceTransformer.js - Transform raw attendance records to aggregated data
const logger = require('./logger');

/**
 * Extract time string "HH:MM" from various formats.
 *
 * IMPORTANT: MySQL TIME is stored in UTC. Data sources behave differently:
 *   - Prisma: returns Date object (1970-01-01T00:50:00.000Z) → getHours() gives local WIB time
 *   - mysql2 raw SQL: returns UTC string "00:50:00" → must be converted to local time
 *
 * This function normalizes both formats to a correct local time "HH:MM" string.
 *
 * @param {string|Date|null} timeValue - Time from Prisma (Date) or mysql2 (string)
 * @returns {string|null} "HH:MM" in local time or null
 */
function extractTimeString(timeValue) {
  if (!timeValue) return null;
  if (typeof timeValue === 'string') {
    // mysql2 returns TIME as UTC string like "00:50:00"
    // Wrap in Date as UTC, then use getHours() to get local (WIB) time
    const match = timeValue.match(/^(\d{2}):(\d{2})/);
    if (match) {
      const utcDate = new Date(Date.UTC(1970, 0, 1, parseInt(match[1], 10), parseInt(match[2], 10)));
      const h = String(utcDate.getHours()).padStart(2, '0');
      const m = String(utcDate.getMinutes()).padStart(2, '0');
      return `${h}:${m}`;
    }
    return timeValue.substring(0, 5);
  }
  if (timeValue instanceof Date && !isNaN(timeValue.getTime())) {
    // Prisma returns TIME as Date (1970-01-01T00:50:00.000Z)
    // getHours() returns local (WIB) time = correct original value
    const h = String(timeValue.getHours()).padStart(2, '0');
    const m = String(timeValue.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }
  return String(timeValue).substring(0, 5);
}

/**
 * Extract date string "YYYY-MM-DD" from various formats
 * MySQL stores DATE in local timezone. Prisma/mysql2 converts local→UTC internally.
 * We use local date methods to convert back to the original stored date.
 * @param {string|Date|null} dateValue
 * @returns {string} "YYYY-MM-DD" or empty string
 */
function extractDateString(dateValue) {
  if (!dateValue) return '';
  if (typeof dateValue === 'string') return dateValue.split('T')[0];
  if (dateValue instanceof Date && !isNaN(dateValue.getTime())) {
    // Use local methods — MySQL stores local time, driver converts to UTC
    const y = dateValue.getFullYear();
    const m = String(dateValue.getMonth() + 1).padStart(2, '0');
    const d = String(dateValue.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return '';
}

/**
 * Convert a TIME value (string or Date) to a UTC Date for comparison.
 * This mirrors how the dashboard compares jam_masuk/jam_keluar:
 *   Dashboard (Prisma): new Date(record.jam_masuk) → gives UTC epoch Date
 *   Export (mysql2):    string "00:50:00" → we create Date(UTC) equivalent
 * Both produce the same comparable Date.
 * @param {string|Date|null} timeValue
 * @returns {Date|null}
 */
function toUTCDate(timeValue) {
  if (!timeValue) return null;
  if (timeValue instanceof Date) return timeValue; // Already a Date (Prisma path)
  if (typeof timeValue === 'string') {
    const match = timeValue.match(/^(\d{2}):(\d{2})(:(\d{2}))?/);
    if (match) {
      return new Date(Date.UTC(1970, 0, 1, parseInt(match[1], 10), parseInt(match[2], 10), parseInt(match[4] || '0', 10)));
    }
  }
  return null;
}

/**
 * Calculate number of working days between two dates (excluding Sundays)
 * Sunday is considered a holiday and excluded from working day count.
 * @param {string|Date} startDate - Start date
 * @param {string|Date} endDate - End date
 * @returns {number} Number of working days (Monday-Saturday only)
 */
function calculateWorkingDays(startDate, endDate) {
  if (!startDate || !endDate) {
    return 0;
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  let count = 0;
  const current = new Date(start);

  while (current <= end) {
    const dayOfWeek = current.getDay();
    // Exclude Sundays (0 = Sunday)
    // Count Monday (1) - Saturday (6) only as working days
    if (dayOfWeek !== 0) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
}

/**
 * Transform raw attendance records into aggregated dosen data.
 * This MUST match the dashboard's getAttendanceSummary logic exactly:
 *   - totalHadir = count of UNIQUE attendance dates
 *   - totalHariKerja = totalHadir (same as dashboard)
 *   - lastCheckIn/Out = latest time by comparing jam_masuk as Date (UTC epoch)
 *
 * @param {Array} attendanceRecords - Raw attendance records (from mysql2 raw SQL)
 * @param {string|Date} startDate - Start date of the period
 * @param {string|Date} endDate - End date of the period
 * @returns {Array} Transformed attendance data
 */
function transformDosenAttendance(attendanceRecords, startDate, endDate) {
  try {
    if (!attendanceRecords || attendanceRecords.length === 0) {
      return [];
    }

    // Group by NIP — mirrors dashboard's employeeStats grouping
    const grouped = {};

    attendanceRecords.forEach(record => {
      const nip = record.nip;
      if (!nip) return;

      if (!grouped[nip]) {
        grouped[nip] = {
          nip: nip,
          nama: record.nama || 'Unknown',
          attendanceDates: new Set(), // Unique dates (for totalHadir)
          totalTerlambat: 0,
          lastCheckInUTC: null,   // Store as UTC Date for comparison (mirrors dashboard)
          lastCheckOutUTC: null
        };
      }

      // Add unique date — mirrors dashboard: employeeStats[key].attendanceDates.add(dateStr)
      const dateStr = extractDateString(record.tanggal);
      if (dateStr) grouped[nip].attendanceDates.add(dateStr);

      // Track latest check-in — mirrors dashboard: compares Date objects
      // Dashboard: checkInDateTime = new Date(record.jam_masuk) then picks the greater one
      // mysql2 returns string "00:50:00" (UTC), so we create Date(UTC) for comparison
      if (record.jam_masuk) {
        const checkInUTC = toUTCDate(record.jam_masuk);
        if (checkInUTC && (!grouped[nip].lastCheckInUTC || checkInUTC > grouped[nip].lastCheckInUTC)) {
          grouped[nip].lastCheckInUTC = checkInUTC;
        }
      }

      // Track latest check-out — same approach
      if (record.jam_keluar) {
        const checkOutUTC = toUTCDate(record.jam_keluar);
        if (checkOutUTC && (!grouped[nip].lastCheckOutUTC || checkOutUTC > grouped[nip].lastCheckOutUTC)) {
          grouped[nip].lastCheckOutUTC = checkOutUTC;
        }
      }

      // Count late
      if (record.status === 'TERLAMBAT') {
        grouped[nip].totalTerlambat++;
      }
    });

    // Transform to array — mirrors dashboard's summary mapping
    const result = Object.values(grouped).map(group => {
      // Dashboard: totalHadir = attendanceDatesArray.length (unique dates)
      const totalHadir = group.attendanceDates.size;
      // Dashboard: totalHariKerja = totalHadir
      const totalHariKerja = totalHadir;

      return {
        id: group.nip,
        nip: group.nip,
        nama: group.nama,
        totalHadir,
        tidakHadir: 0,
        totalHariKerja,
        persentase: totalHariKerja > 0 ? Math.round((totalHadir / totalHariKerja) * 100) : 0,
        attendanceDates: formatAttendanceDates(group.attendanceDates),
        // Convert UTC Date back to local "HH:MM" string for display
        lastCheckIn: group.lastCheckInUTC ? extractTimeString(group.lastCheckInUTC) : 'Belum ada data',
        lastCheckOut: group.lastCheckOutUTC ? extractTimeString(group.lastCheckOutUTC) : 'Belum ada data'
      };
    });

    return result;
  } catch (error) {
    logger.error('Error transforming dosen attendance', {
      error: error.message,
      stack: error.stack
    });
    return [];
  }
}

/**
 * Transform raw attendance records into aggregated karyawan data.
 * This MUST match the dashboard's getAttendanceSummary logic exactly:
 *   - totalHadir = count of UNIQUE attendance dates
 *   - totalHariKerja = totalHadir (same as dashboard)
 *   - lastCheckIn/Out = latest time by comparing jam_masuk as Date (UTC epoch)
 *
 * @param {Array} attendanceRecords - Raw attendance records (from mysql2 raw SQL)
 * @param {string|Date} startDate - Start date of the period
 * @param {string|Date} endDate - End date of the period
 * @returns {Array} Transformed attendance data
 */
function transformKaryawanAttendance(attendanceRecords, startDate, endDate) {
  try {
    if (!attendanceRecords || attendanceRecords.length === 0) {
      return [];
    }

    // Group by NIP — mirrors dashboard's employeeStats grouping
    const grouped = {};

    attendanceRecords.forEach(record => {
      const nip = record.nip;
      if (!nip) return;

      if (!grouped[nip]) {
        grouped[nip] = {
          nip: nip,
          nama: record.nama || 'Unknown',
          attendanceDates: new Set(), // Unique dates (for totalHadir)
          totalTerlambat: 0,
          lastCheckInUTC: null,   // Store as UTC Date for comparison (mirrors dashboard)
          lastCheckOutUTC: null
        };
      }

      // Add unique date — mirrors dashboard: employeeStats[key].attendanceDates.add(dateStr)
      const dateStr = extractDateString(record.tanggal);
      if (dateStr) grouped[nip].attendanceDates.add(dateStr);

      // Track latest check-in — mirrors dashboard: compares Date objects
      if (record.jam_masuk) {
        const checkInUTC = toUTCDate(record.jam_masuk);
        if (checkInUTC && (!grouped[nip].lastCheckInUTC || checkInUTC > grouped[nip].lastCheckInUTC)) {
          grouped[nip].lastCheckInUTC = checkInUTC;
        }
      }

      // Track latest check-out — same approach
      if (record.jam_keluar) {
        const checkOutUTC = toUTCDate(record.jam_keluar);
        if (checkOutUTC && (!grouped[nip].lastCheckOutUTC || checkOutUTC > grouped[nip].lastCheckOutUTC)) {
          grouped[nip].lastCheckOutUTC = checkOutUTC;
        }
      }

      // Count late
      if (record.status === 'TERLAMBAT') {
        grouped[nip].totalTerlambat++;
      }
    });

    // Transform to array — mirrors dashboard's summary mapping
    const result = Object.values(grouped).map(group => {
      // Dashboard: totalHadir = attendanceDatesArray.length (unique dates)
      const totalHadir = group.attendanceDates.size;
      // Dashboard: totalHariKerja = totalHadir
      const totalHariKerja = totalHadir;

      return {
        id: group.nip,
        nip: group.nip,
        nama: group.nama,
        totalHadir,
        tidakHadir: 0,
        totalTerlambat: group.totalTerlambat,
        totalHariKerja,
        persentase: totalHariKerja > 0 ? Math.round((totalHadir / totalHariKerja) * 100) : 0,
        attendanceDates: formatAttendanceDates(group.attendanceDates),
        // Convert UTC Date back to local "HH:MM" string for display
        lastCheckIn: group.lastCheckInUTC ? extractTimeString(group.lastCheckInUTC) : 'Belum ada data',
        lastCheckOut: group.lastCheckOutUTC ? extractTimeString(group.lastCheckOutUTC) : 'Belum ada data'
      };
    });

    return result;
  } catch (error) {
    logger.error('Error transforming karyawan attendance', {
      error: error.message,
      stack: error.stack
    });
    return [];
  }
}

// Helper function to format attendance dates (timezone-safe using UTC)
function formatAttendanceDates(datesSet) {
  if (!datesSet || datesSet.size === 0) return 'Belum ada data';

  const dates = Array.from(datesSet).sort();
  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
    'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
  ];

  // Parse YYYY-MM-DD string directly — no Date constructor needed
  const parseDateParts = (dateStr) => {
    const parts = dateStr.split('-');
    return {
      year: parseInt(parts[0], 10),
      month: parseInt(parts[1], 10) - 1, // 0-indexed for monthNames
      day: parseInt(parts[2], 10)
    };
  };

  // If only 1 day, show single date
  if (dates.length === 1) {
    const d = parseDateParts(dates[0]);
    return `${d.day} ${monthNames[d.month]} ${d.year}`;
  }

  // If multiple days, show range
  const first = parseDateParts(dates[0]);
  const last = parseDateParts(dates[dates.length - 1]);

  // If same month, show: "22 - 28 Jan 2026"
  if (first.month === last.month && first.year === last.year) {
    return `${first.day} - ${last.day} ${monthNames[last.month]} ${last.year}`;
  }

  // If different months, show: "22 Jan - 28 Feb 2026"
  return `${first.day} ${monthNames[first.month]} - ${last.day} ${monthNames[last.month]} ${last.year}`;
}

// Helper function to format time (timezone-safe)
function formatTime(time) {
  if (!time) return 'Belum ada data';
  // Use extractTimeString for consistent timezone-safe extraction
  const timeStr = extractTimeString(time);
  return timeStr || 'Belum ada data';
}

// Helper function to format time only — now just returns the already-clean "HH:MM" string
function formatTimeOnly(timeValue) {
  if (!timeValue) return 'Belum ada data';
  // If already a clean string from extractTimeString, just return it
  if (typeof timeValue === 'string') return timeValue;
  // Fallback: extract from Date using UTC (timezone-safe)
  return extractTimeString(timeValue) || 'Belum ada data';
}

// Helper function to format date in Indonesian format (DD/MM/YYYY) — timezone-safe
function formatDateID(dateString) {
  if (!dateString) return '-';

  // Try direct string parsing first (YYYY-MM-DD)
  const dateStr = extractDateString(dateString);
  if (dateStr && dateStr.includes('-')) {
    const parts = dateStr.split('-');
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  // Fallback
  return String(dateString);
}

module.exports = {
  transformDosenAttendance,
  transformKaryawanAttendance,
  formatDateID,
  extractTimeString
};
