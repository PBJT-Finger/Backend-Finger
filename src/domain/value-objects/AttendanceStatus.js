// src/domain/value-objects/AttendanceStatus.js
// Value Object for Attendance Status

class AttendanceStatus {
    static HADIR = 'HADIR';
    static TERLAMBAT = 'TERLAMBAT';
    static IZIN = 'IZIN';
    static SAKIT = 'SAKIT';
    static ALPHA = 'ALPHA';
    static CUTI = 'CUTI';

    static ALL_STATUSES = [
        AttendanceStatus.HADIR,
        AttendanceStatus.TERLAMBAT,
        AttendanceStatus.IZIN,
        AttendanceStatus.SAKIT,
        AttendanceStatus.ALPHA,
        AttendanceStatus.CUTI
    ];

    /**
     * Create an AttendanceStatus value object
     * @param {string} value - Status value
     */
    constructor(value) {
        this.value = value;
        this.validate();
    }

    /**
     * Validate status value
     * @throws {Error} if validation fails
     */
    validate() {
        if (!this.value || typeof this.value !== 'string') {
            throw new Error('Status must be a string');
        }

        const upperValue = this.value.toUpperCase();
        if (!AttendanceStatus.ALL_STATUSES.includes(upperValue)) {
            throw new Error(`Invalid status. Must be one of: ${AttendanceStatus.ALL_STATUSES.join(', ')}`);
        }
    }

    /**
     * Get the status value
     * @returns {string}
     */
    getValue() {
        return this.value.toUpperCase();
    }

    /**
     * Check if status is present (HADIR or TERLAMBAT)
     * @returns {boolean}
     */
    isPresent() {
        const value = this.getValue();
        return value === AttendanceStatus.HADIR || value === AttendanceStatus.TERLAMBAT;
    }

    /**
     * Check if status is absent
     * @returns {boolean}
     */
    isAbsent() {
        const value = this.getValue();
        return value === AttendanceStatus.ALPHA;
    }

    /**
     * Check if status is excused
     * @returns {boolean}
     */
    isExcused() {
        const value = this.getValue();
        return value === AttendanceStatus.IZIN ||
            value === AttendanceStatus.SAKIT ||
            value === AttendanceStatus.CUTI;
    }

    /**
     * Check if status is late
     * @returns {boolean}
     */
    isLate() {
        return this.getValue() === AttendanceStatus.TERLAMBAT;
    }

    /**
     * Get status display name in Indonesian
     * @returns {string}
     */
    getDisplayName() {
        const displayNames = {
            [AttendanceStatus.HADIR]: 'Hadir',
            [AttendanceStatus.TERLAMBAT]: 'Terlambat',
            [AttendanceStatus.IZIN]: 'Izin',
            [AttendanceStatus.SAKIT]: 'Sakit',
            [AttendanceStatus.ALPHA]: 'Alpha',
            [AttendanceStatus.CUTI]: 'Cuti'
        };

        return displayNames[this.getValue()] || this.getValue();
    }

    /**
     * Get status color for UI (hex color code)
     * @returns {string}
     */
    getColorCode() {
        const colors = {
            [AttendanceStatus.HADIR]: '#22c55e',        // Green
            [AttendanceStatus.TERLAMBAT]: '#eab308',   // Yellow
            [AttendanceStatus.IZIN]: '#3b82f6',        // Blue
            [AttendanceStatus.SAKIT]: '#f97316',       // Orange
            [AttendanceStatus.ALPHA]: '#ef4444',       // Red
            [AttendanceStatus.CUTI]: '#8b5cf6'         // Purple
        };

        return colors[this.getValue()] || '#6b7280'; // Gray as default
    }

    /**
     * Check equality with another AttendanceStatus
     * @param {AttendanceStatus} other - Another AttendanceStatus instance
     * @returns {boolean}
     */
    equals(other) {
        if (!(other instanceof AttendanceStatus)) return false;
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
     * Convert to object with metadata
     * @returns {Object}
     */
    toObject() {
        return {
            value: this.getValue(),
            displayName: this.getDisplayName(),
            colorCode: this.getColorCode(),
            isPresent: this.isPresent(),
            isAbsent: this.isAbsent(),
            isExcused: this.isExcused()
        };
    }

    /**
     * Create AttendanceStatus from string
     * @static
     * @param {string} value
     * @returns {AttendanceStatus}
     */
    static create(value) {
        return new AttendanceStatus(value);
    }

    /**
     * Get all valid statuses
     * @static
     * @returns {Array<string>}
     */
    static getAll() {
        return AttendanceStatus.ALL_STATUSES;
    }

    /**
     * Check if a value is a valid status
     * @static
     * @param {string} value
     * @returns {boolean}
     */
    static isValid(value) {
        if (!value || typeof value !== 'string') return false;
        return AttendanceStatus.ALL_STATUSES.includes(value.toUpperCase());
    }
}

module.exports = AttendanceStatus;
