import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

interface RateLimiterOptions {
  windowMs?: number;
  max?: number;
  keyPrefix?: string;
  message?: string;
  skipFailedRequests?: boolean;
}

// MOCK REDIS MULTI WORKFLOW
const mockMulti = {
  zremrangebyscore: () => mockMulti,
  zcard: () => mockMulti,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  zadd: (key: string, now: number, member: string) => mockMulti,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  expire: (key: string, seconds: number) => mockMulti,
  exec: async (): Promise<[Error | null, number][]> => [
    [null, 0],
    [null, 0],
    [null, 0],
    [null, 0],
  ],
};

const redis = {
  multi: () => mockMulti,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  zrem: async (key: string, member: string) => {},
};

let isConnected = false;

/**
 * Initialize Redis connection for user rate limiting (Mocked)
 */
export async function connectUserRateLimiter(): Promise<void> {
  isConnected = false; // Stay disconnected to use fail-open logic
  logger.info('User rate limiter service (Mocked) initialized');
}

/**
 * Create per-user rate limiter middleware
 */
export function createUserRateLimiter(options: RateLimiterOptions = {}) {
  const {
    windowMs = 15 * 60 * 1000,
    max = 100,
    keyPrefix = 'ratelimit:user:',
    message = 'Too many requests from this user, please try again later.',
    skipFailedRequests = false,
  } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void | Response> => {
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
      const multi = redis.multi();

      multi.zremrangebyscore();
      multi.zcard();
      const requestId = `${now}-${Math.random().toString(36).substring(7)}`;
      multi.zadd(key, now, requestId);
      multi.expire(key, Math.ceil(windowMs / 1000) + 10);

      const results = await multi.exec();

      if (!results || results.some((r) => r[0])) {
        throw new Error('Redis pipeline failed');
      }

      const zcardResult = results[1];
      const currentCount = zcardResult ? parseInt(String(zcardResult[1]), 10) : 0;

      // Check if limit exceeded
      if (currentCount >= max) {
        await redis.zrem(key, requestId);

        logger.warn('User rate limit exceeded', {
          userId,
          username: req.user.username,
          currentCount,
          limit: max,
          window: `${windowMs / 1000}s`,
          path: req.path,
        });

        const retryAfter = Math.ceil(windowMs / 1000);
        res.setHeader('Retry-After', retryAfter);

        return res.status(429).json({
          success: false,
          message,
          retryAfter: retryAfter,
          limit: max,
          current: currentCount,
        });
      }

      // Add rate limit info headers
      res.setHeader('X-RateLimit-Limit-User', max);
      res.setHeader('X-RateLimit-Remaining-User', Math.max(0, max - currentCount - 1));
      res.setHeader('X-RateLimit-Reset-User', new Date(now + windowMs).toISOString());

      const originalSend = res.send;
       
      res.send = function (data: any) {
        if (skipFailedRequests && res.statusCode >= 400) {
          redis.zrem(key, requestId).catch((err) =>
            logger.error('Failed to remove failed request from rate limit', {
              error: err instanceof Error ? err.message : String(err),
            })
          );
        }
        return originalSend.call(this, data);
      };

      next();
    } catch (error) {
      logger.error('User rate limit error', {
        error: error instanceof Error ? error.message : String(error),
        userId,
        path: req.path,
      });
      next();
    }
  };
}

/**
 * Predefined rate limiters for common use cases
 */
export const userRateLimits = {
  strict: createUserRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 50,
    message: 'Too many write requests from your account. Please try again later.',
  }),

  moderate: createUserRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 200,
    message: 'Too many read requests from your account. Please try again later.',
  }),

  lenient: createUserRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 500,
    message: 'Too many requests from your account. Please try again later.',
  }),
};
