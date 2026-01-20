// src/services/attendanceService.js - Service untuk logika bisnis absensi
const { Attendance, Employee, Shift } = require('../models');
const { Op } = require('sequelize');
const logger = require('../utils/logger');

class AttendanceService {
    /**
     * Get attendance summary for employees
     * Main API for frontend rekap absensi
     */
    static async getAttendanceSummary(filters = {}) {
        try {
            const {
                startDate,
                endDate,
                jabatan, // 'DOSEN' or 'KARYAWAN'
                nip,
                department,
                fakultas,
                page = 1,
                limit = 50
            } = filters;

            // Build where clause for employees
            const employeeWhere = {
                is_active: true,
                status: 'AKTIF'
            };

            if (jabatan) employeeWhere.jabatan = jabatan;
            if (nip) employeeWhere.nip = nip;
            if (department) employeeWhere.department = department;
            if (fakultas) employeeWhere.fakultas = fakultas;

            // Get employees with pagination
            const { count, rows: employees } = await Employee.findAndCountAll({
                where: employeeWhere,
                include: [{
                    model: Shift,
                    as: 'shift'
                }],
                offset: (page - 1) * limit,
                limit: limit,
                order: [['nama', 'ASC']]
            });

            // Calculate total working days (weekends only, no holidays)
            const totalWorkingDays = this.calculateWorkingDaysWeekendOnly(
                startDate,
                endDate
            );

            // Get summary for each employee
            const summaries = await Promise.all(
                employees.map(emp => this.getEmployeeSummary(
                    emp,
                    startDate,
                    endDate,
                    totalWorkingDays
                ))
            );

            return {
                data: summaries,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: count,
                    totalPages: Math.ceil(count / limit),
                    totalWorkingDays
                }
            };
        } catch (error) {
            logger.error('Error getting attendance summary', {
                filters,
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }

    /**
     * Get summary for one employee
     */
    static async getEmployeeSummary(employee, startDate, endDate, totalWorkingDays) {
        try {
            const nip = employee.nip;

            // 1. Get all attendance records untuk periode ini
            const attendances = await Attendance.findAll({
                where: {
                    nip: nip,
                    tanggal_absensi: {
                        [Op.between]: [startDate, endDate]
                    },
                    is_deleted: false
                },
                order: [
                    ['tanggal_absensi', 'DESC'],
                    ['waktu_absensi', 'DESC']
                ]
            });

            // 2. Calculate attendance days (unique dates dengan MASUK)
            // Group by date and check if has MASUK
            const attendanceDates = new Set();
            const dateGroups = {};

            attendances.forEach(a => {
                const dateStr = a.tanggal_absensi.toISOString().split('T')[0];
                if (!dateGroups[dateStr]) {
                    dateGroups[dateStr] = [];
                }
                dateGroups[dateStr].push(a);
            });

            // Count days with at least one MASUK
            Object.keys(dateGroups).forEach(dateStr => {
                const hasMasuk = dateGroups[dateStr].some(a => a.tipe_absensi === 'MASUK');
                if (hasMasuk) {
                    attendanceDates.add(dateStr);
                }
            });

            const hadir = attendanceDates.size;

            // 3. Calculate late days (berdasarkan shift untuk KARYAWAN)
            let terlambat = 0;

            if (employee.jabatan === 'KARYAWAN' && employee.shift) {
                const shiftTime = employee.shift.jam_masuk;
                const toleransi = employee.shift.toleransi_menit;

                // Count unique dates where first MASUK is late
                const lateDates = new Set();

                Object.keys(dateGroups).forEach(dateStr => {
                    const masukRecords = dateGroups[dateStr]
                        .filter(a => a.tipe_absensi === 'MASUK')
                        .sort((a, b) => a.waktu_absensi.localeCompare(b.waktu_absensi));

                    if (masukRecords.length > 0) {
                        const firstMasuk = masukRecords[0];
                        if (this.isLate(firstMasuk.waktu_absensi, shiftTime, toleransi)) {
                            lateDates.add(dateStr);
                        }
                    }
                });

                terlambat = lateDates.size;
            }
            // DOSEN: no lateness tracking (flexible)

            // 4. Calculate percentage
            const presentase = totalWorkingDays > 0
                ? parseFloat(((hadir / totalWorkingDays) * 100).toFixed(2))
                : 0;

            // 5. Get last check-in and check-out
            const lastCheckIn = attendances
                .filter(a => a.tipe_absensi === 'MASUK')
                .find(() => true); // Get first (already sorted DESC)

            const lastCheckOut = attendances
                .filter(a => a.tipe_absensi === 'PULANG')
                .find(() => true);

            return {
                nip: employee.nip,
                nama: employee.nama,
                jabatan: employee.jabatan,
                department: employee.department,
                fakultas: employee.fakultas,
                shift: employee.shift?.nama_shift || 'Fleksibel',
                hadir,
                totalHariKerja: totalWorkingDays,
                terlambat,
                presentase,
                checkInTerakhir: lastCheckIn ? {
                    tanggal: lastCheckIn.tanggal_absensi,
                    waktu: lastCheckIn.waktu_absensi
                } : null,
                checkOutTerakhir: lastCheckOut ? {
                    tanggal: lastCheckOut.tanggal_absensi,
                    waktu: lastCheckOut.waktu_absensi
                } : null
            };
        } catch (error) {
            logger.error('Error getting employee summary', {
                nip: employee.nip,
                error: error.message
            });

            // Return basic data on error
            return {
                nip: employee.nip,
                nama: employee.nama,
                jabatan: employee.jabatan,
                department: employee.department,
                fakultas: employee.fakultas,
                shift: employee.shift?.nama_shift || 'Fleksibel',
                hadir: 0,
                totalHariKerja: totalWorkingDays,
                terlambat: 0,
                presentase: 0,
                checkInTerakhir: null,
                checkOutTerakhir: null,
                error: 'Failed to calculate summary'
            };
        }
    }

    /**
     * Check if attendance time is late
     */
    static isLate(waktuAbsensi, shiftTime, toleransiMenit) {
        try {
            // Convert times to minutes
            const [aHours, aMinutes, aSeconds] = waktuAbsensi.split(':').map(Number);
            const absensiMinutes = aHours * 60 + aMinutes;

            const [sHours, sMinutes, sSeconds] = shiftTime.split(':').map(Number);
            const shiftMinutes = sHours * 60 + sMinutes + toleransiMenit;

            return absensiMinutes > shiftMinutes;
        } catch (error) {
            logger.error('Error checking if late', {
                waktuAbsensi,
                shiftTime,
                error: error.message
            });
            return false;
        }
    }

    /**
     * Get detailed attendance for one employee
     */
    static async getEmployeeAttendanceDetail(nip, startDate, endDate) {
        try {
            const attendances = await Attendance.findAll({
                where: {
                    nip: nip,
                    tanggal_absensi: {
                        [Op.between]: [startDate, endDate]
                    },
                    is_deleted: false
                },
                order: [
                    ['tanggal_absensi', 'DESC'],
                    ['waktu_absensi', 'DESC']
                ]
            });

            // Group by date
            const grouped = {};
            attendances.forEach(a => {
                const dateStr = a.tanggal_absensi.toISOString().split('T')[0];
                if (!grouped[dateStr]) {
                    grouped[dateStr] = {
                        tanggal: dateStr,
                        masuk: [],
                        pulang: []
                    };
                }

                if (a.tipe_absensi === 'MASUK') {
                    grouped[dateStr].masuk.push(a.waktu_absensi);
                } else {
                    grouped[dateStr].pulang.push(a.waktu_absensi);
                }
            });

            // Convert to array
            const result = Object.values(grouped).sort((a, b) =>
                b.tanggal.localeCompare(a.tanggal)
            );

            return result;
        } catch (error) {
            logger.error('Error getting employee attendance detail', {
                nip,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Calculate working days (exclude weekends only, no holidays)
     * Simple version without holiday calculation
     */
    static calculateWorkingDaysWeekendOnly(startDate, endDate) {
        try {
            const start = new Date(startDate);
            const end = new Date(endDate);
            let workingDays = 0;
            const current = new Date(start);

            while (current <= end) {
                const dayOfWeek = current.getDay();
                // Exclude Sunday (0) and Saturday (6)
                if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                    workingDays++;
                }
                current.setDate(current.getDate() + 1);
            }

            return workingDays;
        } catch (error) {
            logger.error('Error calculating working days', {
                startDate,
                endDate,
                error: error.message
            });
            // Fallback: return total days
            const start = new Date(startDate);
            const end = new Date(endDate);
            const diffTime = Math.abs(end - start);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            return diffDays;
        }
    }
}

module.exports = AttendanceService;
