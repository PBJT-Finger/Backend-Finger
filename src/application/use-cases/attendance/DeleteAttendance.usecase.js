// src/application/use-cases/attendance/DeleteAttendance.usecase.js
// Use case for deleting (soft delete) attendance record

class DeleteAttendanceUseCase {
    /**
     * @param {IAttendanceRepository} attendanceRepository
     */
    constructor(attendanceRepository) {
        this.attendanceRepository = attendanceRepository;
    }

    /**
     * Execute the use case
     * @param {number} id - Attendance record ID
     * @param {Object} admin - Admin performing the deletion
     * @returns {Promise<boolean>} Success status
     */
    async execute(id, admin) {
        // Verify admin has permission to delete
        if (!admin.canDeleteRecords()) {
            throw new Error('Unauthorized: Admin does not have permission to delete records');
        }

        // Check if attendance record exists
        const attendance = await this.attendanceRepository.findById(id);
        if (!attendance) {
            throw new Error(`Attendance record with ID ${id} not found`);
        }

        if (attendance.isDeleted) {
            throw new Error('Attendance record is already deleted');
        }

        // Perform soft delete
        const success = await this.attendanceRepository.delete(id);

        return success;
    }
}

module.exports = DeleteAttendanceUseCase;
