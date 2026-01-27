// src/controllers/device.controller.js - Device Management (MySQL VERSION)  
const { query } = require('../lib/db');
const { successResponse, errorResponse } = require('../utils/responseFormatter');
const logger = require('../utils/logger');

class DeviceController {
    static async getDevices(req, res) {
        try {
            const devices = await query(
                'SELECT id, device_name, device_id, location, is_active, created_at FROM devices WHERE is_active = 1 ORDER BY created_at DESC',
                []
            );

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
