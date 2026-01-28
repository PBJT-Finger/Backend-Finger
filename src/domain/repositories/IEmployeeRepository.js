// src/domain/repositories/IEmployeeRepository.js
// Repository interface for Employee domain

/**
 * Interface for Employee Repository
 * All concrete implementations must implement these methods
 */
class IEmployeeRepository {
    /**
     * Find employee by NIP
     * @param {string} nip - Employee NIP
     * @returns {Promise<Employee|null>}
     */
    async findByNIP(nip) {
        throw new Error('Method findByNIP() must be implemented');
    }

    /**
     * Find employees by filters
     * @param {Object} filters - Filter criteria
     * @param {string} filters.nip - Filter by NIP
     * @param {string} filters.jabatan - Filter by position (DOSEN/KARYAWAN)
     * @param {string} filters.status - Filter by status
     * @param {boolean} filters.isActive - Filter by active status
     * @returns {Promise<Array<Employee>>}
     */
    async findByFilters(filters) {
        throw new Error('Method findByFilters() must be implemented');
    }

    /**
     * Find all active employees
     * @returns {Promise<Array<Employee>>}
     */
    async findAllActive() {
        throw new Error('Method findAllActive() must be implemented');
    }

    /**
     * Find employee by ID
     * @param {number} id - Employee ID
     * @returns {Promise<Employee|null>}
     */
    async findById(id) {
        throw new Error('Method findById() must be implemented');
    }

    /**
     * Create new employee
     * @param {Employee} employee - Employee entity
     * @returns {Promise<Employee>}
     */
    async create(employee) {
        throw new Error('Method create() must be implemented');
    }

    /**
     * Update employee
     * @param {number} id - Employee ID
     * @param {Object} updates - Update data
     * @returns {Promise<Employee>}
     */
    async update(id, updates) {
        throw new Error('Method update() must be implemented');
    }

    /**
     * Delete employee (soft delete)
     * @param {number} id - Employee ID
     * @returns {Promise<boolean>}
     */
    async delete(id) {
        throw new Error('Method delete() must be implemented');
    }

    /**
     * Count employees by filters
     * @param {Object} filters - Filter criteria
     * @returns {Promise<number>}
     */
    async count(filters) {
        throw new Error('Method count() must be implemented');
    }
}

module.exports = IEmployeeRepository;
