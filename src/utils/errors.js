// src/utils/errors.js - Custom Error Classes
const { HTTP_STATUS } = require('../constants/app');

/**
 * Base Application Error
 * Extends native Error with additional properties
 */
class AppError extends Error {
    constructor(message, statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        this.timestamp = new Date().toISOString();

        Error.captureStackTrace(this, this.constructor);
    }

    toJSON() {
        return {
            success: false,
            message: this.message,
            statusCode: this.statusCode,
            timestamp: this.timestamp
        };
    }
}

/**
 * Validation Error (400)
 * Used for input validation failures
 */
class ValidationError extends AppError {
    constructor(message, errors = []) {
        super(message, HTTP_STATUS.BAD_REQUEST);
        this.name = 'ValidationError';
        this.errors = errors;
    }

    toJSON() {
        return {
            success: false,
            message: this.message,
            errors: this.errors,
            statusCode: this.statusCode
        };
    }
}

/**
 * Authentication Error (401)
 * Used for authentication failures
 */
class AuthenticationError extends AppError {
    constructor(message = 'Authentication failed') {
        super(message, HTTP_STATUS.UNAUTHORIZED);
        this.name = 'AuthenticationError';
    }
}

/**
 * Authorization Error (403)
 * Used when user doesn't have permission
 */
class AuthorizationError extends AppError {
    constructor(message = 'Access forbidden') {
        super(message, HTTP_STATUS.FORBIDDEN);
        this.name = 'AuthorizationError';
    }
}

/**
 * Not Found Error (404)
 * Used when resource is not found
 */
class NotFoundError extends AppError {
    constructor(resource = 'Resource') {
        super(`${resource} not found`, HTTP_STATUS.NOT_FOUND);
        this.name = 'NotFoundError';
    }
}

/**
 * Conflict Error (409)
 * Used for duplicate resources or conflicts
 */
class ConflictError extends AppError {
    constructor(message = 'Resource already exists') {
        super(message, HTTP_STATUS.CONFLICT);
        this.name = 'ConflictError';
    }
}

/**
 * Rate Limit Error (429)
 * Used when rate limit is exceeded
 */
class RateLimitError extends AppError {
    constructor(message = 'Too many requests') {
        super(message, HTTP_STATUS.TOO_MANY_REQUESTS);
        this.name = 'RateLimitError';
    }
}

/**
 * Database Error (500)
 * Used for database operation failures
 */
class DatabaseError extends AppError {
    constructor(message = 'Database operation failed', originalError = null) {
        super(message, HTTP_STATUS.INTERNAL_SERVER_ERROR, false);
        this.name = 'DatabaseError';
        this.originalError = originalError;
    }
}

module.exports = {
    AppError,
    ValidationError,
    AuthenticationError,
    AuthorizationError,
    NotFoundError,
    ConflictError,
    RateLimitError,
    DatabaseError
};
