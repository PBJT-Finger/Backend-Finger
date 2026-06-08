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
router.get('/stream', (req, res, next) => {
  streamDeviceEvents(req, res).catch(next);
});

// ── Device User Management (authenticated) ───────────────────────────────────

// GET /api/device/users/pull — list device users + DB registration status
// Must be defined BEFORE router.use(authenticateToken) and the /:id routes
// to avoid Express routing the literal path "/users" to the /:id param handler.
router.get('/users/pull', authenticateToken, requireAdmin, (req, res, next) => {
  DeviceUsersController.pullDeviceUsers(req, res).catch(next);
});

// POST /api/device/users/register — register a device user into the system
router.post('/users/register', authenticateToken, requireAdmin, (req, res, next) => {
  DeviceUsersController.registerDeviceUser(req, res).catch(next);
});

// GET /api/device/shifts — fetch available shifts for the registration form
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

export default router;
