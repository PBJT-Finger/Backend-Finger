// src/utils/attendanceTransformer.js - Transform raw attendance records to aggregated data
const logger = require('./logger');

/**
 * Transform raw Prisma attendance records into aggregated dosen data
 */
function transformDosenAttendance(attendanceRecords) {
    try {
        if (!attendanceRecords || attendanceRecords.length === 0) {
            return [];
        }

        // Group by NIP
        const grouped = {};

        attendanceRecords.forEach(record => {
            const nip = record.nip;

            if (!grouped[nip]) {
                grouped[nip] = {
                    nip: nip,
                    nama: record.nama || record.employee?.nama || 'Unknown',
                    matakuliah: record.employee?.department || record.department || 'N/A',
                    records: [],
                    attendanceDates: new Set(),
                    lastCheckIn: null,
                    lastCheckOut: null
                };
            }

            grouped[nip].records.push(record);

            // Track attendance dates
            if (record.jam_masuk && record.tanggal) {
                const dateStr = record.tanggal instanceof Date
                    ? record.tanggal.toISOString().split('T')[0]
                    : String(record.tanggal).split('T')[0];
                grouped[nip].attendanceDates.add(dateStr);
            }

            // Track last check-in (MySQL returns TIME as string "HH:MM:SS")
            if (record.jam_masuk && record.tanggal) {
                // Combine date + time to create valid Date object
                const dateStr = record.tanggal instanceof Date
                    ? record.tanggal.toISOString().split('T')[0]
                    : String(record.tanggal).split('T')[0];

                const timeStr = typeof record.jam_masuk === 'string'
                    ? record.jam_masuk
                    : record.jam_masuk.toISOString().split('T')[1].substring(0, 8);

                const checkInTime = new Date(`${dateStr}T${timeStr}`);

                if (!isNaN(checkInTime.getTime())) {
                    if (!grouped[nip].lastCheckIn || checkInTime > grouped[nip].lastCheckIn) {
                        grouped[nip].lastCheckIn = checkInTime;
                    }
                }
            }

            // Track last check-out (MySQL returns TIME as string "HH:MM:SS")
            if (record.jam_keluar && record.tanggal) {
                // Combine date + time to create valid Date object
                const dateStr = record.tanggal instanceof Date
                    ? record.tanggal.toISOString().split('T')[0]
                    : String(record.tanggal).split('T')[0];

                const timeStr = typeof record.jam_keluar === 'string'
                    ? record.jam_keluar
                    : record.jam_keluar.toISOString().split('T')[1].substring(0, 8);

                const checkOutTime = new Date(`${dateStr}T${timeStr}`);

                if (!isNaN(checkOutTime.getTime())) {
                    if (!grouped[nip].lastCheckOut || checkOutTime > grouped[nip].lastCheckOut) {
                        grouped[nip].lastCheckOut = checkOutTime;
                    }
                }
            }
        });

        // Transform to array with calculations
        const result = Object.values(grouped).map(group => {
            const totalMengajar = group.records.length;
            const totalHadir = group.records.filter(r => r.jam_masuk !== null).length;
            const tidakHadir = totalMengajar - totalHadir;

            return {
                id: group.nip, // Use NIP as unique ID
                nip: group.nip,
                nama: group.nama || 'Unknown',
                totalHadir,
                tidakHadir,
                totalHariKerja: totalMengajar,
                attendanceDates: formatAttendanceDates(group.attendanceDates),
                lastCheckIn: group.lastCheckIn
                    ? formatTimeOnly(group.lastCheckIn)
                    : 'Belum ada data',
                lastCheckOut: group.lastCheckOut
                    ? formatTimeOnly(group.lastCheckOut)
                    : 'Belum ada data'
            };
        });

        return result;
    } catch (error) {
        logger.error('Error transforming dosen attendance', { error: error.message, stack: error.stack });
        return [];
    }
}

/**
 * Transform raw Prisma attendance records into aggregated karyawan data
 */
