// src/domain/repositories/IAttendanceRepository.js
// Repository interface for Attendance domain

/**
 * Interface for Attendance Repository
 * All concrete implementations must implement these methods
 */
class IAttendanceRepository {
    /**
     * Find attendance by ID
     * @param {number} id - Attendance ID
     * @returns {Promise<Attendance|null>}
     */
    async findById(id) {
        throw new Error('Method findById() must be implemented');
    }

    /**
     * Find attendance records by NIP and date range
     * @param {string} nip - Employee NIP
     * @param {Date} startDate - Start date
     * @param {Date} endDate - End date
     * @returns {Promise<Array<Attendance>>}
     */
    async findByNIPAndDateRange(nip, startDate, endDate) {
        throw new Error('Method findByNIPAndDateRange() must be implemented');
    }

    /**
     * Find attendance records by filters
     * @param {Object} filters - Filter criteria
     * @param {string} filters.nip - Filter by NIP
     * @param {string} filters.jabatan - Filter by position
     * @param {Date} filters.startDate - Start date
     * @param {Date} filters.endDate - End date
     * @param {string} filters.status - Filter by status
     * @returns {Promise<Array<Attendance>>}
     */
    async findByFilters(filters) {
        throw new Error('Method findByFilters() must be implemented');
    }

    /**
     * Find attendance for specific date
     * @param {string} nip - Employee NIP
     * @param {Date} date - Specific date
     * @returns {Promise<Attendance|null>}
     */
    async findByNIPAndDate(nip, date) {
        throw new Error('Method findByNIPAndDate() must be implemented');
    }

    /**
     * Create new attendance record
     * @param {Attendance} attendance - Attendance entity
     * @returns {Promise<Attendance>}
     */
    async create(attendance) {
        throw new Error('Method create() must be implemented');
    }

    /**
     * Update attendance record
     * @param {number} id - Attendance ID
     * @param {Object} updates - Update data
     * @returns {Promise<Attendance>}
     */
    async update(id, updates) {
        throw new Error('Method update() must be implemented');
    }

    /**
     * Delete attendance record (soft delete)
     * @param {number} id - Attendance ID
     * @returns {Promise<boolean>}
     */
    async delete(id) {
        throw new Error('Method delete() must be implemented');
    }

    /**
     * Count attendance records by filters
     * @param {Object} filters - Filter criteria
     * @returns {Promise<number>}
     */
    async count(filters) {
        throw new Error('Method count() must be implemented');
    }

    /**
     * Check if attendance exists for NIP and date
     * @param {string} nip - Employee NIP
     * @param {Date} date - Date to check
     * @returns {Promise<boolean>}
     */
    async exists(nip, date) {
        throw new Error('Method exists() must be implemented');
    }

    /**
     * Get attendance summary statistics
     * @param {Object} filters - Filter criteria
     * @returns {Promise<Object>}
     */
    async getSummaryStats(filters) {
        throw new Error('Method getSummaryStats() must be implemented');
    }
}

module.exports = IAttendanceRepository;
