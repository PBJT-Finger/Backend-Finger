// src/server.js - Entry point aplikasi backend Sistem Rekap Absensi Kampus
const app = require('./app');
const logger = require('./utils/logger');

// Validate environment variables first
const { validateEnv } = require('./config/env');
const env = validateEnv();

const PORT = env.PORT;

// Initialize Database Connection via Prisma
const prisma = require('./config/prisma');
const { connect: connectRedis, disconnect: disconnectRedis } = require('./utils/tokenBlacklist');
const { connectUserRateLimiter } = require('./middlewares/userRateLimit');

const initializeApp = async () => {
  try {
    // Test database connection via Prisma
    await prisma.$connect();
    logger.info('✅ MySQL connected to database (Prisma)');

    // Connect to Redis for token blacklist (Phase 2)
    // DISABLED for development - uncomment when Redis is available
    // await connectRedis();

    // Connect to Redis for user rate limiting (Phase 3)
    // DISABLED for development - uncomment when Redis is available
    // await connectUserRateLimiter();

    logger.info('✅ Application initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize application', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
};

// Start server
let server;

const startServer = async () => {
  try {
    await initializeApp();

    server = app.listen(PORT, () => {
      logger.info(`🚀 Server berjalan di port ${PORT}`);
      logger.info(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(
        `🔒 Keamanan: ${process.env.NODE_ENV === 'production' ? 'Mode Production (Rate Limiting Aktif)' : 'Mode Development'}`
      );
      logger.info(`🧪 Try It (Swagger UI): http://localhost:${PORT}/finger-api/docs`);
      logger.info(`📖 Dokumentasi Lengkap tersedia di: http://localhost:${PORT}/finger-api/docs/`);
    });

    server.on('error', error => {
      if (error.code === 'EADDRINUSE') {
        logger.error(`❌ Port ${PORT} sudah digunakan!`);
        logger.error('💡 Solusi: Matikan aplikasi lain di port 3333 atau gunakan port berbeda');
        logger.error(`   Coba: PORT=3001 npm run dev`);
        process.exit(1);
      } else {
        logger.error('Server error:', {
          error: error.message,
          stack: error.stack
        });
        process.exit(1);
      }
    });
  } catch (error) {
    logger.error('Failed to start server', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
};

// Graceful shutdown handler
const gracefulShutdown = async signal => {
  logger.info(`${signal} received. Starting graceful shutdown...`);

  if (server) {
    // Stop accepting new connections
    server.close(async () => {
      logger.info('HTTP server closed');

      try {
        // Close database connection
        await prisma.$disconnect();

        // Disconnect Redis (Phase 2)
        // DISABLED for development - uncomment when Redis is available
        // await disconnectRedis();

        logger.info('Graceful shutdown complete');
        process.exit(0);
      } catch (error) {
        logger.error('Error during graceful shutdown', {
          error: error.message
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
process.on('uncaughtException', error => {
  logger.error('Uncaught Exception', {
    error: error.message,
    stack: error.stack
  });
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', {
    reason: reason,
    promise: promise
  });
  gracefulShutdown('UNHANDLED_REJECTION');
});

// Start the server
startServer();

