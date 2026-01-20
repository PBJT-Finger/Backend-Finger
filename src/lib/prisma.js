// lib/prisma.js - Prisma Client Singleton for Backend-Finger
// This ensures we reuse the same Prisma Client instance across the application

const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

const prismaClientSingleton = () => {
    return new PrismaClient({
        log: [
            {
                emit: 'event',
                level: 'query',
            },
            {
                emit: 'event',
                level: 'error',
            },
            {
                emit: 'event',
                level: 'info',
            },
            {
                emit: 'event',
                level: 'warn',
            },
        ],
    });
};

// Declare global type for TypeScript compatibility
const globalForPrisma = globalThis;

// Create singleton instance
const prisma = globalForPrisma.prisma ?? prismaClientSingleton();

// Log queries in development mode
if (process.env.NODE_ENV !== 'production') {
    prisma.$on('query', (e) => {
        logger.debug('Prisma Query', {
            query: e.query,
            duration: `${e.duration}ms`,
        });
    });
}

// Log errors
prisma.$on('error', (e) => {
    logger.error('Prisma Error', {
        message: e.message,
    });
});

// In development, attach prisma to global object to prevent multiple instances during hot reload
if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma;
}

/**
 * Test Prisma connection
 */
const testPrismaConnection = async () => {
    try {
        await prisma.$connect();
        logger.info('✅ Prisma connected to database');

        // Test query
        await prisma.$queryRaw`SELECT 1`;
        logger.info('✅ Prisma database query test successful');

        return true;
    } catch (error) {
        logger.error('❌ Prisma connection failed', {
            error: error.message,
            stack: error.stack
        });
        throw error;
    }
};

/**
 * Disconnect Prisma (for graceful shutdown)
 */
const disconnectPrisma = async () => {
    try {
        await prisma.$disconnect();
        logger.info('Prisma disconnected');
    } catch (error) {
        logger.error('Error disconnecting Prisma', {
            error: error.message
        });
    }
};

module.exports = {
    prisma,
    testPrismaConnection,
    disconnectPrisma
};
