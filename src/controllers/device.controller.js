// src/controllers/device.controller.js - Device Management (Prisma)
const { prisma } = require('../models');
const { successResponse, errorResponse } = require('../utils/responseFormatter');
const logger = require('../utils/logger');

class DeviceController {
    static async getDevices(req, res) {
        try {
            const devices = await prisma.devices.findMany({
                where: { is_active: true },
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
        return errorResponse(res, 'Endpoint not implemented yet', 501);
    }

    static async createDevice(req, res) {
        return errorResponse(res, 'Endpoint not implemented yet', 501);
    }

    static async updateDevice(req, res) {
        return errorResponse(res, 'Endpoint not implemented yet', 501);
    }

    static async deleteDevice(req, res) {
        return errorResponse(res, 'Endpoint not implemented yet', 501);
    }

    static async syncDevice(req, res) {
        return errorResponse(res, 'Endpoint not implemented yet', 501);
    }
}

module.exports = DeviceController;
