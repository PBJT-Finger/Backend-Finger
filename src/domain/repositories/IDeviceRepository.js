// src/domain/repositories/IDeviceRepository.js
// Repository interface for Device domain

/**
 * Interface for Device Repository
 * All concrete implementations must implement these methods
 */
class IDeviceRepository {
    /**
     * Find device by ID
     * @param {number} id - Device ID
     * @returns {Promise<Device|null>}
     */
    async findById(id) {
        throw new Error('Method findById() must be implemented');
    }

    /**
     * Find device by device ID
     * @param {string} deviceId - Device unique ID
     * @returns {Promise<Device|null>}
     */
    async findByDeviceId(deviceId) {
        throw new Error('Method findByDeviceId() must be implemented');
    }

    /**
     * Find all devices with filters
     * @param {Object} filters - Filter criteria
     * @param {boolean} filters.isActive - Filter by active status
     * @param {string} filters.location - Filter by location
     * @returns {Promise<Array<Device>>}
     */
    async findAll(filters) {
        throw new Error('Method findAll() must be implemented');
    }

    /**
     * Find all active devices
     * @returns {Promise<Array<Device>>}
     */
    async findAllActive() {
        throw new Error('Method findAllActive() must be implemented');
    }

    /**
     * Create new device
     * @param {Device} device - Device entity
     * @returns {Promise<Device>}
     */
    async create(device) {
        throw new Error('Method create() must be implemented');
    }

    /**
     * Update device
     * @param {number} id - Device ID
     * @param {Object} updates - Update data
     * @returns {Promise<Device>}
     */
    async update(id, updates) {
        throw new Error('Method update() must be implemented');
    }

    /**
     * Delete device
     * @param {number} id - Device ID
     * @returns {Promise<boolean>}
     */
    async delete(id) {
        throw new Error('Method delete() must be implemented');
    }

    /**
     * Check if device ID exists
     * @param {string} deviceId - Device ID to check
     * @param {number} excludeId - Exclude this ID from check (for updates)
     * @returns {Promise<boolean>}
     */
    async deviceIdExists(deviceId, excludeId = null) {
        throw new Error('Method deviceIdExists() must be implemented');
    }

    /**
     * Verify device API key
     * @param {string} deviceId - Device ID
     * @param {string} apiKeyHash - Hashed API key
     * @returns {Promise<boolean>}
     */
    async verifyApiKey(deviceId, apiKeyHash) {
        throw new Error('Method verifyApiKey() must be implemented');
    }
}

module.exports = IDeviceRepository;
