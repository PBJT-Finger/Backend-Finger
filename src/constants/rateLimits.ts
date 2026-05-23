/**
 * src/constants/rateLimits.ts — Rate limiting configurations
 *
 * Typed with Options interface from express-rate-limit.
 * ADMS_PUSH limiter retained for backwards compatibility but should be
 * removed once ADMS routes are fully deprecated (Sprint 4 cleanup).
 */
import type { Options } from 'express-rate-limit';

type RateLimitConfig = Partial<Options>;

export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  // Catch-all for general API endpoints
  GENERAL_API: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5000, // Increased significantly because frontend polling generates many requests
    message: {
      success: false,
      message: 'Too many requests from this IP, please try again later.',
    },
    standardHeaders: true,
    legacyHeaders: false,
  },

  // Strict limiter for login — prevents brute-force attacks
  AUTH_LOGIN: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env['NODE_ENV'] === 'production' ? 5 : 100, // Relaxed for development/testing
    skipSuccessfulRequests: true,
    message: {
      success: false,
      message: 'Too many authentication attempts, please try again later.',
    },
    standardHeaders: true,
    legacyHeaders: false,
  },

  // Export is CPU-intensive but infrequent — effectively unlimited
  EXPORT_API: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10_000,
    standardHeaders: true,
    legacyHeaders: false,
  },

  // Summary/analytics — calculation-heavy, moderate limit
  SUMMARY_API: {
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 500,
    message: {
      success: false,
      message: 'Too many summary requests. Please try again in a few minutes.',
    },
    standardHeaders: true,
    legacyHeaders: false,
  },

  // Dashboard reads
  DASHBOARD_API: {
    windowMs: 60 * 1000, // 1 minute
    max: 20,
    message: {
      success: false,
      message: 'Too many dashboard requests. Please wait a moment.',
    },
    standardHeaders: true,
    legacyHeaders: false,
  },


} as const;
