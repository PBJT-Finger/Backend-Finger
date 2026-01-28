// src/domain/value-objects/TimeRange.js
// Value Object for Date/Time Range

class TimeRange {
    /**
     * Create a TimeRange value object
     * @param {Date} startDate - Start date
     * @param {Date} endDate - End date
     */
    constructor(startDate, endDate) {
        this.startDate = startDate instanceof Date ? startDate : new Date(startDate);
        this.endDate = endDate instanceof Date ? endDate : new Date(endDate);
        this.validate();
    }

    /**
     * Validate time range
     * @throws {Error} if validation fails
     */
    validate() {
        if (!(this.startDate instanceof Date) || isNaN(this.startDate)) {
            throw new Error('Invalid start date');
        }

        if (!(this.endDate instanceof Date) || isNaN(this.endDate)) {
            throw new Error('Invalid end date');
        }

        if (this.startDate > this.endDate) {
            throw new Error('Start date must be before or equal to end date');
        }
    }

    /**
     * Get start date
     * @returns {Date}
     */
    getStartDate() {
        return this.startDate;
    }

    /**
     * Get end date
     * @returns {Date}
     */
    getEndDate() {
        return this.endDate;
    }

    /**
     * Calculate duration in days
     * @returns {number}
     */
    getDurationInDays() {
        const diffTime = Math.abs(this.endDate - this.startDate);
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end days
    }

    /**
     * Calculate working days (exclude weekends)
     * @returns {number}
     */
    getWorkingDays() {
        let workingDays = 0;
        const currentDate = new Date(this.startDate);

        while (currentDate <= this.endDate) {
            const dayOfWeek = currentDate.getDay();
            // Exclude Sunday (0) and Saturday (6)
            if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                workingDays++;
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }

        return workingDays;
    }

    /**
     * Check if a date falls within this range
     * @param {Date} date - Date to check
     * @returns {boolean}
     */
    contains(date) {
        const checkDate = date instanceof Date ? date : new Date(date);
        return checkDate >= this.startDate && checkDate <= this.endDate;
    }

    /**
     * Check if range overlaps with another range
     * @param {TimeRange} other - Another TimeRange instance
     * @returns {boolean}
     */
    overlaps(other) {
        if (!(other instanceof TimeRange)) {
            throw new Error('Parameter must be a TimeRange instance');
        }

        return this.startDate <= other.endDate && this.endDate >= other.startDate;
    }

    /**
     * Get formatted date range string
     * @param {string} format - Format (default 'YYYY-MM-DD')
     * @returns {string}
     */
    format(format = 'YYYY-MM-DD') {
        const formatDate = (date) => {
            if (format === 'DD/MM/YYYY') {
                const day = String(date.getDate()).padStart(2, '0');
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const year = date.getFullYear();
                return `${day}/${month}/${year}`;
            } else {
                // Default YYYY-MM-DD
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            }
        };

        return `${formatDate(this.startDate)} - ${formatDate(this.endDate)}`;
    }

    /**
     * Check equality with another TimeRange
     * @param {TimeRange} other - Another TimeRange instance
     * @returns {boolean}
     */
    equals(other) {
        if (!(other instanceof TimeRange)) return false;
        return this.startDate.getTime() === other.startDate.getTime() &&
            this.endDate.getTime() === other.endDate.getTime();
    }

    /**
     * Convert to plain object
     * @returns {Object}
     */
    toObject() {
        return {
            startDate: this.startDate,
            endDate: this.endDate,
            durationInDays: this.getDurationInDays(),
            workingDays: this.getWorkingDays()
        };
    }

    /**
     * Create TimeRange from strings
     * @static
     * @param {string} startDate
     * @param {string} endDate
     * @returns {TimeRange}
     */
    static create(startDate, endDate) {
        return new TimeRange(startDate, endDate);
    }

    /**
     * Create TimeRange for current month
     * @static
     * @returns {TimeRange}
     */
    static currentMonth() {
        const now = new Date();
        const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        return new TimeRange(startDate, endDate);
    }

    /**
     * Create TimeRange for current week
     * @static
     * @returns {TimeRange}
     */
    static currentWeek() {
        const now = new Date();
        const dayOfWeek = now.getDay();
        const startDate = new Date(now);
        startDate.setDate(now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)); // Monday
        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6); // Sunday
        return new TimeRange(startDate, endDate);
    }
}

module.exports = TimeRange;
