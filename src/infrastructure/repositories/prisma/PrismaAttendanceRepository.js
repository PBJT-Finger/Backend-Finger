// src/infrastructure/repositories/prisma/PrismaAttendanceRepository.js
// Concrete implementation of IAttendanceRepository using Prisma

const IAttendanceRepository = require('../../../domain/repositories/IAttendanceRepository');
const Attendance = require('../../../domain/entities/Attendance.entity');
const { prisma } = require('../../database/prisma.client');

class PrismaAttendanceRepository extends IAttendanceRepository {
    /**
     * Map Prisma model to Domain Entity
     * @private
     * @param {Object} prismaAttendance - Prisma attendance model
     * @returns {Attendance}
     */
    toDomain(prismaAttendance) {
        if (!prismaAttendance) return null;

        return new Attendance({
            id: prismaAttendance.id,
            userId: prismaAttendance.user_id,
            nip: prismaAttendance.nip,
            nama: prismaAttendance.nama,
            jabatan: prismaAttendance.jabatan,
            tanggal: prismaAttendance.tanggal,
            jamMasuk: prismaAttendance.jam_masuk,
            jamKeluar: prismaAttendance.jam_keluar,
            deviceId: prismaAttendance.device_id,
            cloudId: prismaAttendance.cloud_id,
            verificationMethod: prismaAttendance.verification_method,
            status: prismaAttendance.status,
            isDeleted: prismaAttendance.is_deleted,
            createdAt: prismaAttendance.created_at,
            updatedAt: prismaAttendance.updated_at
        });
    }

    /**
     * Map Domain Entity to Prisma model
     * @private
     * @param {Attendance} attendance - Domain entity
     * @returns {Object}
     */
    toPrisma(attendance) {
        return {
            user_id: attendance.userId,
            nip: attendance.nip,
            nama: attendance.nama,
            jabatan: attendance.jabatan,
            tanggal: attendance.tanggal,
            jam_masuk: attendance.jamMasuk,
            jam_keluar: attendance.jamKeluar,
            device_id: attendance.deviceId,
            cloud_id: attendance.cloudId,
            verification_method: attendance.verificationMethod,
            status: attendance.status,
            is_deleted: attendance.isDeleted
        };
    }

    async findById(id) {
        const attendance = await prisma.attendance.findUnique({
            where: { id }
        });

        return this.toDomain(attendance);
    }

    async findByNIPAndDateRange(nip, startDate, endDate) {
        const records = await prisma.attendance.findMany({
            where: {
                nip,
                tanggal: {
                    gte: startDate,
                    lte: endDate
                },
                is_deleted: false
            },
            orderBy: { tanggal: 'asc' }
        });

        return records.map(rec => this.toDomain(rec));
    }

    async findByFilters(filters = {}) {
        const whereClause = { is_deleted: false };

        if (filters.nip) {
            whereClause.nip = filters.nip;
        }

        if (filters.jabatan) {
            whereClause.jabatan = filters.jabatan;
        }

        if (filters.status) {
            whereClause.status = filters.status;
        }

        if (filters.startDate && filters.endDate) {
            whereClause.tanggal = {
                gte: filters.startDate,
                lte: filters.endDate
            };
        } else if (filters.startDate) {
            whereClause.tanggal = { gte: filters.startDate };
        } else if (filters.endDate) {
            whereClause.tanggal = { lte: filters.endDate };
        }

        const records = await prisma.attendance.findMany({
            where: whereClause,
            orderBy: [
                { tanggal: 'desc' },
                { jam_masuk: 'asc' }
            ]
        });

        return records.map(rec => this.toDomain(rec));
    }

    async findByNIPAndDate(nip, date) {
        const attendance = await prisma.attendance.findFirst({
            where: {
                nip,
                tanggal: date,
                is_deleted: false
            }
        });

        return this.toDomain(attendance);
    }

    async create(attendance) {
        const created = await prisma.attendance.create({
            data: this.toPrisma(attendance)
        });

        return this.toDomain(created);
    }

    async update(id, updates) {
        const updated = await prisma.attendance.update({
            where: { id },
            data: {
                ...updates,
                updated_at: new Date()
            }
        });

        return this.toDomain(updated);
    }

    async delete(id) {
        // Soft delete
        await prisma.attendance.update({
            where: { id },
            data: {
                is_deleted: true,
                updated_at: new Date()
            }
        });

        return true;
    }

    async count(filters = {}) {
        const whereClause = { is_deleted: false };

        if (filters.nip) {
            whereClause.nip = filters.nip;
        }

        if (filters.jabatan) {
            whereClause.jabatan = filters.jabatan;
        }

        if (filters.status) {
            whereClause.status = filters.status;
        }

        if (filters.startDate && filters.endDate) {
            whereClause.tanggal = {
                gte: filters.startDate,
                lte: filters.endDate
            };
        }

        return await prisma.attendance.count({ where: whereClause });
    }

    async exists(nip, date) {
        const record = await prisma.attendance.findFirst({
            where: {
                nip,
                tanggal: date,
                is_deleted: false
            }
        });

        return record !== null;
    }

    async getSummaryStats(filters = {}) {
        const whereClause = { is_deleted: false };

        if (filters.nip) {
            whereClause.nip = filters.nip;
        }

        if (filters.jabatan) {
            whereClause.jabatan = filters.jabatan;
        }

        if (filters.startDate && filters.endDate) {
            whereClause.tanggal = {
                gte: filters.startDate,
                lte: filters.endDate
            };
        }

        // Get aggregated statistics
        const stats = await prisma.attendance.groupBy({
            by: ['status'],
            where: whereClause,
            _count: {
                id: true
            }
        });

        // Transform to more usable format
        const result = {
            total: 0,
            byStatus: {}
        };

        stats.forEach(stat => {
            result.byStatus[stat.status] = stat._count.id;
            result.total += stat._count.id;
        });

        return result;
    }
}

module.exports = PrismaAttendanceRepository;
