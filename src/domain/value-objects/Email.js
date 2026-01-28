// src/domain/value-objects/Email.js
// Value Object for Email Address

class Email {
    /**
     * Create an Email value object
     * @param {string} value - Email address
     */
    constructor(value) {
        this.value = value;
        this.validate();
    }

    /**
     * Validate email format
     * @throws {Error} if validation fails
     */
    validate() {
        if (!this.value || typeof this.value !== 'string') {
            throw new Error('Email must be a string');
        }

        const trimmed = this.value.trim();
        if (trimmed === '') {
            throw new Error('Email cannot be empty');
        }

        // Email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(trimmed)) {
            throw new Error('Invalid email format');
        }

        // Maximum length check (100 chars as per schema)
        if (trimmed.length > 100) {
            throw new Error('Email cannot exceed 100 characters');
        }
    }

    /**
     * Get the email value
     * @returns {string}
     */
    getValue() {
        return this.value.trim().toLowerCase();
    }

    /**
     * Get email domain
     * @returns {string}
     */
    getDomain() {
        return this.getValue().split('@')[1];
    }

    /**
     * Get email username/local part
     * @returns {string}
     */
    getUsername() {
        return this.getValue().split('@')[0];
    }

    /**
     * Check if email is from specific domain
     * @param {string} domain - Domain to check
     * @returns {boolean}
     */
    isFromDomain(domain) {
        return this.getDomain() === domain.toLowerCase();
    }

    /**
     * Check equality with another Email
     * @param {Email} other - Another Email instance
     * @returns {boolean}
     */
    equals(other) {
        if (!(other instanceof Email)) return false;
        return this.getValue() === other.getValue();
    }

    /**
     * Convert to string
     * @returns {string}
     */
    toString() {
        return this.getValue();
    }

    /**
     * Create Email from string
     * @static
     * @param {string} value
     * @returns {Email}
     */
    static create(value) {
        return new Email(value);
    }
}

module.exports = Email;
