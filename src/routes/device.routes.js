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

// Device Management endpoints - using Device tag for documentation


/**
 * @swagger
 * /api/device:
 *   get:
 *     summary: Dapatkan semua perangkat (paginasi)
 *     tags: [Device]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive, maintenance]
 *       - in: query
 *         name: lokasi
 *         schema:
 *           type: string
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Daftar perangkat
 */
router.get('/', DeviceController.getDevices);

/**
 * @swagger
 * /api/device/{id}:
 *   get:
 *     summary: Dapatkan perangkat berdasarkan ID
 *     tags: [Device]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Detail perangkat
 *       404:
 *         description: Perangkat tidak ditemukan
 */
router.get('/:id', DeviceController.getDeviceById);

/**
 * @swagger
 * /api/device:
 *   post:
 *     summary: Buat perangkat baru
 *     tags: [Device]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - serial_number
 *               - nama_device
 *             properties:
 *               serial_number:
 *                 type: string
 *                 maxLength: 100
 *               nama_device:
 *                 type: string
 *                 maxLength: 100
 *               lokasi:
 *                 type: string
 *                 maxLength: 200
 *               ip_address:
 *                 type: string
 *                 pattern: '^(\d{1,3}\.){3}\d{1,3}$'
 *               keterangan:
 *                 type: string
 *     responses:
 *       201:
 *         description: Perangkat berhasil dibuat
 *       409:
 *         description: Nomor seri sudah ada
 */
router.post('/', DeviceController.createDevice);

/**
 * @swagger
 * /api/device/{id}:
 *   put:
 *     summary: Perbarui perangkat
 *     tags: [Device]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nama_device:
 *                 type: string
 *                 maxLength: 100
 *               lokasi:
 *                 type: string
 *                 maxLength: 200
 *               ip_address:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [active, inactive, maintenance]
 *               keterangan:
 *                 type: string
 *     responses:
 *       200:
 *         description: Perangkat berhasil diperbarui
 *       404:
 *         description: Perangkat tidak ditemukan
 */
router.put('/:id', DeviceController.updateDevice);

/**
 * @swagger
 * /api/device/{id}:
 *   delete:
 *     summary: Hapus perangkat
 *     tags: [Device]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Perangkat berhasil dihapus
 *       404:
 *         description: Perangkat tidak ditemukan
 */
router.delete('/:id', DeviceController.deleteDevice);

/**
 * @swagger
 * /api/device/{id}/sync:
 *   post:
 *     summary: Perbarui waktu sinkronisasi perangkat terakhir
 *     tags: [Device]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Perangkat berhasil disinkronkan
 *       404:
 *         description: Perangkat tidak ditemukan
 */
router.post('/:id/sync', DeviceController.syncDevice);

module.exports = router;
