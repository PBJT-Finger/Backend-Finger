// src/domain/entities/Device.entity.js
// Pure business entity for fingerprint devices

class Device {
    /**
     * Create a Device entity
     * @param {Object} data - Device data
     */
    constructor(data) {
        this.id = data.id;
        this.deviceName = data.deviceName;
        this.deviceId = data.deviceId;
        this.ipAddress = data.ipAddress;
        this.location = data.location;
        this.apiKeyHash = data.apiKeyHash;
        this.isActive = data.isActive !== undefined ? data.isActive : true;
        this.createdAt = data.createdAt;
        this.updatedAt = data.updatedAt;

        this.validate();
    }

    /**
     * Validate device data
     * @throws {Error} if validation fails
     */
    validate() {
        if (!this.deviceName || this.deviceName.trim() === '') {
            throw new Error('Device name is required');
        }

        if (!this.deviceId || this.deviceId.trim() === '') {
            throw new Error('Device ID is required');
        }

        if (this.ipAddress && !this.isValidIP(this.ipAddress)) {
            throw new Error('Invalid IP address format');
        }
    }

    /**
     * Business rule: Is device currently active?
     * @returns {boolean}
     */
    isActiveDevice() {
        return this.isActive;
    }

    /**
     * Business rule: Can device push attendance data?
     * @returns {boolean}
     */
    canPushData() {
        return this.isActive && this.apiKeyHash !== null;
    }

    /**
     * Business rule: Verify API key
     * @param {string} providedKeyHash - Hashed API key from request
     * @returns {boolean}
     */
    verifyApiKey(providedKeyHash) {
        if (!this.isActive) return false;
        if (!this.apiKeyHash) return false;
        return this.apiKeyHash === providedKeyHash;
    }

    /**
     * Business rule: Update device API key
     * @param {string} newApiKeyHash - New hashed API key
     */
    updateApiKey(newApiKeyHash) {
        this.apiKeyHash = newApiKeyHash;
        this.updatedAt = new Date();
    }

    /**
     * Business rule: Update device location
     * @param {string} newLocation - New location
     */
    updateLocation(newLocation) {
        this.location = newLocation;
        this.updatedAt = new Date();
    }

    /**
     * Business rule: Update device IP address
     * @param {string} newIpAddress - New IP address
     */
    updateIpAddress(newIpAddress) {
        if (!this.isValidIP(newIpAddress)) {
            throw new Error('Invalid IP address format');
        }
        this.ipAddress = newIpAddress;
        this.updatedAt = new Date();
    }

    /**
     * Business rule: Deactivate device
     */
    deactivate() {
        this.isActive = false;
        this.updatedAt = new Date();
    }

    /**
     * Business rule: Activate device
     */
    activate() {
        this.isActive = true;
        this.updatedAt = new Date();
    }

    /**
     * Helper: Validate IP address format
     * @private
     * @param {string} ip - IP address
     * @returns {boolean}
     */
    isValidIP(ip) {
        // Basic IPv4 and IPv6 validation
        const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
        const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;

        if (ipv4Regex.test(ip)) {
            // Validate IPv4 octets are 0-255
            const octets = ip.split('.');
            return octets.every(octet => {
                const num = parseInt(octet, 10);
                return num >= 0 && num <= 255;
            });
        }

        return ipv6Regex.test(ip);
    }

    /**
     * Convert entity to plain object
     * @param {boolean} includeSensitive - Include API key hash
     * @returns {Object}
     */
    toObject(includeSensitive = false) {
        const obj = {
            id: this.id,
            deviceName: this.deviceName,
            deviceId: this.deviceId,
            ipAddress: this.ipAddress,
            location: this.location,
            isActive: this.isActive,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };

        if (includeSensitive) {
            obj.apiKeyHash = this.apiKeyHash;
        }

        return obj;
    }

    /**
     * Convert to safe object for API responses (no sensitive data)
     * @returns {Object}
     */
    toSafeObject() {
        return {
            id: this.id,
            deviceName: this.deviceName,
            deviceId: this.deviceId,
            ipAddress: this.ipAddress,
            location: this.location,
            isActive: this.isActive
        };
    }
}

module.exports = Device;
