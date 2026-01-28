// src/domain/entities/Attendance.entity.js
// Pure business entity for attendance records

class Attendance {
    /**
     * Create an Attendance entity
     * @param {Object} data - Attendance data
     */
    constructor(data) {
        this.id = data.id;
        this.userId = data.userId;
        this.nip = data.nip;
        this.nama = data.nama;
        this.jabatan = data.jabatan;
        this.tanggal = data.tanggal;
        this.jamMasuk = data.jamMasuk;
        this.jamKeluar = data.jamKeluar;
        this.deviceId = data.deviceId;
        this.cloudId = data.cloudId;
        this.verificationMethod = data.verificationMethod || 'SIDIK_JARI';
        this.status = data.status || 'HADIR';
        this.isDeleted = data.isDeleted || false;
        this.createdAt = data.createdAt;
        this.updatedAt = data.updatedAt;

        this.validate();
    }

    /**
     * Validate attendance data
     * @throws {Error} if validation fails
     */
    validate() {
        if (!this.nip || this.nip.trim() === '') {
            throw new Error('NIP is required');
        }

        if (!this.nama || this.nama.trim() === '') {
            throw new Error('Nama is required');
        }

        if (!['DOSEN', 'KARYAWAN'].includes(this.jabatan)) {
            throw new Error('Jabatan must be either DOSEN or KARYAWAN');
        }

        if (!this.tanggal) {
            throw new Error('Tanggal is required');
        }

        const validStatuses = ['HADIR', 'TERLAMBAT', 'IZIN', 'SAKIT', 'ALPHA', 'CUTI'];
        if (!validStatuses.includes(this.status)) {
            throw new Error('Invalid attendance status');
        }
    }

    /**
     * Business rule: Is this attendance record for a lecturer?
     * @returns {boolean}
     */
    isDosen() {
        return this.jabatan === 'DOSEN';
    }

    /**
     * Business rule: Is this attendance record for staff?
     * @returns {boolean}
     */
    isKaryawan() {
        return this.jabatan === 'KARYAWAN';
    }

    /**
     * Business rule: Is employee present?
     * @returns {boolean}
     */
    isPresent() {
        return this.jamMasuk !== null && !this.isDeleted;
    }

    /**
     * Business rule: Is employee late?
     * @returns {boolean}
     */
    isLate() {
        return this.status === 'TERLAMBAT';
    }

    /**
     * Business rule: Check if late based on shift time
     * @param {Date} shiftStartTime - Shift start time
     * @param {number} toleranceMinutes - Tolerance in minutes (default 0)
     * @returns {boolean}
     */
    isLateForShift(shiftStartTime, toleranceMinutes = 0) {
        if (!this.jamMasuk || !shiftStartTime) return false;

        // Convert times to comparable format
        const attendanceTime = this.parseTimeToMinutes(this.jamMasuk);
        const shiftTime = this.parseTimeToMinutes(shiftStartTime);

        return attendanceTime > (shiftTime + toleranceMinutes);
    }

    /**
     * Business rule: Calculate lateness duration in minutes
     * @param {Date} shiftStartTime - Shift start time
     * @returns {number} Minutes late (0 if not late)
     */
    getLateDurationMinutes(shiftStartTime) {
        if (!this.jamMasuk || !shiftStartTime) return 0;

        const attendanceTime = this.parseTimeToMinutes(this.jamMasuk);
        const shiftTime = this.parseTimeToMinutes(shiftStartTime);

        const lateness = attendanceTime - shiftTime;
        return lateness > 0 ? lateness : 0;
    }

    /**
     * Business rule: Calculate work duration
     * @returns {number|null} Work duration in hours, null if incomplete
     */
    getWorkDurationHours() {
        if (!this.jamMasuk || !this.jamKeluar) return null;

        const masuk = this.parseTimeToMinutes(this.jamMasuk);
        const keluar = this.parseTimeToMinutes(this.jamKeluar);

        const durationMinutes = keluar - masuk;
        return durationMinutes > 0 ? (durationMinutes / 60).toFixed(2) : 0;
    }

    /**
     * Business rule: Is attendance complete (has both check-in and check-out)?
     * @returns {boolean}
     */
    isComplete() {
        return this.jamMasuk !== null && this.jamKeluar !== null;
    }

    /**
     * Business rule: Is attendance on weekend?
     * @returns {boolean}
     */
    isWeekend() {
        const dayOfWeek = this.tanggal.getDay();
        return dayOfWeek === 0 || dayOfWeek === 6; // Sunday or Saturday
    }

    /**
     * Business rule: Soft delete attendance
     */
    softDelete() {
        this.isDeleted = true;
        this.updatedAt = new Date();
    }

    /**
     * Business rule: Restore soft deleted attendance
     */
    restore() {
        this.isDeleted = false;
        this.updatedAt = new Date();
    }

    /**
     * Helper: Parse time to minutes since midnight
     * @private
     * @param {Date|string} time - Time value
     * @returns {number} Minutes since midnight
     */
    parseTimeToMinutes(time) {
        let date;
        if (typeof time === 'string') {
            date = new Date(`1970-01-01T${time}`);
        } else {
            date = time;
        }

        return date.getHours() * 60 + date.getMinutes();
    }

    /**
     * Convert entity to plain object
     * @returns {Object}
     */
    toObject() {
        return {
            id: this.id,
            userId: this.userId,
            nip: this.nip,
            nama: this.nama,
            jabatan: this.jabatan,
            tanggal: this.tanggal,
            jamMasuk: this.jamMasuk,
            jamKeluar: this.jamKeluar,
            deviceId: this.deviceId,
            cloudId: this.cloudId,
            verificationMethod: this.verificationMethod,
            status: this.status,
            isDeleted: this.isDeleted,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }
}

module.exports = Attendance;
