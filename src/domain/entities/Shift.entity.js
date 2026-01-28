// src/domain/entities/Shift.entity.js
// Pure business entity for work shifts

class Shift {
    /**
     * Create a Shift entity
     * @param {Object} data - Shift data
     */
    constructor(data) {
        this.id = data.id;
        this.namaShift = data.namaShift;
        this.jamMasuk = data.jamMasuk;
        this.jamKeluar = data.jamKeluar;
        this.deskripsi = data.deskripsi;
        this.isActive = data.isActive !== undefined ? data.isActive : true;
        this.createdAt = data.createdAt;
        this.updatedAt = data.updatedAt;

        this.validate();
    }

    /**
     * Validate shift data
     * @throws {Error} if validation fails
     */
    validate() {
        if (!this.namaShift || this.namaShift.trim() === '') {
            throw new Error('Shift name is required');
        }

        if (!this.jamMasuk) {
            throw new Error('Start time is required');
        }

        if (!this.jamKeluar) {
            throw new Error('End time is required');
        }
    }

    /**
     * Business rule: Calculate shift duration in hours
     * @returns {number} Duration in hours
     */
    getDurationHours() {
        const startMinutes = this.parseTimeToMinutes(this.jamMasuk);
        const endMinutes = this.parseTimeToMinutes(this.jamKeluar);

        let duration = endMinutes - startMinutes;

        // Handle overnight shifts
        if (duration < 0) {
            duration += 24 * 60; // Add 24 hours worth of minutes
        }

        return (duration / 60).toFixed(2);
    }

    /**
     * Business rule: Is this a night shift?
     * @returns {boolean}
     */
    isNightShift() {
        const startHour = this.parseTime(this.jamMasuk).getHours();
        // Night shift if starts after 6 PM or before 6 AM
        return startHour >= 18 || startHour < 6;
    }

    /**
     * Business rule: Is shift currently active?
     * @returns {boolean}
     */
    isActiveShift() {
        return this.isActive;
    }

    /**
     * Business rule: Check if given time falls within shift hours
     * @param {Date|string} time - Time to check
     * @returns {boolean}
     */
    isWithinShiftHours(time) {
        const checkMinutes = this.parseTimeToMinutes(time);
        const startMinutes = this.parseTimeToMinutes(this.jamMasuk);
        const endMinutes = this.parseTimeToMinutes(this.jamKeluar);

        // Handle overnight shifts
        if (endMinutes < startMinutes) {
            return checkMinutes >= startMinutes || checkMinutes <= endMinutes;
        }

        return checkMinutes >= startMinutes && checkMinutes <= endMinutes;
    }

    /**
     * Business rule: Calculate late time in minutes
     * @param {Date|string} attendanceTime - Actual attendance time
     * @param {number} toleranceMinutes - Allowed tolerance (default 0)
     * @returns {number} Minutes late (0 if not late)
     */
    calculateLateMinutes(attendanceTime, toleranceMinutes = 0) {
        const attendanceMinutes = this.parseTimeToMinutes(attendanceTime);
        const startMinutes = this.parseTimeToMinutes(this.jamMasuk);

        const lateness = attendanceMinutes - (startMinutes + toleranceMinutes);
        return lateness > 0 ? lateness : 0;
    }

    /**
     * Business rule: Deactivate shift
     */
    deactivate() {
        this.isActive = false;
        this.updatedAt = new Date();
    }

    /**
     * Business rule: Activate shift
     */
    activate() {
        this.isActive = true;
        this.updatedAt = new Date();
    }

    /**
     * Helper: Parse time to minutes since midnight
     * @private
     * @param {Date|string} time - Time value
     * @returns {number} Minutes since midnight
     */
    parseTimeToMinutes(time) {
        const date = this.parseTime(time);
        return date.getHours() * 60 + date.getMinutes();
    }

    /**
     * Helper: Parse time string to Date
     * @private
     * @param {Date|string} time - Time value
     * @returns {Date}
     */
    parseTime(time) {
        if (typeof time === 'string') {
            return new Date(`1970-01-01T${time}`);
        }
        return time;
    }

    /**
     * Convert entity to plain object
     * @returns {Object}
     */
    toObject() {
        return {
            id: this.id,
            namaShift: this.namaShift,
            jamMasuk: this.jamMasuk,
            jamKeluar: this.jamKeluar,
            deskripsi: this.deskripsi,
            isActive: this.isActive,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }
}

module.exports = Shift;
