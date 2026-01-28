// src/domain/repositories/IAdminRepository.js
// Repository interface for Admin domain

/**
 * Interface for Admin Repository
 * All concrete implementations must implement these methods
 */
class IAdminRepository {
    /**
     * Find admin by ID
     * @param {number} id - Admin ID
     * @returns {Promise<Admin|null>}
     */
    async findById(id) {
        throw new Error('Method findById() must be implemented');
    }

    /**
     * Find admin by email
     * @param {string} email - Admin email
     * @returns {Promise<Admin|null>}
     */
    async findByEmail(email) {
        throw new Error('Method findByEmail() must be implemented');
    }

    /**
     * Find admin by username
     * @param {string} username - Admin username
     * @returns {Promise<Admin|null>}
     */
    async findByUsername(username) {
        throw new Error('Method findByUsername() must be implemented');
    }

    /**
     * Find all admins with filters
     * @param {Object} filters - Filter criteria
     * @param {string} filters.role - Filter by role
     * @param {boolean} filters.isActive - Filter by active status
     * @returns {Promise<Array<Admin>>}
     */
    async findAll(filters) {
        throw new Error('Method findAll() must be implemented');
    }

    /**
     * Create new admin
     * @param {Admin} admin - Admin entity
     * @returns {Promise<Admin>}
     */
    async create(admin) {
        throw new Error('Method create() must be implemented');
    }

    /**
     * Update admin
     * @param {number} id - Admin ID
     * @param {Object} updates - Update data
     * @returns {Promise<Admin>}
     */
    async update(id, updates) {
        throw new Error('Method update() must be implemented');
    }

    /**
     * Delete admin
     * @param {number} id - Admin ID
     * @returns {Promise<boolean>}
     */
    async delete(id) {
        throw new Error('Method delete() must be implemented');
    }

    /**
     * Update last login timestamp
     * @param {number} id - Admin ID
     * @returns {Promise<boolean>}
     */
    async updateLastLogin(id) {
        throw new Error('Method updateLastLogin() must be implemented');
    }

    /**
     * Check if email exists
     * @param {string} email - Email to check
     * @param {number} excludeId - Exclude this ID from check (for updates)
     * @returns {Promise<boolean>}
     */
    async emailExists(email, excludeId = null) {
        throw new Error('Method emailExists() must be implemented');
    }
}

module.exports = IAdminRepository;
