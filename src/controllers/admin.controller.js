// src/controllers/admin.controller.js - Admin Management (Prisma)
const prisma = require('../config/prisma');
const { successResponse, errorResponse } = require('../utils/responseFormatter');
const logger = require('../utils/logger');
const bcrypt = require('bcrypt');

class AdminController {
  static async getAdmins(req, res) {
    try {
      const admins = await prisma.admins.findMany({
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

      const admin = await prisma.admins.findUnique({
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
