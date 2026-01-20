/**
 * Per-User Rate Limiting Middleware
 * Prevents authenticated users from abusing API endpoints
 * Uses Redis sorted sets for efficient time-windowed request tracking
 * 
 * Phase 3 - Final P1 Enhancement
 */

const Redis = require('ioredis');
const logger = require('../utils/logger');

// Reuse Redis connection from tokenBlacklist or create new
const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    lazyConnect: true,
    retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
    }
});

let isConnected = false;

/**
 * Initialize Redis connection for user rate limiting
 */
async function connectUserRateLimiter() {
    if (isConnected) return;

    try {
        await redis.connect();
        isConnected = true;
        logger.info('✅ User rate limiter Redis connected');
    } catch (error) {
        logger.warn('⚠️ User rate limiter Redis connection failed (graceful degradation)', {
            error: error.message
        });
    }
}

/**
 * Create per-user rate limiter middleware
 * @param {Object} options - Configuration options
 * @param {number} options.windowMs - Time window in milliseconds (default: 15 min)
 * @param {number} options.max - Max requests per window (default: 100)
 * @param {string} options.keyPrefix - Redis key prefix (default: 'ratelimit:user:')
 * @param {string} options.message - Error message when limit exceeded
 */
function createUserRateLimiter(options = {}) {
    const {
        windowMs = 15 * 60 * 1000, // 15 minutes
        max = 100,                  // Max requests per window
        keyPrefix = 'ratelimit:user:',
        message = 'Too many requests from this user, please try again later.',
        skipFailedRequests = false // Don't count failed requests
    } = options;

    return async (req, res, next) => {
        // Skip if no authenticated user
        if (!req.user || !req.user.id) {
            return next();
        }

        // Skip if Redis not connected (fail open)
        if (!isConnected) {
            return next();
        }

        const userId = req.user.id;
        const key = `${keyPrefix}${userId}`;
        const now = Date.now();
        const windowStart = now - windowMs;

        try {
            // Use Redis pipeline for atomic operations
            const multi = redis.multi();

            // 1. Remove old entries outside current window
            multi.zremrangebyscore(key, 0, windowStart);

            // 2. Count current requests in window
            multi.zcard(key);

            // 3. Add current request timestamp
            const requestId = `${now}-${Math.random().toString(36).substring(7)}`;
            multi.zadd(key, now, requestId);

            // 4. Set expiry on key (cleanup)
            multi.expire(key, Math.ceil(windowMs / 1000) + 10); // +10s buffer

            const results = await multi.exec();

            // Check for Redis errors
            if (!results || results.some(r => r[0])) {
                throw new Error('Redis pipeline failed');
            }

            const currentCount = parseInt(results[1][1], 10); // Result from zcard

            // Check if limit exceeded (before adding this request)
            if (currentCount >= max) {
                // Remove the request we just added
                await redis.zrem(key, requestId);

                logger.warn('User rate limit exceeded', {
                    userId,
                    username: req.user.username,
                    currentCount,
                    limit: max,
                    window: `${windowMs / 1000}s`,
                    path: req.path
                });

                // Set Retry-After header (seconds)
                const retryAfter = Math.ceil(windowMs / 1000);
                res.setHeader('Retry-After', retryAfter);

                return res.status(429).json({
                    success: false,
                    message,
                    retryAfter: retryAfter,
                    limit: max,
                    current: currentCount
                });
            }

            // Add rate limit info headers
            res.setHeader('X-RateLimit-Limit-User', max);
            res.setHeader('X-RateLimit-Remaining-User', Math.max(0, max - currentCount - 1));
            res.setHeader('X-RateLimit-Reset-User', new Date(now + windowMs).toISOString());

            // Track successful request
            const originalSend = res.send;
            res.send = function (data) {
                if (skipFailedRequests && res.statusCode >= 400) {
                    // Remove request from count if it failed
                    redis.zrem(key, requestId).catch(err =>
                        logger.error('Failed to remove failed request from rate limit', { error: err.message })
                    );
                }
                return originalSend.call(this, data);
            };

            next();
        } catch (error) {
            logger.error('User rate limit error', {
                error: error.message,
                userId,
                path: req.path
            });
            // Fail open - don't block requests on Redis errors
            next();
        }
    };
}

/**
 * Predefined rate limiters for common use cases
 */
const userRateLimits = {
    // Strict: For write operations (POST, PUT, DELETE)
    strict: createUserRateLimiter({
        windowMs: 15 * 60 * 1000,
        max: 50,
        message: 'Too many write requests from your account. Please try again later.'
    }),

    // Moderate: For read operations (GET)
    moderate: createUserRateLimiter({
        windowMs: 15 * 60 * 1000,
        max: 200,
        message: 'Too many read requests from your account. Please try again later.'
    }),

    // Lenient: For lightweight endpoints
    lenient: createUserRateLimiter({
        windowMs: 15 * 60 * 1000,
        max: 500,
        message: 'Too many requests from your account. Please try again later.'
    })
};

module.exports = {
    createUserRateLimiter,
    connectUserRateLimiter,
    userRateLimits
};
