// src/domain/entities/Employee.entity.js
// Pure business entity with no external dependencies

class Employee {
    /**
     * Create an Employee entity
     * @param {Object} data - Employee data
     * @param {number} data.id - Employee ID
     * @param {string} data.nip - Employee identification number
     * @param {string} data.nama - Employee name
     * @param {string} data.jabatan - Position (DOSEN or KARYAWAN)
     * @param {number} data.shiftId - Associated shift ID
     * @param {string} data.status - Employment status
     * @param {Date} data.tanggalMasuk - Start date
     * @param {boolean} data.isActive - Active status
     */
    constructor(data) {
        this.id = data.id;
        this.nip = data.nip;
        this.nama = data.nama;
        this.jabatan = data.jabatan;
        this.shiftId = data.shiftId;
        this.status = data.status || 'AKTIF';
        this.tanggalMasuk = data.tanggalMasuk;
        this.isActive = data.isActive !== undefined ? data.isActive : true;
        this.createdAt = data.createdAt;
        this.updatedAt = data.updatedAt;

        this.validate();
    }

    /**
     * Validate employee data
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

        if (!['AKTIF', 'CUTI', 'RESIGN', 'NON_AKTIF'].includes(this.status)) {
            throw new Error('Invalid status');
        }
    }

    /**
     * Business rule: Can employee work on specific shift?
     * @param {Object} shift - Shift entity
     * @returns {boolean}
     */
    canWorkOnShift(shift) {
        if (!this.shiftId) return false;
        return this.shiftId === shift.id;
    }

    /**
     * Business rule: Is employee currently active?
     * @returns {boolean}
     */
    isActiveEmployee() {
        return this.isActive && this.status === 'AKTIF';
    }

    /**
     * Business rule: Is employee a lecturer?
     * @returns {boolean}
     */
    isDosen() {
        return this.jabatan === 'DOSEN';
    }

    /**
     * Business rule: Is employee staff/karyawan?
     * @returns {boolean}
     */
    isKaryawan() {
        return this.jabatan === 'KARYAWAN';
    }

    /**
     * Business rule: Check if employee is on leave
     * @returns {boolean}
     */
    isOnLeave() {
        return this.status === 'CUTI';
    }

    /**
     * Business rule: Check if employee has resigned
     * @returns {boolean}
     */
    hasResigned() {
        return this.status === 'RESIGN';
    }

    /**
     * Business rule: Calculate tenure in days
     * @param {Date} currentDate - Current date for calculation
     * @returns {number} Days since start date
     */
    getTenureInDays(currentDate = new Date()) {
        if (!this.tanggalMasuk) return 0;
        const diffTime = Math.abs(currentDate - this.tanggalMasuk);
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    /**
     * Convert entity to plain object
     * @returns {Object}
     */
    toObject() {
        return {
            id: this.id,
            nip: this.nip,
            nama: this.nama,
            jabatan: this.jabatan,
            shiftId: this.shiftId,
            status: this.status,
            tanggalMasuk: this.tanggalMasuk,
            isActive: this.isActive,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }
}

module.exports = Employee;
