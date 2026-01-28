// src/application/use-cases/attendance/GetAttendanceSummary.usecase.js
// Use case for getting attendance summary

const TimeRange = require('../../../domain/value-objects/TimeRange');

class GetAttendanceSummaryUseCase {
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
     * @param {Object} filters - Filter criteria
     * @param {Date} filters.startDate - Start date
     * @param {Date} filters.endDate - End date
     * @param {string} filters.nip - Optional NIP filter
     * @param {string} filters.jabatan - Optional position filter
     * @returns {Promise<Array<Object>>} Attendance summaries
     */
    async execute(filters) {
        // Validate date range
        const timeRange = new TimeRange(filters.startDate, filters.endDate);
        const totalWorkingDays = timeRange.getWorkingDays();

        // Get employees based on filters
        const employeeFilters = {};
        if (filters.nip) employeeFilters.nip = filters.nip;
        if (filters.jabatan) employeeFilters.jabatan = filters.jabatan;

        const employees = await this.employeeRepository.findByFilters(employeeFilters);

        if (employees.length === 0) {
            return [];
        }

        // Calculate summary for each employee
        const summaries = await Promise.all(
            employees.map(employee =>
                this.calculateEmployeeSummary(employee, timeRange, totalWorkingDays)
            )
        );

        return summaries.filter(summary => summary !== null);
    }

    /**
     * Calculate summary for one employee
     * @private
     * @param {Employee} employee
     * @param {TimeRange} timeRange
     * @param {number} totalWorkingDays
     * @returns {Promise<Object>}
     */
    async calculateEmployeeSummary(employee, timeRange, totalWorkingDays) {
        try {
            // Get attendance records for this employee
            const attendanceRecords = await this.attendanceRepository.findByNIPAndDateRange(
                employee.nip,
                timeRange.getStartDate(),
                timeRange.getEndDate()
            );

            // Calculate statistics
            const stats = {
                nip: employee.nip,
                nama: employee.nama,
                jabatan: employee.jabatan,
                shift: null, // Will be populated if shift data is available
                total_working_days: totalWorkingDays,
                total_hadir: 0,
                total_terlambat: 0,
                persentase_kehadiran: 0
            };

            // Count attendance
            attendanceRecords.forEach(record => {
                if (record.isPresent()) {
                    stats.total_hadir++;
                }

                // Only count lateness for KARYAWAN
                if (employee.isKaryawan() && record.isLate()) {
                    stats.total_terlambat++;
                }
            });

            // Calculate attendance percentage
            stats.persentase_kehadiran = totalWorkingDays > 0
                ? Math.round((stats.total_hadir / totalWorkingDays) * 100)
                : 0;

            return stats;
        } catch (error) {
            console.error(`Error calculating summary for employee ${employee.nip}:`, error);
            return null;
        }
    }
}

module.exports = GetAttendanceSummaryUseCase;
