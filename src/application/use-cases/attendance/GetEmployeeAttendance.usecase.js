// src/application/use-cases/attendance/GetEmployeeAttendance.usecase.js
// Use case for getting attendance details for a specific employee

const TimeRange = require('../../../domain/value-objects/TimeRange');
const NIP = require('../../../domain/value-objects/NIP');

class GetEmployeeAttendanceUseCase {
    /**
     * @param {IEmployeeRepository} employeeRepository
     * @param {IAttendanceRepository} attendanceRepository
     */
    constructor(employeeRepository, attendanceRepository) {
        this.employeeRepository = employeeRepository;
        this.attendanceRepository = attendanceRepository;
    }

    /**
     * Execute the use case
     * @param {Object} params
     * @param {string} params.nip - Employee NIP
     * @param {Date} params.startDate - Start date
     * @param {Date} params.endDate - End date
     * @returns {Promise<Object>} Employee attendance details
     */
    async execute(params) {
        // Validate NIP
        const nip = new NIP(params.nip);
        const nipValue = nip.getValue();

        // Verify employee exists
        const employee = await this.employeeRepository.findByNIP(nipValue);
        if (!employee) {
            throw new Error(`Employee with NIP ${nipValue} not found`);
        }

        // Validate date range
        const timeRange = new TimeRange(params.startDate, params.endDate);

        // Get attendance records
        const attendanceRecords = await this.attendanceRepository.findByNIPAndDateRange(
            nipValue,
            timeRange.getStartDate(),
            timeRange.getEndDate()
        );

        // Build response with employee info and attendance details
        return {
            employee: {
                nip: employee.nip,
                nama: employee.nama,
                jabatan: employee.jabatan,
                status: employee.status
            },
            period: {
                startDate: timeRange.getStartDate(),
                endDate: timeRange.getEndDate(),
                workingDays: timeRange.getWorkingDays()
            },
            attendance: attendanceRecords.map(record => this.formatAttendanceRecord(record)),
            summary: this.calculateSummary(attendanceRecords, employee, timeRange.getWorkingDays())
        };
    }

    /**
     * Format attendance record for response
     * @private
     * @param {Attendance} record
     * @returns {Object}
     */
    formatAttendanceRecord(record) {
        return {
            id: record.id,
            tanggal: record.tanggal,
            jamMasuk: record.jamMasuk,
            jamKeluar: record.jamKeluar,
            status: record.status,
            workDuration: record.getWorkDurationHours(),
            isComplete: record.isComplete(),
            isLate: record.isLate(),
            deviceId: record.deviceId
        };
    }

    /**
     * Calculate summary statistics
     * @private
     * @param {Array<Attendance>} records
     * @param {Employee} employee
     * @param {number} totalWorkingDays
     * @returns {Object}
     */
    calculateSummary(records, employee, totalWorkingDays) {
        const summary = {
            totalRecords: records.length,
            totalPresent: 0,
            totalLate: 0,
            totalComplete: 0,
            attendanceRate: 0
        };

        records.forEach(record => {
            if (record.isPresent()) {
                summary.totalPresent++;
            }

            if (record.isLate() && employee.isKaryawan()) {
                summary.totalLate++;
            }

            if (record.isComplete()) {
                summary.totalComplete++;
            }
        });

        summary.attendanceRate = totalWorkingDays > 0
            ? Math.round((summary.totalPresent / totalWorkingDays) * 100)
            : 0;

        return summary;
    }
}

module.exports = GetEmployeeAttendanceUseCase;
