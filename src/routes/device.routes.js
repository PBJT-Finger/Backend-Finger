// src/routes/device.routes.js
const express = require('express');
const router = express.Router();
const DeviceController = require('../controllers/device.controller');
const { authenticateToken } = require('../middlewares/auth.middleware');
const { createUserRateLimiter } = require('../middlewares/userRateLimit');

// Apply authentication to all device routes
router.use(authenticateToken);

// Apply rate limiting
const deviceLimiter = createUserRateLimiter('moderate');
router.use(deviceLimiter);

// Device Management endpoints - DOCUMENTASI SWAGGER DIHAPUS AGAR TIDAK MUNCUL DI API DOCS

// GET /api/device - Get all devices
router.get('/', DeviceController.getDevices);

// GET /api/device/:id - Get device by ID
router.get('/:id', DeviceController.getDeviceById);

// POST /api/device - Create new device
router.post('/', DeviceController.createDevice);

// PUT /api/device/:id - Update device
router.put('/:id', DeviceController.updateDevice);

// DELETE /api/device/:id - Delete device
router.delete('/:id', DeviceController.deleteDevice);

// POST /api/device/:id/sync - Sync device
router.post('/:id/sync', DeviceController.syncDevice);

module.exports = router;
