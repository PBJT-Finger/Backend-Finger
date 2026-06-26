// src/routes/device.routes.ts
// Mengatur rute API untuk manajemen perangkat sidik jari, monitoring streaming event (SSE),
// manajemen user mesin (pulling & registration), serta daftar shift jam kerja yang tersedia.

import { Router, Request, Response } from 'express';
import DeviceController from '../controllers/device.controller'; // Kontroler CRUD mesin sidik jari
import DeviceUsersController from '../controllers/device.users.controller'; // Kontroler user mesin sidik jari
import { authenticateToken, requireAdmin } from '../middlewares/auth.middleware'; // Middleware otorisasi JWT & Admin
import { userRateLimits } from '../middlewares/userRateLimit'; // Middleware pembatas laju request
import prisma from '../config/prisma'; // Prisma client untuk query database shift
import { successResponse, errorResponse } from '../utils/responseFormatter'; // Util format response API

const router = Router();

import { streamDeviceEvents } from '../controllers/device.stream.controller'; // Handler untuk event streaming (SSE)

// GET /api/device/stream - Endpoint Publik SSE untuk update real-time dashboard.
// Dibungkus secara eksplisit dengan catch(next) karena Express ≤ 4 tidak menangkap error
// Promise reject di handler async secara otomatis.
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

// ── Manajemen User Perangkat (Memerlukan Token & Role Admin) ─────────────────

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
// Menarik data user dari memori cache mesin sidik jari (GET /api/device/users/pull)
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
// Mendaftarkan user mesin sidik jari ke tabel pegawai database (POST /api/device/users/register)
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
// Mengambil daftar shift aktif di database (GET /api/device/shifts)
router.get('/shifts', authenticateToken, async (req: Request, res: Response) => {
  try {
    const shifts = await prisma.shifts.findMany({
      where: { is_active: true },
      select: { id: true, nama_shift: true, jam_masuk: true, jam_keluar: true },
      orderBy: { id: 'asc' },
    });
    return successResponse(res, shifts, 'Berhasil mengambil daftar shift aktif');
  } catch (_error) {
    return errorResponse(res, 'Gagal mengambil data shift', 500);
  }
});

// Mulai menerapkan autentikasi Bearer JWT untuk seluruh rute di bawah ini
router.use(authenticateToken);

// Terapkan rate limiter level 'moderate' untuk seluruh rute di bawah ini
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
// Mengambil seluruh data perangkat sidik jari yang aktif (GET /api/device)
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
// Mengambil detail satu perangkat berdasarkan ID (GET /api/device/:id)
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
// Mendaftarkan perangkat baru (POST /api/device)
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
// Mengupdate data perangkat (PUT /api/device/:id)
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
// Menghapus perangkat secara logis/soft-delete (DELETE /api/device/:id)
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
// Memicu sinkronisasi log mesin sidik jari ke server secara manual (POST /api/device/:id/sync)
router.post('/:id/sync', DeviceController.syncDevice);

export default router;
