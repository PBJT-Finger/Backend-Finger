// src/domain/entities/Admin.entity.js
// Pure business entity for admin users

class Admin {
    /**
     * Create an Admin entity
     * @param {Object} data - Admin data
     */
    constructor(data) {
        this.id = data.id;
        this.username = data.username;
        this.passwordHash = data.passwordHash;
        this.email = data.email;
        this.fullName = data.fullName;
        this.role = data.role || 'ADMIN';
        this.isActive = data.isActive !== undefined ? data.isActive : true;
        this.lastLogin = data.lastLogin;
        this.createdAt = data.createdAt;
        this.updatedAt = data.updatedAt;

        this.validate();
    }

    /**
     * Validate admin data
     * @throws {Error} if validation fails
     */
    validate() {
        if (!this.email || this.email.trim() === '') {
            throw new Error('Email is required');
        }

        if (!this.isValidEmail(this.email)) {
            throw new Error('Invalid email format');
        }

        if (!this.passwordHash) {
            throw new Error('Password hash is required');
        }

        const validRoles = ['ADMIN', 'SUPER_ADMIN', 'OPERATOR'];
        if (!validRoles.includes(this.role)) {
            throw new Error('Invalid role');
        }
    }

    /**
     * Business rule: Can admin access specific resource?
     * @param {string} resource - Resource name
     * @returns {boolean}
     */
    canAccess(resource) {
        if (!this.isActive) return false;

        // Super admin has access to everything
        if (this.role === 'SUPER_ADMIN') return true;

        // Define access control rules
        const accessRules = {
            'ADMIN': ['attendance', 'employees', 'dashboard', 'export'],
            'OPERATOR': ['attendance', 'dashboard']
        };

        const allowedResources = accessRules[this.role] || [];
        return allowedResources.includes(resource);
    }

    /**
     * Business rule: Can admin manage other admins?
     * @returns {boolean}
     */
    canManageAdmins() {
        return this.role === 'SUPER_ADMIN' && this.isActive;
    }

    /**
     * Business rule: Can admin delete records?
     * @returns {boolean}
     */
    canDeleteRecords() {
        return ['SUPER_ADMIN', 'ADMIN'].includes(this.role) && this.isActive;
    }

    /**
     * Business rule: Is admin account active?
     * @returns {boolean}
     */
    isActiveAdmin() {
        return this.isActive;
    }

    /**
     * Business rule: Update last login timestamp
     */
    updateLastLogin() {
        this.lastLogin = new Date();
        this.updatedAt = new Date();
    }

    /**
     * Business rule: Deactivate admin account
     */
    deactivate() {
        this.isActive = false;
        this.updatedAt = new Date();
    }

    /**
     * Business rule: Activate admin account
     */
    activate() {
        this.isActive = true;
        this.updatedAt = new Date();
    }

    /**
     * Helper: Validate email format
     * @private
     * @param {string} email
     * @returns {boolean}
     */
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    /**
     * Convert entity to plain object (without sensitive data)
     * @param {boolean} includeSensitive - Include password hash
     * @returns {Object}
     */
    toObject(includeSensitive = false) {
        const obj = {
            id: this.id,
            username: this.username,
            email: this.email,
            fullName: this.fullName,
            role: this.role,
            isActive: this.isActive,
            lastLogin: this.lastLogin,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };

        if (includeSensitive) {
            obj.passwordHash = this.passwordHash;
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
            username: this.username,
            email: this.email,
            fullName: this.fullName,
            role: this.role,
            isActive: this.isActive,
            lastLogin: this.lastLogin
        };
    }
}

module.exports = Admin;
