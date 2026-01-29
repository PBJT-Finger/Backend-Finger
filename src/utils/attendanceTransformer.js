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
                persentase: totalMengajar > 0 ? (totalHadir / totalMengajar) * 100 : 0,
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
                    records: [],
                    attendanceDates: new Set(),
                    uniqueDates: new Set(),
                    lastCheckIn: null,
                    lastCheckOut: null
                };
            }

            grouped[nip].records.push(record);

            // Track ALL dates for this employee (for total hari kerja)
            if (record.tanggal) {
                const dateStr = record.tanggal instanceof Date
                    ? record.tanggal.toISOString().split('T')[0]
                    : String(record.tanggal).split('T')[0];
                grouped[nip].uniqueDates.add(dateStr);
            }

            // Track attendance dates (only when there's check-in)
            if (record.jam_masuk && record.tanggal) {
                const dateStr = record.tanggal instanceof Date
                    ? record.tanggal.toISOString().split('T')[0]
                    : String(record.tanggal).split('T')[0];
                grouped[nip].attendanceDates.add(dateStr);
            }

            // Track last check-in
            if (record.jam_masuk && record.tanggal) {
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
                persentase: totalHariKerja > 0 ? (totalHadir / totalHariKerja) * 100 : 0,
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

// Helper function to format attendance dates
function formatAttendanceDates(datesSet) {
    if (!datesSet || datesSet.size === 0) return 'Belum ada data';

    const dates = Array.from(datesSet).sort();

    // If only 1 day, show single date
    if (dates.length === 1) {
        const date = new Date(dates[0]);
        const day = date.getDate();
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
        const month = monthNames[date.getMonth()];
        const year = date.getFullYear();
        return `${day} ${month} ${year}`;
    }

    // If multiple days, show range
    const firstDate = new Date(dates[0]);
    const lastDate = new Date(dates[dates.length - 1]);

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

    const firstDay = firstDate.getDate();
    const firstMonth = monthNames[firstDate.getMonth()];

    const lastDay = lastDate.getDate();
    const lastMonth = monthNames[lastDate.getMonth()];
    const lastYear = lastDate.getFullYear();

    // If same month, show: "22 - 28 Jan 2026"
    if (firstDate.getMonth() === lastDate.getMonth() && firstDate.getFullYear() === lastDate.getFullYear()) {
        return `${firstDay} - ${lastDay} ${lastMonth} ${lastYear}`;
    }

    // If different months, show: "22 Jan - 28 Feb 2026"
    return `${firstDay} ${firstMonth} - ${lastDay} ${lastMonth} ${lastYear}`;
}

// Helper function to format time
function formatTime(time) {
    if (!time) return 'Belum ada data';
    if (typeof time === 'string') return time;

    const date = new Date(time);
    if (isNaN(date.getTime())) return 'Belum ada data';

    return date.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

// Helper function to format time only (HH:MM from Date object)
function formatTimeOnly(dateTime) {
    if (!dateTime) return 'Belum ada data';

    const date = dateTime instanceof Date ? dateTime : new Date(dateTime);
    if (isNaN(date.getTime())) return 'Belum ada data';

    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${hours}:${minutes}`;
}

// Helper function to format date in Indonesian format (DD/MM/YYYY)
function formatDateID(dateString) {
    if (!dateString) return '-';

    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();

    return `${day}/${month}/${year}`;
}

module.exports = {
    transformDosenAttendance,
    transformKaryawanAttendance,
    formatDateID
};
