// src/middlewares/errorHandler.middleware.js - Centralized Error Handler
const logger = require('../utils/logger');
const { AppError } = require('../utils/errors');
const { HTTP_STATUS } = require('../constants/app');

/**
 * Global error handler middleware
 * Must be placed after all routes
 */
const errorHandler = (err, req, res, next) => {
  let error = err;

  // Convert non-AppError errors to AppError
  if (!(error instanceof AppError)) {
    const statusCode = error.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR;
    const message = error.message || 'Internal server error';
    error = new AppError(message, statusCode, false);
  }

  // Log error
  if (error.isOperational) {
    // Operational errors (expected)
    logger.warn('Operational error', {
      name: error.name,
      message: error.message,
      statusCode: error.statusCode,
      path: req.path,
      method: req.method,
      ip: req.ip,
      userId: req.user?.id
    });
  } else {
    // Programming errors (unexpected)
    logger.error('Programming error', {
      name: error.name,
      message: error.message,
      statusCode: error.statusCode,
      stack: error.stack,
      path: req.path,
      method: req.method,
      ip: req.ip,
      userId: req.user?.id
    });
  }

  // Prepare response
  const isDevelopment = process.env.NODE_ENV !== 'production';
  const response = {
    success: false,
    message: error.message,
    statusCode: error.statusCode
  };

  // Include errors array for validation errors
  if (error.errors) {
    response.errors = error.errors;
  }

  // Include stack trace in development
  if (isDevelopment && error.stack) {
    response.stack = error.stack;
  }

  // Send response
  res.status(error.statusCode).json(response);
};

/**
 * Handler for 404 Not Found
 * Place this before error handler
 */
const notFoundHandler = (req, res, next) => {
  logger.warn('Route not found', {
    path: req.path,
    method: req.method,
    ip: req.ip
  });

  res.status(HTTP_STATUS.NOT_FOUND).json({
    success: false,
    message: `Route ${req.method} ${req.path} not found`
  });
};

/**
 * Async handler wrapper
 * Wraps async route handlers to catch errors
 */
const asyncHandler = fn => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler
};
