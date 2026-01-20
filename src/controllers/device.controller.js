// src/controllers/device.controller.js - TEMPORARY STUB (Needs Prisma Refactor)
const { prisma } = require('../lib/prisma');
const { successResponse, errorResponse } = require('../utils/responseFormatter');
const logger = require('../utils/logger');

class DeviceController {
    // TODO: Refactor to use Prisma

    static async getDevices(req, res) {
        try {
            const devices = await prisma.device.findMany({
                select: {
                    id: true,
                    device_name: true,
                    device_id: true,
                    location: true,
                    is_active: true,
                    created_at: true
                },
                orderBy: {
                    created_at: 'desc'
                }
            });

            return successResponse(res, devices, 'Devices retrieved successfully');
        } catch (error) {
            logger.error('Get devices error', { error: error.message });
            return errorResponse(res, 'Failed to retrieve devices', 500);
        }
    }

    static async getDeviceById(req, res) {
        // TODO: Implement with Prisma
        return errorResponse(res, 'Endpoint under refactoring to Prisma - coming soon', 501);
    }

    static async createDevice(req, res) {
        // TODO: Implement with Prisma
        return errorResponse(res, 'Endpoint under refactoring to Prisma - coming soon', 501);
    }

    static async updateDevice(req, res) {
        // TODO: Implement with Prisma
        return errorResponse(res, 'Endpoint under refactoring to Prisma - coming soon', 501);
    }

    static async deleteDevice(req, res) {
        // TODO: Implement with Prisma
        return errorResponse(res, 'Endpoint under refactoring to Prisma - coming soon', 501);
    }

    static async syncDevice(req, res) {
        // TODO: Implement with Prisma
        return errorResponse(res, 'Endpoint under refactoring to Prisma - coming soon', 501);
    }
}

module.exports = DeviceController;
