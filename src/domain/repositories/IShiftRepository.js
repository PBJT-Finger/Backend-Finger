// src/domain/repositories/IShiftRepository.js
// Repository interface for Shift domain

/**
 * Interface for Shift Repository
 * All concrete implementations must implement these methods
 */
class IShiftRepository {
    /**
     * Find shift by ID
     * @param {number} id - Shift ID
     * @returns {Promise<Shift|null>}
     */
    async findById(id) {
        throw new Error('Method findById() must be implemented');
    }

    /**
     * Find all shifts with filters
     * @param {Object} filters - Filter criteria
     * @param {boolean} filters.isActive - Filter by active status
     * @returns {Promise<Array<Shift>>}
     */
    async findAll(filters) {
        throw new Error('Method findAll() must be implemented');
    }

    /**
     * Find all active shifts
     * @returns {Promise<Array<Shift>>}
     */
    async findAllActive() {
        throw new Error('Method findAllActive() must be implemented');
    }

    /**
     * Create new shift
     * @param {Shift} shift - Shift entity
     * @returns {Promise<Shift>}
     */
    async create(shift) {
        throw new Error('Method create() must be implemented');
    }

    /**
     * Update shift
     * @param {number} id - Shift ID
     * @param {Object} updates - Update data
     * @returns {Promise<Shift>}
     */
    async update(id, updates) {
        throw new Error('Method update() must be implemented');
    }

    /**
     * Delete shift
     * @param {number} id - Shift ID
     * @returns {Promise<boolean>}
     */
    async delete(id) {
        throw new Error('Method delete() must be implemented');
    }
}

module.exports = IShiftRepository;
