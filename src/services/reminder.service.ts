import cron from 'node-cron';
import prisma from '../config/prisma';
import logger from '../utils/logger';
import webpush from 'web-push';

export class ReminderService {
  /**
   * Menginisialisasi Cron Job untuk pengingat absensi.
   * Dipanggil saat server start.
   */
  public static init() {
    // Berjalan setiap hari pada jam 07:45 WIB
    cron.schedule('45 07 * * 1-5', async () => {
      logger.info('[ReminderService] Menjalankan cron job pengingat absen pagi (07:45 WIB)');
      await this.runMorningReminder();
    }, {
      timezone: "Asia/Jakarta"
    });
  }

  private static async runMorningReminder() {
    try {
      const today = new Date();
      // Set to midnight UTC for today's date matching in DB (as configured in zk-sync)
      const startOfDay = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
      const endOfDay = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59));

      // Ambil seluruh user yang merupakan Dosen atau Karyawan dan berstatus aktif
      const activePegawai = await prisma.admins.findMany({
        where: {
          role: { in: ['DOSEN', 'KARYAWAN'] },
          is_active: true,
          employee_id: { not: null }
        },
        include: {
          push_subscriptions: true
        }
      });

      // Ambil seluruh absen HARI INI
      const todayAttendances = await prisma.attendance.findMany({
        where: {
          tanggal: { gte: startOfDay, lte: endOfDay },
          is_deleted: false,
          jam_masuk: { not: null }
        },
        select: { user_id: true }
      });

      const userIdsWhoCheckedIn = new Set(todayAttendances.map(a => a.user_id));

      let reminderCount = 0;

      for (const pegawai of activePegawai) {
        // Jika belum absen
        if (pegawai.employee_id && !userIdsWhoCheckedIn.has(pegawai.employee_id)) {
          // Jika pegawai ini memiliki langganan push notification
          if (pegawai.push_subscriptions && pegawai.push_subscriptions.length > 0) {
            
            const payload = JSON.stringify({
              title: 'Pengingat Absen Masuk',
              body: `Halo ${pegawai.full_name}, waktu absensi masuk tersisa 15 menit lagi. Jangan lupa absen!`,
              data: { type: 'reminder' }
            });

            for (const sub of pegawai.push_subscriptions) {
              const pushSubscription = {
                endpoint: sub.endpoint,
                keys: {
                  auth: sub.auth,
                  p256dh: sub.p256dh,
                },
              };

              try {
                await webpush.sendNotification(pushSubscription, payload);
                reminderCount++;
              } catch (error: any) {
                // Hapus jika usang
                if (error.statusCode === 404 || error.statusCode === 410) {
                  await prisma.push_subscriptions.delete({ where: { id: sub.id } });
                } else {
                  logger.error(`[ReminderService] Gagal kirim ke ${pegawai.username}: ${error.message}`);
                }
              }
            }
          }
        }
      }

      logger.info(`[ReminderService] Berhasil mengirimkan ${reminderCount} push notifikasi pengingat.`);
    } catch (error: any) {
      logger.error('[ReminderService] Terjadi kesalahan saat menjalankan runMorningReminder:', error.message);
    }
  }
}
