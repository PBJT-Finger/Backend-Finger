import { Router } from 'express';
import { PushController } from '../controllers/push.controller';
import { authenticateToken } from '../middlewares/auth.middleware';

const router = Router();

/**
 * @swagger
 * /api/notifications/subscribe:
 *   post:
 *     summary: Berlangganan Web Push Notification (PWA)
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               subscription:
 *                 type: object
 *                 description: Obyek PushSubscription dari browser
 *     responses:
 *       200:
 *         description: Berhasil mendaftarkan langganan notifikasi
 */
// Endpoint untuk mendaftarkan subscription Web Push dari PWA. Bisa digunakan tanpa autentikasi ketat jika diperlukan.
router.post('/subscribe', authenticateToken, PushController.subscribe);

export default router;
