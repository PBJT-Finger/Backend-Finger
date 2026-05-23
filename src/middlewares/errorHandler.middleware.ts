/**
 * src/middlewares/errorHandler.middleware.ts — Centralized Error Handler
 *
 * Placement: Must be the LAST middleware registered in app.ts.
 * Express identifies a 4-argument middleware as an error handler.
 *
 * Response envelope contract (all errors):
 * {
 *   "success": false,
 *   "error": {
 *     "code":    "MACHINE_READABLE_CODE",
 *     "message": "Human readable description",
 *     "details": [] | undefined   (validation errors only)
 *   }
 * }
 *
 * Security: Stack traces are ONLY included in development mode.
 * Never expose internal stack traces in production responses.
 */

import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';
import { AppError, ValidationError } from '../utils/errors';
import { HTTP_STATUS } from '../constants/app';

// ─── Global Error Handler ─────────────────────────────────────────────────────

/**
 * Handles all errors thrown or passed to next(err) in the application.
 * Converts non-AppError errors to AppError for uniform response shape.
 *
 * @param err  - Any thrown value (should be AppError, but may be anything)
 * @param req  - Express request (used for logging context)
 * @param res  - Express response (used to send error response)
 * @param _next - Required by Express signature for error handler detection
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  // Normalize to AppError
  let appError: AppError;

  if (err instanceof AppError) {
    appError = err;
  } else if (err instanceof Error) {
    appError = new AppError(
      err.message || 'Internal server error',
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      false,
      'INTERNAL_ERROR',
    );
  } else {
    appError = new AppError(
      'An unexpected error occurred',
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      false,
      'INTERNAL_ERROR',
    );
  }

  // Log with appropriate severity
  if (appError.isOperational) {
    logger.warn('Operational error', {
      code: appError.code,
      message: appError.message,
      statusCode: appError.statusCode,
      path: req.path,
      method: req.method,
      ip: req.ip,
      userId: req.user?.id,
      correlationId: req.correlationId,
    });
  } else {
    logger.error('Unexpected programming error', {
      code: appError.code,
      message: appError.message,
      statusCode: appError.statusCode,
      stack: appError.stack,
      path: req.path,
      method: req.method,
      ip: req.ip,
      userId: req.user?.id,
      correlationId: req.correlationId,
    });
  }

  // Build response body
  const isDevelopment = process.env['NODE_ENV'] !== 'production';

  const responseBody: Record<string, unknown> = {
    success: false,
    error: {
      code: appError.code,
      message: appError.message,
      // Include validation details only for ValidationError
      ...(appError instanceof ValidationError && { details: appError.details }),
      // Include stack in development for easier debugging
      ...(isDevelopment && { stack: appError.stack }),
    },
  };

  res.status(appError.statusCode).json(responseBody);
};

// ─── 404 Handler ─────────────────────────────────────────────────────────────

/**
 * Catches all requests that did not match any registered route.
 * Must be placed BEFORE the error handler but AFTER all route registrations.
 */
export const notFoundHandler = (req: Request, res: Response, _next: NextFunction): void => {
  logger.warn('Route not found', {
    path: req.path,
    method: req.method,
    ip: req.ip,
    correlationId: req.correlationId,
  });

  res.status(HTTP_STATUS.NOT_FOUND).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
    },
  });
};

// ─── Async Handler Wrapper ───────────────────────────────────────────────────

/**
 * Wraps an async Express route handler so that rejected promises are forwarded
 * to the global error handler via next(err).
 *
 * Usage:
 *   router.get('/path', asyncHandler(async (req, res) => { ... }));
 *
 * Without this, unhandled promise rejections silently fail or crash the process.
 */
export const asyncHandler = <T>(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<T>,
) =>
  (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
