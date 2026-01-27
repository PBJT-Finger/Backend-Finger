// src/controllers/admin.controller.js - Admin Management (MySQL VERSION)
const { query } = require('../lib/db');
const { successResponse, errorResponse } = require('../utils/responseFormatter');
const logger = require('../utils/logger');
const bcrypt = require('bcrypt');

class AdminController {
    static async getAdmins(req, res) {
        try {
            const admins = await query(
                `SELECT id, username, email, role, is_active, last_login, created_at 
                 FROM admins 
                 ORDER BY created_at DESC`,
                []
            );

            return successResponse(res, admins, 'Admins retrieved successfully');
        } catch (error) {
            logger.error('Get all admins error', { error: error.message });
            return errorResponse(res, 'Failed to retrieve admins', 500);
        }
    }

    static async getAdminById(req, res) {
        try {
            const { id } = req.params;

            const result = await query(
                `SELECT id, username, email, role, is_active, last_login, created_at, updated_at 
                 FROM admins 
                 WHERE id = ? 
                 LIMIT 1`,
                [parseInt(id)]
            );

            if (result.length === 0) {
                return errorResponse(res, 'Admin not found', 404);
            }

            return successResponse(res, result[0], 'Admin retrieved successfully');
        } catch (error) {
            logger.error('Get admin by ID error', { error: error.message });
            return errorResponse(res, 'Failed to retrieve admin', 500);
        }
    }

    static async createAdmin(req, res) {
        return errorResponse(res, 'Endpoint not implemented yet', 501);
    }

    static async updateAdmin(req, res) {
        return errorResponse(res, 'Endpoint not implemented yet', 501);
    }

    static async deleteAdmin(req, res) {
        return errorResponse(res, 'Endpoint not implemented yet', 501);
    }

    static async changePassword(req, res) {
        return errorResponse(res, 'Endpoint not implemented yet', 501);
    }
}

module.exports = AdminController;
