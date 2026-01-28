// src/controllers/attendance.controller.clean.js
// CLEAN ARCHITECTURE VERSION - Thin controller using use cases
// This is the new version that demonstrates clean architecture principles

const { successResponse, errorResponse } = require('../utils/responseFormatter');
const logger = require('../utils/logger');
const container = require('../infrastructure/container/container');

class AttendanceController {
    /**
     * Get attendance summary (clean architecture version)
     * GET /api/attendance/summary?start_date=X&end_date=Y&nip=Z&jabatan=DOSEN
     */
    static async getAttendanceSummary(req, res) {
        try {
            // 1. Parse and validate request
            const { start_date, end_date, nip, jabatan } = req.query;

            if (!start_date || !end_date) {
                return errorResponse(res, 'start_date and end_date are required', 400);
            }

            // 2. Prepare filters for use case
            const filters = {
                startDate: new Date(start_date),
                endDate: new Date(end_date),
                nip,
                jabatan
            };

            // 3. Execute use case (all business logic here)
            const useCase = container.resolve('GetAttendanceSummaryUseCase');
            const summary = await useCase.execute(filters);

            // 4. Format and return response
            return successResponse(res, {
                summary,
                period: { start_date, end_date },
                total_employees: summary.length
            }, 'Attendance summary calculated successfully');

        } catch (error) {
            logger.error('Get attendance summary error:', error);
            return errorResponse(res, error.message || 'Failed to calculate attendance summary', 500);
        }
    }

    /**
     * Get lecturer (dosen) attendance
     * GET /api/attendance/dosen?start_date=X&end_date=Y&dosen_id=Z
     */
    static async getLecturerAttendance(req, res) {
        try {
            const { start_date, end_date, dosen_id } = req.query;

            if (!start_date || !end_date) {
                return errorResponse(res, 'start_date and end_date are required', 400);
            }

            // Use the summary use case with DOSEN filter
            const useCase = container.resolve('GetAttendanceSummaryUseCase');
            const summary = await useCase.execute({
                startDate: new Date(start_date),
                endDate: new Date(end_date),
                nip: dosen_id,
                jabatan: 'DOSEN'
            });

            return successResponse(res, summary, 'Lecturer attendance retrieved successfully');

        } catch (error) {
            logger.error('Get lecturer attendance error:', error);
            return errorResponse(res, error.message || 'Failed to retrieve lecturer attendance', 500);
        }
    }

    /**
     * Get employee (karyawan) attendance
     * GET /api/attendance/karyawan?start_date=X&end_date=Y&karyawan_id=Z
     */
    static async getEmployeeAttendance(req, res) {
        try {
            const { start_date, end_date, karyawan_id } = req.query;

            if (!start_date || !end_date) {
                return errorResponse(res, 'start_date and end_date are required', 400);
            }

            // Use the summary use case with KARYAWAN filter
            const useCase = container.resolve('GetAttendanceSummaryUseCase');
            const summary = await useCase.execute({
                startDate: new Date(start_date),
                endDate: new Date(end_date),
                nip: karyawan_id,
                jabatan: 'KARYAWAN'
            });

            return successResponse(res, summary, 'Employee attendance retrieved successfully');

        } catch (error) {
            logger.error('Get employee attendance error:', error);
            return errorResponse(res, error.message || 'Failed to retrieve employee attendance', 500);
        }
    }

    /**
     * Get detailed employee attendance
     * GET /api/attendance/employee/:nip?start_date=X&end_date=Y
     */
    static async getEmployeeDetails(req, res) {
        try {
            const { nip } = req.params;
            const { start_date, end_date } = req.query;

            if (!start_date || !end_date) {
                return errorResponse(res, 'start_date and end_date are required', 400);
            }

            // Execute use case
            const useCase = container.resolve('GetEmployeeAttendanceUseCase');
            const details = await useCase.execute({
                nip,
                startDate: new Date(start_date),
                endDate: new Date(end_date)
            });

            return successResponse(res, details, 'Employee attendance details retrieved successfully');

        } catch (error) {
            logger.error('Get employee details error:', error);
            return errorResponse(res, error.message || 'Failed to retrieve employee details', 500);
        }
    }

    /**
     * Record attendance from fingerprint device
     * POST /api/attendance/record
     */
    static async recordAttendance(req, res) {
        try {
            const attendanceData = req.body;

            // Execute use case
            const useCase = container.resolve('RecordAttendanceUseCase');
            const attendance = await useCase.execute(attendanceData);

            logger.info('Attendance recorded:', {
                nip: attendance.nip,
                tanggal: attendance.tanggal,
                deviceId: attendance.deviceId
            });

            return successResponse(res, attendance.toObject(), 'Attendance recorded successfully', 201);

        } catch (error) {
            logger.error('Record attendance error:', error);
            return errorResponse(res, error.message || 'Failed to record attendance', 500);
        }
    }

    /**
     * Delete attendance record (soft delete)
     * DELETE /api/attendance/:id
     */
    static async deleteAttendance(req, res) {
        try {
            const { id } = req.params;
            const admin = req.user; // From auth middleware

            if (!admin) {
                return errorResponse(res, 'Authentication required', 401);
            }

            // Execute use case
            const useCase = container.resolve('DeleteAttendanceUseCase');
            await useCase.execute(parseInt(id), admin);

            logger.audit('ATTENDANCE_DELETED', admin.id, {
                attendance_id: id
            });

            return successResponse(res, null, 'Attendance record deleted successfully');

        } catch (error) {
            logger.error('Delete attendance error:', error);
            return errorResponse(res, error.message || 'Failed to delete attendance record', 500);
        }
    }

    /**
     * Legacy compatibility - Get attendance summary
     * This routes to the new clean architecture method
     */
    static async getSummary(req, res) {
        return AttendanceController.getAttendanceSummary(req, res);
    }

    /**
     * Legacy compatibility - Get all attendance
     * Keeping old implementation for backward compatibility
     */
    static async getAttendance(req, res) {
        try {
            // Import old implementation temporarily
            const { prisma } = require('../models');

            const {
                start_date,
                end_date,
                nip,
                jabatan,
                status,
                page = 1,
                limit = 50
            } = req.query;

            const whereClause = {
                is_deleted: false
            };

            if (start_date && end_date) {
                whereClause.tanggal = {
                    gte: new Date(start_date),
                    lte: new Date(end_date)
                };
            }

            if (nip) whereClause.nip = nip;
            if (jabatan) whereClause.jabatan = jabatan;
            if (status) whereClause.status = status;

            const total = await prisma.attendance.count({ where: whereClause });

            const skip = (parseInt(page) - 1) * parseInt(limit);
            const attendance = await prisma.attendance.findMany({
                where: whereClause,
                orderBy: { tanggal: 'desc' },
                skip: skip,
                take: parseInt(limit)
            });

            return successResponse(res, {
                data: attendance,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    total_pages: Math.ceil(total / parseInt(limit))
                }
            }, 'Attendance retrieved successfully');

        } catch (error) {
            logger.error('Get attendance error:', error);
            return errorResponse(res, 'Failed to retrieve attendance', 500);
        }
    }
}

module.exports = AttendanceController;
