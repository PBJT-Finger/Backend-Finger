/**
 * src/utils/errors.ts — Typed Application Error Hierarchy
 *
 * All errors extend AppError, which extends native Error.
 * Controllers and middlewares should ONLY throw subclasses of AppError —
 * never throw raw Error objects or return error strings manually.
 *
 * The errorHandler middleware (errorHandler.middleware.ts) catches all AppError
 * subclasses and maps them to the standard API error envelope.
 *
 * Design: isOperational flag distinguishes expected business errors (4xx)
 * from programming bugs (5xx). Non-operational errors trigger full stack
 * logging and alert escalation in production.
 */

import { HTTP_STATUS, type HttpStatusCode } from '../constants/app';

// ─── Base Error ──────────────────────────────────────────────────────────────

export class AppError extends Error {
  public readonly statusCode: HttpStatusCode;
  /** Operational = expected by the domain (user input errors, not found, etc.) */
  public readonly isOperational: boolean;
  public readonly timestamp: string;
  /** Machine-readable error code for API clients to act on programmatically */
  public readonly code: string;

  constructor(
    message: string,
    statusCode: HttpStatusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR,
    isOperational = true,
    code = 'INTERNAL_ERROR',
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();
    this.code = code;

    // Maintains proper stack trace in V8 (Node.js)
    Error.captureStackTrace(this, this.constructor);
  }
}

// ─── 400 Validation ──────────────────────────────────────────────────────────

/**
 * Thrown when request input fails validation (missing fields, wrong types, etc.)
 * `details` carries the per-field validation messages for the API response.
 */
export class ValidationError extends AppError {
  public readonly details: Record<string, unknown>[];

  constructor(message: string, details: Record<string, unknown>[] = []) {
    super(message, HTTP_STATUS.BAD_REQUEST, true, 'VALIDATION_FAILED');
    this.name = 'ValidationError';
    this.details = details;
  }
}

// ─── 401 Authentication ───────────────────────────────────────────────────────

/**
 * Thrown when a JWT token is missing, expired, or revoked.
 * Never expose internal JWT error details to the caller.
 */
export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, HTTP_STATUS.UNAUTHORIZED, true, 'AUTHENTICATION_FAILED');
    this.name = 'AuthenticationError';
  }
}

// ─── 403 Authorization ───────────────────────────────────────────────────────

/**
 * Thrown when a valid user attempts an action beyond their role permissions.
 */
export class AuthorizationError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super(message, HTTP_STATUS.FORBIDDEN, true, 'AUTHORIZATION_FAILED');
    this.name = 'AuthorizationError';
  }
}

// ─── 404 Not Found ───────────────────────────────────────────────────────────

/**
 * Thrown when a requested resource does not exist.
 * `resource` should be the entity name (e.g. 'Employee', 'Device').
 */
export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, HTTP_STATUS.NOT_FOUND, true, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

// ─── 409 Conflict ────────────────────────────────────────────────────────────

/**
 * Thrown on unique constraint violations or business rule conflicts
 * (e.g. duplicate NIP, duplicate username).
 */
export class ConflictError extends AppError {
  constructor(message = 'Resource already exists') {
    super(message, HTTP_STATUS.CONFLICT, true, 'CONFLICT');
    this.name = 'ConflictError';
  }
}

// ─── 429 Rate Limit ──────────────────────────────────────────────────────────

export class RateLimitError extends AppError {
  constructor(message = 'Too many requests') {
    super(message, HTTP_STATUS.TOO_MANY_REQUESTS, true, 'RATE_LIMIT_EXCEEDED');
    this.name = 'RateLimitError';
  }
}

// ─── 500 Database ────────────────────────────────────────────────────────────

/**
 * Thrown by service layer when a database operation fails unexpectedly.
 * isOperational = false → triggers full stack trace logging.
 * originalError is NOT forwarded to the API response to avoid leaking internals.
 */
export class DatabaseError extends AppError {
  public readonly originalError: Error | null;

  constructor(message = 'Database operation failed', originalError: Error | null = null) {
    super(message, HTTP_STATUS.INTERNAL_SERVER_ERROR, false, 'DATABASE_ERROR');
    this.name = 'DatabaseError';
    this.originalError = originalError;
  }
}
