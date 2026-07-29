// src/services/device.cleanup.service.ts
// Layanan otomatisasi pembersihan log transaksi kehadiran pada memori internal mesin
// ZKTeco X100-C tepat pukul 12 malam (00:00 / 0 0 * * *) dan secara manual on-demand.

import cron from 'node-cron';
import logger from '../utils/logger';
import { ZkDeviceClient } from '../infrastructure/zk-client';

export interface CleanupPipelineResult {
  success: boolean;
  clearedCount?: number | undefined;
  message: string;
}

export class DeviceCleanupService {
  private static isCleaning = false;

  /**
   * Mendaftarkan jadwal cron harian tepat pada pukul 12 malam (00:00 / 0 0 * * *).
   * Menjamin bahwa log absensi hari kemarin dibersihkan setelah sinkronisasi selesai,
   * sehingga memori mesin selalu ringan (< 200 baris) sepanjang hari kerja.
   */
  public static scheduleDailyMidnightCleanup(): void {
    // Cron expression '0 0 * * *' = Setiap hari pukul 00:00 (12 Malam Tepat)
    cron.schedule('0 0 * * *', async () => {
      logger.info('[DeviceCleanupService] ⏰ Memulai pipeline pembersihan otomatis tengah malam (00:00)...');
      try {
        const result = await DeviceCleanupService.executeCleanupPipeline(false);
        if (result.success) {
          logger.info(`[DeviceCleanupService] ✅ Pembersihan otomatis tengah malam berhasil: ${result.message}`);
        } else {
          logger.warn(`[DeviceCleanupService] ⚠️ Pembersihan otomatis tengah malam gagal: ${result.message}`);
        }
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        logger.error('[DeviceCleanupService] ❌ Terjadi kesalahan saat pembersihan otomatis tengah malam', {
          error: errMsg,
        });
      }
    });

    logger.info(
      '[DeviceCleanupService] ✅ Jadwal pembersihan otomatis harian aktif (Cron: 0 0 * * * - Jam 12 Malam Tepat)'
    );
  }

  /**
   * Mengeksekusi pipeline pembersihan log memori pada mesin ZKTeco fisik.
   * Aman dari eksekusi ganda (concurrent safety lock).
   *
   * @param isManual Menandakan apakah pembersihan dipicu manual oleh Admin atau otomatis oleh Cron
   */
  public static async executeCleanupPipeline(isManual = false): Promise<CleanupPipelineResult> {
    const modeLabel = isManual ? 'MANUAL (Admin)' : 'OTOMATIS (Midnight Cron)';

    if (DeviceCleanupService.isCleaning) {
      const msg = `Proses pembersihan log sedang berjalan (${modeLabel}). Permintaan baru diabaikan.`;
      logger.warn(`[DeviceCleanupService] ${msg}`);
      return { success: false, message: msg };
    }

    DeviceCleanupService.isCleaning = true;
    try {
      const zkClient = ZkDeviceClient.getInstance();

      // Pastikan mesin terhubung (start() bersifat idempotent)
      if (zkClient.getStatus() !== 'online') {
        logger.info(`[DeviceCleanupService] Mesin saat ini offline/connecting. Mencoba menginisialisasi koneksi untuk ${modeLabel}...`);
        await zkClient.start();
      }

      logger.info(`[DeviceCleanupService] Mengeksekusi pembersihan log absensi mesin — Mode: ${modeLabel}`);

      const result = await zkClient.clearDeviceAttendanceLog();

      if (result.success) {
        const countStr = typeof result.clearedCount === 'number' ? ` (${result.clearedCount} log dibersihkan)` : '';
        const successMsg = `Log absensi di mesin fisik berhasil dikosongkan${countStr}.`;
        logger.info(`[DeviceCleanupService] ✅ ${successMsg}`);
        return {
          success: true,
          clearedCount: result.clearedCount,
          message: successMsg,
        };
      } else {
        const errorMsg = result.error || 'Mesin menolak perintah pembersihan log';
        logger.error(`[DeviceCleanupService] ❌ Gagal mengosongkan log mesin (${modeLabel}): ${errorMsg}`);
        return {
          success: false,
          message: `Gagal mengosongkan log mesin: ${errorMsg}`,
        };
      }
    } finally {
      DeviceCleanupService.isCleaning = false;
    }
  }
}
export default DeviceCleanupService;
