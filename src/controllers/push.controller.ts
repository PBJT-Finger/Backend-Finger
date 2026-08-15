import { Request, Response } from 'express';
import { successResponse, errorResponse } from '../utils/responseFormatter';
import prisma from '../config/prisma';
import logger from '../utils/logger';

export class PushController {
  /**
   * Menerima payload PushSubscription dari PWA Frontend dan menyimpannya di database
   * POST /api/notifications/subscribe
   */
  public static async subscribe(req: Request, res: Response): Promise<Response> {
    try {
      const { subscription } = req.body;
      const adminId = (req as any).user?.id; // Tersedia jika menggunakan middleware authenticateToken

      if (!subscription || !subscription.endpoint || !subscription.keys) {
        return errorResponse(res, 'Payload subscription tidak valid', 400);
      }

      // Cek apakah endpoint ini sudah ada di database untuk menghindari duplikat
      const existing = await prisma.push_subscriptions.findFirst({
        where: { endpoint: subscription.endpoint }
      });

      if (!existing) {
        await prisma.push_subscriptions.create({
          data: {
            admin_id: adminId || null,
            endpoint: subscription.endpoint,
            auth: subscription.keys.auth,
            p256dh: subscription.keys.p256dh,
          }
        });
        logger.info(`[PushController] Perangkat baru berlangganan push notifications (Admin ID: ${adminId})`);
      }

      return successResponse(res, null, 'Berhasil mendaftarkan langganan notifikasi');
    } catch (error: any) {
      logger.error('[PushController] Gagal memproses subscription', { error: error.message });
      return errorResponse(res, 'Terjadi kesalahan saat memproses langganan notifikasi', 500);
    }
  }
}
export default PushController;
