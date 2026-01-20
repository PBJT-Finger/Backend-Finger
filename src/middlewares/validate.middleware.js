// src/middlewares/validate.middleware.js - Validation error handler
const { validationResult } = require('express-validator');
const logger = require('../utils/logger');

/**
 * Middleware to handle validation errors from express-validator
 * Place this after validation chains in routes
 */
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        const extractedErrors = errors.array().map(err => ({
            field: err.param || err.path,
            message: err.msg,
            value: err.value
        }));

        // Log validation failures for monitoring
        logger.warn('Validation failed', {
            path: req.path,
            method: req.method,
            ip: req.ip,
            errors: extractedErrors
        });

        return res.status(400).json({
            success: false,
            message: 'Input validation failed',
            errors: extractedErrors
        });
    }

    next();
};

/**
 * Sanitize request inputs
 * Remove potentially dangerous characters
 */
const sanitizeInputs = (req, res, next) => {
    // Sanitize query parameters
    if (req.query) {
        Object.keys(req.query).forEach(key => {
            if (typeof req.query[key] === 'string') {
                // Remove null bytes and excessive whitespace
                req.query[key] = req.query[key]
                    .replace(/\0/g, '')
                    .trim();
            }
        });
    }

    // Sanitize body parameters
    if (req.body && typeof req.body === 'object') {
        Object.keys(req.body).forEach(key => {
            if (typeof req.body[key] === 'string') {
                req.body[key] = req.body[key]
                    .replace(/\0/g, '')
                    .trim();
            }
        });
    }

    next();
};

module.exports = {
    handleValidationErrors,
    sanitizeInputs
};
