// src/application/use-cases/attendance/RecordAttendance.usecase.js
// Use case for recording attendance from fingerprint device

const Attendance = require('../../../domain/entities/Attendance.entity');
const NIP = require('../../../domain/value-objects/NIP');

class RecordAttendanceUseCase {
    /**
     * @param {IAttendanceRepository} attendanceRepository
     * @param {IEmployeeRepository} employeeRepository
     */
    constructor(attendanceRepository, employeeRepository) {
        this.attendanceRepository = attendanceRepository;
        this.employeeRepository = employeeRepository;
    }

    /**
     * Execute the use case
     * @param {Object} data - Attendance data from device
     * @param {string} data.nip - Employee NIP
     * @param {string} data.nama - Employee name
     * @param {string} data.tanggal - Date
     * @param {string} data.jamMasuk - Check-in time
     * @param {string} data.jamKeluar - Check-out time (optional)
     * @param {string} data.deviceId - Device ID
     * @param {string} data.cloudId - Cloud ID (optional)
     * @returns {Promise<Attendance>} Created/updated attendance record
     */
    async execute(data) {
        // Validate NIP
        const nip = new NIP(data.nip);
        const nipValue = nip.getValue();

        // Verify employee exists
        const employee = await this.employeeRepository.findByNIP(nipValue);
        if (!employee) {
            throw new Error(`Employee with NIP ${nipValue} not found`);
        }

        if (!employee.isActiveEmployee()) {
            throw new Error(`Employee ${nipValue} is not active`);
        }

        // Check if attendance already exists for this date
        const existingAttendance = await this.attendanceRepository.findByNIPAndDate(
            nipValue,
            new Date(data.tanggal)
        );

        let attendance;

        if (existingAttendance) {
            // Update existing record (e.g., adding check-out time)
            if (data.jamKeluar && !existingAttendance.jamKeluar) {
                attendance = await this.attendanceRepository.update(existingAttendance.id, {
                    jam_keluar: data.jamKeluar,
                    updated_at: new Date()
                });
            } else {
                // Return existing record if no update needed
                attendance = existingAttendance;
            }
        } else {
            // Create new attendance record
            const newAttendance = new Attendance({
                userId: data.user_id || nipValue,
                nip: nipValue,
                nama: data.nama || employee.nama,
                jabatan: employee.jabatan,
                tanggal: new Date(data.tanggal),
                jamMasuk: data.jamMasuk ? new Date(`1970-01-01T${data.jamMasuk}`) : null,
                jamKeluar: data.jamKeluar ? new Date(`1970-01-01T${data.jamKeluar}`) : null,
                deviceId: data.deviceId,
                cloudId: data.cloudId,
                verificationMethod: data.verificationMethod || 'SIDIK_JARI',
                status: this.determineStatus(employee, data.jamMasuk),
                isDeleted: false
            });

            attendance = await this.attendanceRepository.create(newAttendance);
        }

        return attendance;
    }

    /**
     * Determine attendance status based on employee and time
     * @private
     * @param {Employee} employee
     * @param {string} jamMasuk
     * @returns {string}
     */
    determineStatus(employee, jamMasuk) {
        // Simplified status determination
        // For DOSEN, always HADIR (no late status)
        if (employee.isDosen()) {
            return 'HADIR';
        }

        // For KARYAWAN, would check against shift time
        // This is simplified - actual implementation would fetch shift and compare
        return 'HADIR';
    }
}

module.exports = RecordAttendanceUseCase;