function transformKaryawanAttendance(attendanceRecords) {
    try {
        if (!attendanceRecords || attendanceRecords.length === 0) {
            return [];
        }

        // Group by NIP
        const grouped = {};

        attendanceRecords.forEach(record => {
            const nip = record.nip;
            if (!nip) return; // Skip if no NIP

            if (!grouped[nip]) {
                grouped[nip] = {
                    nip: nip,
                    nama: record.nama || record.employee?.nama || 'Unknown',
                    jabatan: record.employee?.department || record.department || 'N/A',
                    records: [],
                    uniqueDates: new Set(),
                    attendanceDates: new Set(),
                    lastCheckIn: null,
                    lastCheckOut: null
                };
            }

            grouped[nip].records.push(record);

            // Track unique dates for totalHariKerja
            if (record.tanggal) {
                const dateStr = record.tanggal instanceof Date
                    ? record.tanggal.toISOString().split('T')[0]
                    : String(record.tanggal).split('T')[0];

                grouped[nip].uniqueDates.add(dateStr);

                // Track attendance dates (only dates with actual attendance)
                if (record.jam_masuk) {
                    grouped[nip].attendanceDates.add(dateStr);
                }
            }

            // Track last check-in (MySQL returns TIME as string "HH:MM:SS")
            if (record.jam_masuk && record.tanggal) {
                // Combine date + time to create valid Date object
                const dateStr = record.tanggal instanceof Date
                    ? record.tanggal.toISOString().split('T')[0]
                    : String(record.tanggal).split('T')[0];

                const timeStr = typeof record.jam_masuk === 'string'
                    ? record.jam_masuk
                    : record.jam_masuk.toISOString().split('T')[1].substring(0, 8);

                const checkInTime = new Date(`${dateStr}T${timeStr}`);

                if (!isNaN(checkInTime.getTime())) {
                    if (!grouped[nip].lastCheckIn || checkInTime > grouped[nip].lastCheckIn) {
                        grouped[nip].lastCheckIn = checkInTime;
                    }
                }
            }

            // Track last check-out (MySQL returns TIME as string "HH:MM:SS")
            if (record.jam_keluar && record.tanggal) {
                // Combine date + time to create valid Date object
                const dateStr = record.tanggal instanceof Date
                    ? record.tanggal.toISOString().split('T')[0]
                    : String(record.tanggal).split('T')[0];

                const timeStr = typeof record.jam_keluar === 'string'
                    ? record.jam_keluar
                    : record.jam_keluar.toISOString().split('T')[1].substring(0, 8);

                const checkOutTime = new Date(`${dateStr}T${timeStr}`);

                if (!isNaN(checkOutTime.getTime())) {
                    if (!grouped[nip].lastCheckOut || checkOutTime > grouped[nip].lastCheckOut) {
                        grouped[nip].lastCheckOut = checkOutTime;
                    }
                }
            }
        });

        // Transform to array with calculations
        const result = Object.values(grouped).map(group => {
            const totalHariKerja = group.uniqueDates.size;
            const totalHadir = group.records.filter(r => r.jam_masuk !== null).length;
            const totalTerlambat = group.records.filter(r => r.status === 'TERLAMBAT').length;
            const tidakHadir = totalHariKerja - totalHadir;

            return {
                id: group.nip,
                nip: group.nip,
                nama: group.nama || 'Unknown',
                totalHadir,
                tidakHadir,
                totalTerlambat,
                totalHariKerja,
                attendanceDates: formatAttendanceDates(group.attendanceDates),
                lastCheckIn: group.lastCheckIn
                    ? formatTimeOnly(group.lastCheckIn)
                    : 'Belum ada data',
                lastCheckOut: group.lastCheckOut
                    ? formatTimeOnly(group.lastCheckOut)
                    : 'Belum ada data'
            };
        });

        return result;
    } catch (error) {
        logger.error('Error transforming karyawan attendance', { error: error.message, stack: error.stack });
        return [];
    }
}

/**
 * Format date to readable string (e.g., "22 Jan 2026")
 */
function formatDate(date) {
    if (!date) return 'Belum ada data';
    const d = new Date(date);
    if (isNaN(d.getTime())) return 'Belum ada data';

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Format time to readable string (e.g., "08:30")
 */
function formatTimeOnly(date) {
    if (!date) return 'Belum ada data';
    const d = new Date(date);
    if (isNaN(d.getTime())) return 'Belum ada data';

    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
}

/**
 * Format attendance dates to comma-separated string
 */
function formatAttendanceDates(datesSet) {
    if (!datesSet || datesSet.size === 0) {
        return 'Belum ada data';
    }

    // Convert Set to sorted array
    const sortedDates = Array.from(datesSet).filter(d => d).sort();

    // Format each date
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const formattedDates = sortedDates.map(dateStr => {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return null;
        return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
    }).filter(d => d);

    // Join with comma
    return formattedDates.length > 0 ? formattedDates.join(', ') : 'Belum ada data';
}

module.exports = {
    transformDosenAttendance,
    transformKaryawanAttendance,
    formatDate,
    formatTimeOnly,
    formatAttendanceDates
};
