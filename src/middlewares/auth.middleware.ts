/**
 * src/middlewares/auth.middleware.ts — JWT Authentication & Authorization
 *
 * This middleware sits at the Express boundary — all inputs are untrusted.
 * Failure modes handled:
 *   - No token in header → 401
 *   - Token on blacklist (revoked) → 401
 *   - Invalid/expired JWT signature → 403
 *   - JWT payload missing required fields → 403
 *
 * Security: JWT_ACCESS_SECRET is read from the validated env — never from
 * process.env directly — to guarantee it has been validated at startup.
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import logger from '../utils/logger';
import { isBlacklisted } from '../utils/tokenBlacklist';
import { AuthenticationError } from '../utils/errors';
import { env } from '../config/env';
import type { AuthenticatedUser } from '../types/express.d';

// ─── Internal Types ───────────────────────────────────────────────────────────

/** Shape of the JWT payload we encode during token signing. */
interface JwtPayload {
  id: number;
  username: string;
  role: string;
  iat?: number;
  exp?: number;
}

// ─── Middlewares ──────────────────────────────────────────────────────────────

/**
 * Validates the Bearer JWT from the Authorization header.
 * On success, populates `req.user` with the decoded payload.
 * On failure, returns a 401/403 response — never calls next(err) for auth failures
 * to prevent error handler from leaking internal details.
 */
export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader?.split(' ')[1]; // Expect: "Bearer <token>"

    if (!token) {
      logger.warn('Auth failed: No token provided', {
        ip: req.ip,
        path: req.path,
        correlationId: req.correlationId,
      });
      res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_MISSING',
          message: 'Access token is required',
        },
      });
      return;
    }

    // Check token revocation BEFORE signature verification to avoid wasting CPU
    const revoked = await isBlacklisted(token);
    if (revoked) {
      logger.warn('Auth failed: Token has been revoked', {
        ip: req.ip,
        path: req.path,
        tokenPrefix: token.substring(0, 10) + '...',
        correlationId: req.correlationId,
      });
      res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_REVOKED',
          message: 'Token has been revoked. Please login again.',
        },
      });
      return;
    }

    // Synchronous verify — throws if invalid or expired
    let decoded: JwtPayload;
    try {
      decoded = jwt.verify(token, env.JWT_ACCESS_SECRET as string) as unknown as JwtPayload;
    } catch (jwtErr) {
      const msg = jwtErr instanceof Error ? jwtErr.message : 'Invalid token';
      logger.warn('Auth failed: JWT verification error', {
        ip: req.ip,
        path: req.path,
        reason: msg,
        correlationId: req.correlationId,
      });
      res.status(403).json({
        success: false,
        error: {
          code: 'TOKEN_INVALID',
          message: 'Invalid or expired token',
        },
      });
      return;
    }

    // Validate payload shape before trusting it
    if (typeof decoded.id !== 'number' || !decoded.username || !decoded.role) {
      throw new AuthenticationError('Malformed token payload');
    }

    const user: AuthenticatedUser = {
      id: decoded.id,
      username: decoded.username,
      role: decoded.role,
    };

    req.user = user;

    logger.info('Authentication successful', {
      userId: user.id,
      username: user.username,
      path: req.path,
      method: req.method,
      correlationId: req.correlationId,
    });

    next();
  } catch (error) {
    logger.error('Authentication middleware error', {
      error: error instanceof Error ? error.message : String(error),
      ip: req.ip,
      path: req.path,
      correlationId: req.correlationId,
    });
    res.status(500).json({
      success: false,
      error: {
        code: 'AUTHENTICATION_ERROR',
        message: 'Authentication service error',
      },
    });
  }
};

/**
 * Role-based access control middleware.
 * Must be placed AFTER authenticateToken in the middleware chain.
 * Accepts a list of permitted roles — defaults to admin-only if none provided.
 */
export const requireRole = (...allowedRoles: string[]) =>
  (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHENTICATED', message: 'Authentication required' },
      });
      return;
    }

    const permitted = allowedRoles.length > 0
      ? allowedRoles.map((r) => r.toUpperCase())
      : ['ADMIN', 'SUPER_ADMIN'];

    if (!permitted.includes(req.user.role.toUpperCase())) {
      logger.warn('Authorization failed: insufficient role', {
        userId: req.user.id,
        role: req.user.role,
        required: permitted,
        path: req.path,
        correlationId: req.correlationId,
      });
      res.status(403).json({
        success: false,
        error: { code: 'AUTHORIZATION_FAILED', message: 'Insufficient permissions' },
      });
      return;
    }

    next();
  };

/** Shorthand: admin-only route guard */
export const requireAdmin = requireRole('ADMIN', 'SUPER_ADMIN');

/**
 * HTTP request logging middleware.
 * Logs method, path, status code, and duration on response finish.
 * Placed early in the middleware stack so it captures all requests.
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();

  logger.http('Request received', {
    method: req.method,
    path: req.path,
    ip: req.ip,
    correlationId: req.correlationId,
  });

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.http('Request completed', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: duration,
      userId: req.user?.id,
      correlationId: req.correlationId,
    });
  });

  next();
};
