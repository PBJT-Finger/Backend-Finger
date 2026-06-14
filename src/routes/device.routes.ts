import { Router, Request, Response } from 'express';
import DeviceController from '../controllers/device.controller';
import DeviceUsersController from '../controllers/device.users.controller';
import { authenticateToken, requireAdmin } from '../middlewares/auth.middleware';
import { userRateLimits } from '../middlewares/userRateLimit';
import prisma from '../config/prisma';
import { successResponse, errorResponse } from '../utils/responseFormatter';

const router = Router();

import { streamDeviceEvents } from '../controllers/device.stream.controller';

// GET /api/device/stream - Public SSE endpoint for real-time dashboard
// Wrapped in an explicit async error boundary because Express ≤4 does not
// automatically catch rejected Promises from async route handlers.
/**
 * @swagger
 * /api/device/stream:
 *   get:
 *     summary: Mendengarkan event real-time dari device (SSE)
 *     tags: [Device]
 *     responses:
 *       200:
 *         description: Event stream terhubung
 */
router.get('/stream', (req, res, next) => {
  streamDeviceEvents(req, res).catch(next);
});

// ── Device User Management (authenticated) ───────────────────────────────────

/**
 * @swagger
 * /api/device/users/pull:
 *   get:
 *     summary: Tarik (pull) data user dari device ke sistem
 *     tags: [Device Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Berhasil mengambil data user dari device
 */
router.get('/users/pull', authenticateToken, requireAdmin, (req, res, next) => {
  DeviceUsersController.pullDeviceUsers(req, res).catch(next);
});

/**
 * @swagger
 * /api/device/users/register:
 *   post:
 *     summary: Daftarkan user device ke dalam sistem (mapping)
 *     tags: [Device Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - deviceUserId
 *               - deviceUserName
 *               - jabatan
 *               - shiftId
 *             properties:
 *               deviceUserId:
 *                 type: string
 *               deviceUserName:
 *                 type: string
 *               jabatan:
 *                 type: string
 *                 enum: [DOSEN, KARYAWAN]
 *               shiftId:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Berhasil mendaftarkan user
 */
router.post('/users/register', authenticateToken, requireAdmin, (req, res, next) => {
  DeviceUsersController.registerDeviceUser(req, res).catch(next);
});

/**
 * @swagger
 * /api/device/shifts:
 *   get:
 *     summary: Ambil daftar shift yang tersedia
 *     tags: [Device Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Daftar shift berhasil diambil
 */
router.get('/shifts', authenticateToken, async (req: Request, res: Response) => {
  try {
    const shifts = await prisma.shifts.findMany({
      where: { is_active: true },
      select: { id: true, nama_shift: true, jam_masuk: true, jam_keluar: true },
      orderBy: { id: 'asc' },
    });
    return successResponse(res, shifts, 'Shifts retrieved successfully');
  } catch (_error) {
    return errorResponse(res, 'Gagal mengambil data shift', 500);
  }
});

// Apply authentication to all device routes
router.use(authenticateToken);

// Apply moderate rate limiting
router.use(userRateLimits.moderate);

/**
 * @swagger
 * /api/device:
 *   get:
 *     summary: Ambil semua data device
 *     tags: [Device]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Daftar device berhasil diambil
 */
router.get('/', DeviceController.getDevices);

/**
 * @swagger
 * /api/device/{id}:
 *   get:
 *     summary: Ambil detail device berdasarkan ID
 *     tags: [Device]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Detail device berhasil diambil
 */
router.get('/:id', DeviceController.getDeviceById);

/**
 * @swagger
 * /api/device:
 *   post:
 *     summary: Tambah device baru
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
 *               - device_id
 *               - device_name
 *             properties:
 *               device_id:
 *                 type: string
 *               device_name:
 *                 type: string
 *               ip_address:
 *                 type: string
 *               location:
 *                 type: string
 *     responses:
 *       201:
 *         description: Device berhasil dibuat
 */
router.post('/', DeviceController.createDevice);

/**
 * @swagger
 * /api/device/{id}:
 *   put:
 *     summary: Perbarui data device
 *     tags: [Device]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               device_name:
 *                 type: string
 *               ip_address:
 *                 type: string
 *               location:
 *                 type: string
 *               is_active:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Device berhasil diperbarui
 */
router.put('/:id', DeviceController.updateDevice);

/**
 * @swagger
 * /api/device/{id}:
 *   delete:
 *     summary: Hapus device
 *     tags: [Device]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Device berhasil dihapus
 */
router.delete('/:id', DeviceController.deleteDevice);

/**
 * @swagger
 * /api/device/{id}/sync:
 *   post:
 *     summary: Sinkronisasi data dari device secara manual
 *     tags: [Device]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Proses sinkronisasi berhasil dijalankan
 */
router.post('/:id/sync', DeviceController.syncDevice);

export default router;
