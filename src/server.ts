// src/server.ts - Entry point aplikasi backend Sistem Rekap Absensi Kampus
import http from 'http';
import app from './app';
import logger from './utils/logger';

// Validate environment variables first
import { env } from './config/env';

const PORT = env.PORT;

// Initialize Database Connection via Prisma
import prisma from './config/prisma';
import { ZkDeviceClient } from './infrastructure/zk-client';
import { ZkSyncService } from './services/zk-sync.service';

const initializeApp = async (): Promise<void> => {
  try {
    // Test database connection via Prisma
    await prisma.$connect();
    logger.info('✅ MySQL connected to database (Prisma)');

    // Initialize and start direct ZKTeco hardware connection daemon
    const zkClient = ZkDeviceClient.getInstance();
    const zkSync = new ZkSyncService(zkClient);
    zkSync.start();
    await zkClient.start();
    logger.info('✅ ZKTeco Biometric client started successfully (Direct Hardware Integration)');

    logger.info('✅ Application initialized successfully');
  } catch (error: any) {
    logger.error('Failed to initialize application', {
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  }
};

// Start server
let server: http.Server | undefined;

const startServer = async (): Promise<void> => {
  try {
    await initializeApp();

    server = app.listen(Number(PORT), '0.0.0.0', () => {
      logger.info(`🚀 Server berjalan di port ${PORT} (0.0.0.0)`);
      logger.info(`📊 Environment: ${process.env['NODE_ENV'] || 'development'}`);
      logger.info(
        `🔒 Keamanan: ${process.env['NODE_ENV'] === 'production' ? 'Mode Production (Rate Limiting Aktif)' : 'Mode Development'}`
      );
      logger.info(`🧪 Try It (Swagger UI): http://localhost:${PORT}/finger-api/docs`);
      logger.info(`📖 Dokumentasi Lengkap tersedia di: http://localhost:${PORT}/finger-api/docs/`);
    });

    server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(`❌ Port ${PORT} sudah digunakan!`);
        logger.error(`💡 Solusi: Matikan aplikasi lain di port ${PORT} atau gunakan port berbeda`);
        logger.error(`   Coba: PORT=3001 npm run dev`);
        process.exit(1);
      } else {
        logger.error('Server error:', {
          error: error.message,
          stack: error.stack,
        });
        process.exit(1);
      }
    });
  } catch (error: any) {
    logger.error('Failed to start server', {
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  }
};

// Graceful shutdown handler
const gracefulShutdown = async (signal: string): Promise<void> => {
  logger.info(`${signal} received. Starting graceful shutdown...`);

  if (server) {
    // Stop accepting new connections
    server.close(async () => {
      logger.info('HTTP server closed');

      try {
        // Close database connection
        await prisma.$disconnect();

        logger.info('Graceful shutdown complete');
        process.exit(0);
      } catch (error: any) {
        logger.error('Error during graceful shutdown', {
          error: error.message,
        });
        process.exit(1);
      }
    });

    // Force shutdown after 10 seconds
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  } else {
    process.exit(0);
  }
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception', {
    error: error.message,
    stack: error.stack,
  });
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  logger.error('Unhandled Rejection', {
    reason: reason,
    promise: promise,
  });
  gracefulShutdown('UNHANDLED_REJECTION');
});

// Start the server
startServer();
