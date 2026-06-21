// src/server.ts - Titik masuk (Entry point) utama untuk aplikasi backend Sistem Rekap Absensi Kampus
import http from 'http';
import app from './app';
import logger from './utils/logger';

// Memvalidasi variabel lingkungan (environment variables) terlebih dahulu sebelum menjalankan logika lainnya
import { env } from './config/env';

// Mengambil port dari variabel lingkungan yang sudah divalidasi (default biasanya 3333)
const PORT = env.PORT;

// Mengimpor koneksi database MySQL melalui Prisma ORM
import prisma from './config/prisma';

// Mengimpor client SDK ZKTeco untuk koneksi ke mesin fingerprint fisik
import { ZkDeviceClient } from './infrastructure/zk-client';

// Mengimpor layanan sinkronisasi data absensi dari mesin ke MySQL
import { ZkSyncService } from './services/zk-sync.service';

/**
 * Fungsi untuk menginisialisasi semua ketergantungan aplikasi (Database dan Koneksi Hardware)
 */
const initializeApp = async (): Promise<void> => {
  try {
    // 1. Menguji koneksi ke database MySQL menggunakan Prisma ORM
    await prisma.$connect();
    logger.info('✅ MySQL berhasil terhubung ke database (Prisma)');

    // 2. Menginisialisasi dan memulai daemon sinkronisasi hardware ZKTeco secara realtime
    const zkClient = ZkDeviceClient.getInstance(); // Menggunakan pola Singleton untuk mendapatkan instansi client ZKTeco
    const zkSync = new ZkSyncService(zkClient);    // Membuat instance layanan sinkronisasi dengan client ZKTeco
    zkSync.start();                                // Memulai loop sinkronisasi/polling data absensi
    await zkClient.start();                        // Menyalakan koneksi soket ke mesin fingerprint fisik
    logger.info('✅ Client Biometrik ZKTeco berhasil dinyalakan (Integrasi Hardware Langsung)');

    logger.info('✅ Aplikasi berhasil diinisialisasi sepenuhnya');
  } catch (error: any) {
    // Mencatat log error secara detail jika inisialisasi gagal
    logger.error('Gagal menginisialisasi aplikasi', {
      error: error.message,
      stack: error.stack,
    });
    // Menghentikan proses node dengan kode error 1 jika terjadi kegagalan fatal
    process.exit(1);
  }
};

// Variabel untuk menyimpan instance server HTTP Express
let server: http.Server | undefined;

/**
 * Fungsi utama untuk menjalankan server Express dan mulai mendengarkan request HTTP
 */
const startServer = async (): Promise<void> => {
  try {
    // Menjalankan inisialisasi database & koneksi mesin fingerprint terlebih dahulu
    await initializeApp();

    // Menyalakan server HTTP Express pada port yang ditentukan dan mengizinkan akses dari semua host (0.0.0.0)
    server = app.listen(Number(PORT), '0.0.0.0', () => {
      logger.info(`🚀 Server berjalan di port ${PORT} (0.0.0.0)`);
      logger.info(`📊 Environment: ${process.env['NODE_ENV'] || 'development'}`);
      logger.info(
        `🔒 Keamanan: ${process.env['NODE_ENV'] === 'production' ? 'Mode Production (Rate Limiting Aktif)' : 'Mode Development'}`
      );
      logger.info(`🧪 Try It (Swagger UI): http://localhost:${PORT}/finger-api/docs`);
      logger.info(`📖 Dokumentasi Lengkap tersedia di: http://localhost:${PORT}/finger-api/docs/`);
    });

    // Menangani error spesifik pada server HTTP
    server.on('error', (error: NodeJS.ErrnoException) => {
      // Jika port yang dituju sudah digunakan oleh proses/aplikasi lain
      if (error.code === 'EADDRINUSE') {
        logger.error(`❌ Port ${PORT} sudah digunakan!`);
        logger.error(`💡 Solusi: Matikan aplikasi lain di port ${PORT} atau gunakan port berbeda`);
        logger.error(`   Coba jalankan dengan: PORT=3001 npm run dev`);
        process.exit(1);
      } else {
        logger.error('Terjadi error pada Server:', {
          error: error.message,
          stack: error.stack,
        });
        process.exit(1);
      }
    });
  } catch (error: any) {
    logger.error('Gagal menyalakan server', {
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  }
};

/**
 * Fungsi untuk mematikan server secara aman (Graceful Shutdown) saat menerima sinyal terminasi
 * @param signal Nama sinyal sistem yang diterima (misal SIGTERM, SIGINT)
 */
const gracefulShutdown = async (signal: string): Promise<void> => {
  logger.info(`Sinyal ${signal} diterima. Memulai proses pemadaman aman (Graceful Shutdown)...`);

  if (server) {
    // Berhenti menerima koneksi baru dari luar
    server.close(async () => {
      logger.info('Server HTTP Express telah ditutup');

      try {
        // Memutus koneksi ke database MySQL secara aman
        await prisma.$disconnect();
        logger.info('Koneksi database Prisma berhasil diputus secara aman');

        logger.info('Graceful shutdown selesai. Proses dihentikan.');
        process.exit(0);
      } catch (error: any) {
        logger.error('Error saat memutus koneksi/proses shutdown:', {
          error: error.message,
        });
        process.exit(1);
      }
    });

    // Jika proses pemadaman memakan waktu terlalu lama (lebih dari 10 detik), matikan secara paksa
    setTimeout(() => {
      logger.error('Pemadaman paksa dilakukan karena melebihi batas waktu (timeout 10 detik)');
      process.exit(1);
    }, 10000);
  } else {
    process.exit(0);
  }
};

// Menangani sinyal shutdown dari sistem operasi (misal Ctrl+C atau perintah stop dari Docker Swarm)
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Menangani error bertipe "uncaughtException" (error yang tidak ditangkap dalam blok try-catch sinkron)
process.on('uncaughtException', (error: Error) => {
  logger.error('Terjadi Uncaught Exception (Error tak tertangani):', {
    error: error.message,
    stack: error.stack,
  });
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

// Menangani unhandled promise rejection (asynchronous error yang tidak di-catch)
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  logger.error('Terjadi Unhandled Rejection (Rejection Promise tak tertangani):', {
    reason: reason,
    promise: promise,
  });
  gracefulShutdown('UNHANDLED_REJECTION');
});

// Menjalankan server HTTP
startServer();
