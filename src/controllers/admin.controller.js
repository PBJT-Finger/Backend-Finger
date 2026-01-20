// src/controllers/admin.controller.js - Admin Management
const { prisma } = require('../lib/prisma');
const { successResponse, errorResponse } = require('../utils/responseFormatter');
const logger = require('../utils/logger');
const bcrypt = require('bcrypt');

class AdminController {
    // TODO: Refactor all methods to use Prisma

    static async getAdmins(req, res) {
        try {
            const admins = await prisma.admin.findMany({
                select: {
                    id: true,
                    username: true,
                    email: true,
                    role: true,
                    is_active: true,
                    last_login: true,
                    created_at: true
                },
                orderBy: {
                    created_at: 'desc'
                }
            });

            return successResponse(res, admins, 'Admins retrieved successfully');
        } catch (error) {
            logger.error('Get all admins error', { error: error.message });
            return errorResponse(res, 'Failed to retrieve admins', 500);
        }
    }

    static async getAdminById(req, res) {
        try {
            const { id } = req.params;

            const admin = await prisma.admin.findUnique({
                where: { id: parseInt(id) },
                select: {
                    id: true,
                    username: true,
                    email: true,
                    role: true,
                    is_active: true,
                    last_login: true,
                    created_at: true,
                    updated_at: true
                }
            });

            if (!admin) {
                return errorResponse(res, 'Admin not found', 404);
            }

            return successResponse(res, admin, 'Admin retrieved successfully');
        } catch (error) {
            logger.error('Get admin by ID error', { error: error.message });
            return errorResponse(res, 'Failed to retrieve admin', 500);
        }
    }

    static async createAdmin(req, res) {
        // TODO: Implement with Prisma
        return errorResponse(res, 'Endpoint under refactoring to Prisma - coming soon', 501);
    }

    static async updateAdmin(req, res) {
        // TODO: Implement with Prisma
        return errorResponse(res, 'Endpoint under refactoring to Prisma - coming soon', 501);
    }

    static async deleteAdmin(req, res) {
        // TODO: Implement with Prisma
        return errorResponse(res, 'Endpoint under refactoring to Prisma - coming soon', 501);
    }

    static async changePassword(req, res) {
        // TODO: Implement with Prisma
        return errorResponse(res, 'Endpoint under refactoring to Prisma - coming soon', 501);
    }
}

module.exports = AdminController;
