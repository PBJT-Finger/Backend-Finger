import webpush from 'web-push';
import prisma from '../config/prisma';
import logger from '../utils/logger';
import { env } from '../config/env';

// Konfigurasi VAPID details dari environment
if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    env.VAPID_SUBJECT,
    env.VAPID_PUBLIC_KEY,
    env.VAPID_PRIVATE_KEY
  );
} else {
  logger.warn('[WebPush] VAPID keys tidak dikonfigurasi. Fitur notifikasi Push akan dinonaktifkan.');
}

export class WebPushService {
  /**
   * Mengirim notifikasi ke semua perangkat/browser admin yang telah terdaftar.
   * Secara otomatis menghapus langganan (subscription) yang sudah tidak valid/kadaluwarsa.
   *
   * @param payload Objek data yang akan dikirim (biasanya berisi title, body, dll)
   */
  public static async broadcastToAdmins(payload: any): Promise<void> {
    try {
      // Ambil seluruh langganan notifikasi aktif beserta relasi admin-nya
      const subscriptions = await prisma.push_subscriptions.findMany({
        include: { admins: true }
      });

      if (subscriptions.length === 0) {
        return; // Tidak ada yang berlangganan
      }

      const payloadString = JSON.stringify(payload);
      const invalidSubscriptionIds: number[] = [];
      const targetUserId = payload.data?.userId;

      // Mengirim push secara asinkron paralel
      const pushPromises = subscriptions.map(async (sub) => {
        // Filter Privasi: 
        // 1. Kirim ke Admin atau Pimpinan
        // 2. Kirim ke Karyawan/Dosen ITU SENDIRI (konfirmasi absen pribadi)
        const isAdminOrPimpinan = sub.admins?.role === 'ADMIN' || sub.admins?.role === 'PIMPINAN';
        const isSelf = sub.admins?.employee_id === targetUserId;

        if (!isAdminOrPimpinan && !isSelf) {
          return; // Abaikan, jangan kirim notifikasi absen orang lain ke karyawan biasa
        }

        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            auth: sub.auth,
            p256dh: sub.p256dh,
          },
        };

        try {
          await webpush.sendNotification(pushSubscription, payloadString);
        } catch (error: any) {
          // Tangani jika subscription sudah hangus/ditolak oleh server push (misal: user clear cache browser)
          if (error.statusCode === 404 || error.statusCode === 410) {
            invalidSubscriptionIds.push(sub.id);
          } else {
            logger.error(`[WebPush] Gagal mengirim ke admin_id ${sub.admin_id}:`, error.message);
          }
        }
      });

      await Promise.allSettled(pushPromises);

      // Pembersihan otomatis untuk langganan yang sudah usang/kadaluwarsa
      if (invalidSubscriptionIds.length > 0) {
        await prisma.push_subscriptions.deleteMany({
          where: { id: { in: invalidSubscriptionIds } },
        });
        logger.info(`[WebPush] Menghapus ${invalidSubscriptionIds.length} langganan yang sudah usang/invalid.`);
      }
    } catch (error: any) {
      logger.error('[WebPush] Terjadi kesalahan saat proses broadcast:', error.message);
    }
  }
}
