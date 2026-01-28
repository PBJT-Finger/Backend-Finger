/**
 * Prisma Client Configuration
 * 
 * Singleton pattern for Prisma Client to prevent multiple instances
 * in development and ensure optimal connection pooling.
 * 
 * @see https://www.prisma.io/docs/guides/performance-and-optimization/connection-management
 */

const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

/**
 * Prisma Client Options
 * Configure logging and error handling
 */
const prismaOptions = {
    log: [
        { level: 'query', emit: 'event' },
        { level: 'error', emit: 'stdout' },
        { level: 'warn', emit: 'stdout' }
    ],
    errorFormat: 'minimal'
};

/**
 * Global Prisma Client Singleton
 * Prevents multiple instances in development with hot reload
 */
let prisma;

if (process.env.NODE_ENV === 'production') {
    // Production: Create single instance
    prisma = new PrismaClient(prismaOptions);
} else {
    // Development: Use global to preserve instance across hot reloads
    if (!global.prisma) {
        global.prisma = new PrismaClient(prismaOptions);
    }
    prisma = global.prisma;
}

/**
 * Query Logging (Development Only)
 * Log slow queries for performance monitoring
 */
if (process.env.NODE_ENV !== 'production') {
    prisma.$on('query', (e) => {
        if (e.duration > 100) { // Log queries slower than 100ms
            logger.warn(`Slow Query (${e.duration}ms): ${e.query}`);
        }
    });
}

/**
 * Graceful Shutdown
 * Disconnect Prisma Client on application shutdown
 */
process.on('beforeExit', async () => {
    await prisma.$disconnect();
    logger.info('Prisma Client disconnected');
});

process.on('SIGINT', async () => {
    await prisma.$disconnect();
    logger.info('Prisma Client disconnected (SIGINT)');
    process.exit(0);
});

process.on('SIGTERM', async () => {
    await prisma.$disconnect();
    logger.info('Prisma Client disconnected (SIGTERM)');
    process.exit(0);
});

module.exports = prisma;
