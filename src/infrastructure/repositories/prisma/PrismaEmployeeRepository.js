// src/infrastructure/repositories/prisma/PrismaEmployeeRepository.js
// Concrete implementation of IEmployeeRepository using Prisma

const IEmployeeRepository = require('../../../domain/repositories/IEmployeeRepository');
const Employee = require('../../../domain/entities/Employee.entity');
const { prisma } = require('../../database/prisma.client');

class PrismaEmployeeRepository extends IEmployeeRepository {
    /**
     * Map Prisma model to Domain Entity
     * @private
     * @param {Object} pris maEmployee - Prismaemployee model
     * @returns {Employee}
     */
    toDomain(prismaEmployee) {
        if (!prismaEmployee) return null;

        return new Employee({
            id: prismaEmployee.id,
            nip: prismaEmployee.nip,
            nama: prismaEmployee.nama,
            jabatan: prismaEmployee.jabatan,
            shiftId: prismaEmployee.shift_id,
            status: prismaEmployee.status,
            tanggalMasuk: prismaEmployee.tanggal_masuk,
            isActive: prismaEmployee.is_active,
            createdAt: prismaEmployee.created_at,
            updatedAt: prismaEmployee.updated_at
        });
    }

    /**
     * Map Domain Entity to Prisma model
     * @private
     * @param {Employee} employee - Domain entity
     * @returns {Object}
     */
    toPrisma(employee) {
        return {
            nip: employee.nip,
            nama: employee.nama,
            jabatan: employee.jabatan,
            shift_id: employee.shiftId,
            status: employee.status,
            tanggal_masuk: employee.tanggalMasuk,
            is_active: employee.isActive
        };
    }

    async findByNIP(nip) {
        const employee = await prisma.employees.findUnique({
            where: { nip },
            include: { shifts: true }
        });

        return this.toDomain(employee);
    }

    async findByFilters(filters = {}) {
        const whereClause = {};

        if (filters.nip) {
            whereClause.nip = filters.nip;
        }

        if (filters.jabatan) {
            whereClause.jabatan = filters.jabatan;
        }

        if (filters.status) {
            whereClause.status = filters.status;
        }

        if (filters.isActive !== undefined) {
            whereClause.is_active = filters.isActive;
        } else {
            // Default to active only
            whereClause.is_active = true;
        }

        const employees = await prisma.employees.findMany({
            where: whereClause,
            include: { shifts: true },
            orderBy: { nama: 'asc' }
        });

        return employees.map(emp => this.toDomain(emp));
    }

    async findAllActive() {
        const employees = await prisma.employees.findMany({
            where: {
                is_active: true,
                status: 'AKTIF'
            },
            include: { shifts: true },
            orderBy: { nama: 'asc' }
        });

        return employees.map(emp => this.toDomain(emp));
    }

    async findById(id) {
        const employee = await prisma.employees.findUnique({
            where: { id },
            include: { shifts: true }
        });

        return this.toDomain(employee);
    }

    async create(employee) {
        const created = await prisma.employees.create({
            data: this.toPrisma(employee),
            include: { shifts: true }
        });

        return this.toDomain(created);
    }

    async update(id, updates) {
        const updated = await prisma.employees.update({
            where: { id },
            data: {
                ...updates,
                updated_at: new Date()
            },
            include: { shifts: true }
        });

        return this.toDomain(updated);
    }

    async delete(id) {
        // Soft delete
        await prisma.employees.update({
            where: { id },
            data: {
                is_active: false,
                updated_at: new Date()
            }
        });

        return true;
    }

    async count(filters = {}) {
        const whereClause = {};

        if (filters.jabatan) {
            whereClause.jabatan = filters.jabatan;
        }

        if (filters.status) {
            whereClause.status = filters.status;
        }

        if (filters.isActive !== undefined) {
            whereClause.is_active = filters.isActive;
        }

        return await prisma.employees.count({ where: whereClause });
    }
}

module.exports = PrismaEmployeeRepository;
