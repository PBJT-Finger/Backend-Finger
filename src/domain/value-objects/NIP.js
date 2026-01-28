// src/domain/value-objects/NIP.js
// Value Object for Employee Identification Number

class NIP {
    /**
     * Create a NIP value object
     * @param {string} value - NIP value
     */
    constructor(value) {
        this.value = value;
        this.validate();
    }

    /**
     * Validate NIP format and rules
     * @throws {Error} if validation fails
     */
    validate() {
        if (!this.value || typeof this.value !== 'string') {
            throw new Error('NIP must be a string');
        }

        const trimmed = this.value.trim();
        if (trimmed === '') {
            throw new Error('NIP cannot be empty');
        }

        // NIP should not be too long (max 50 chars as per schema)
        if (trimmed.length > 50) {
            throw new Error('NIP cannot exceed 50 characters');
        }

        // NIP should not contain special characters except dash and underscore
        const validPattern = /^[a-zA-Z0-9\-_]+$/;
        if (!validPattern.test(trimmed)) {
            throw new Error('NIP can only contain alphanumeric characters, dashes, and underscores');
        }
    }

    /**
     * Get the NIP value
     * @returns {string}
     */
    getValue() {
        return this.value.trim();
    }

    /**
     * Check equality with another NIP
     * @param {NIP} other - Another NIP instance
     * @returns {boolean}
     */
    equals(other) {
        if (!(other instanceof NIP)) return false;
        return this.getValue() === other.getValue();
    }

    /**
     * Get formatted NIP (trimmed and uppercase)
     * @returns {string}
     */
    format() {
        return this.getValue().toUpperCase();
    }

    /**
     * Convert to string
     * @returns {string}
     */
    toString() {
        return this.getValue();
    }

    /**
     * Create NIP from string
     * @static
     * @param {string} value
     * @returns {NIP}
     */
    static create(value) {
        return new NIP(value);
    }
}

module.exports = NIP;
