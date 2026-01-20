const Redis = require('ioredis');
const logger = require('./logger');

// Redis connection with retry strategy
const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
    },
    maxRetriesPerRequest: 3,
    lazyConnect: true // Don't connect immediately (graceful degradation)
});

redis.on('connect', () => {
    logger.info('✅ Redis connected - Token blacklist active');
});

redis.on('error', (err) => {
    logger.error('❌ Redis connection error - Token blacklist unavailable', {
        error: err.message
    });
});

/**
 * Add JWT token to blacklist
 * @param {string} token - Full JWT token string
 * @param {number} expirySeconds - TTL in seconds (should match token's exp)
 */
async function addToBlacklist(token, expirySeconds) {
    try {
        const key = `blacklist:${token}`;
        await redis.setex(key, expirySeconds, '1');

        logger.audit('TOKEN_BLACKLISTED', null, {
            tokenPrefix: token.substring(0, 15) + '...',
            expirySeconds,
            expiresAt: new Date(Date.now() + expirySeconds * 1000).toISOString()
        });

        return true;
    } catch (error) {
        logger.error('Failed to blacklist token', {
            error: error.message
        });
        // Don't throw - graceful degradation
        return false;
    }
}

/**
 * Check if JWT token is blacklisted
 * @param {string} token - Full JWT token string
 * @returns {Promise<boolean>} true if blacklisted, false otherwise
 */
async function isBlacklisted(token) {
    try {
        const key = `blacklist:${token}`;
        const result = await redis.exists(key);
        return result === 1;
    } catch (error) {
        logger.error('Failed to check token blacklist', {
            error: error.message
        });
        // If Redis is down, allow the token (fail open)
        // This prevents total auth failure if Redis crashes
        return false;
    }
}

/**
 * Get blacklist statistics (for monitoring/health checks)
 * @returns {Promise<object>} Stats about blacklisted tokens
 */
async function getStats() {
    try {
        const keys = await redis.keys('blacklist:*');
        const memory = await redis.info('memory');

        return {
            totalBlacklisted: keys.length,
            redisStatus: redis.status,
            memoryUsage: memory.split('\n')[1] // used_memory_human
        };
    } catch (error) {
        logger.error('Failed to get blacklist stats', {
            error: error.message
        });
        return {
            totalBlacklisted: 0,
            redisStatus: 'error',
            error: error.message
        };
    }
}

/**
 * Connect to Redis (call during app startup)
 */
async function connect() {
    try {
        await redis.connect();
        logger.info('Token blacklist service initialized');
    } catch (error) {
        logger.warn('Token blacklist service unavailable - continuing without Redis', {
            error: error.message
        });
    }
}

/**
 * Gracefully close Redis connection (call during shutdown)
 */
async function disconnect() {
    try {
        await redis.quit();
        logger.info('Token blacklist service disconnected');
    } catch (error) {
        logger.error('Error disconnecting token blacklist', {
            error: error.message
        });
    }
}

module.exports = {
    addToBlacklist,
    isBlacklisted,
    getStats,
    connect,
    disconnect,
    redis // Export for direct access if needed
};
