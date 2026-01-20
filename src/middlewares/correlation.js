/**
 * Request Correlation Middleware
 * Adds unique correlation ID to each request for distributed tracing
 * Enables tracking requests across services and log aggregation
 * 
 * Phase 3 - Final P1 Enhancement
 */

const { v4: uuidv4 } = require('uuid');

/**
 * Request correlation ID middleware
 * Generates or uses existing X-Request-ID header
 * Attaches ID to request and response for tracing
 */
function requestCorrelation(req, res, next) {
    // Use existing X-Request-ID header or generate new UUID
    const correlationId = req.headers['x-request-id'] ||
        req.headers['x-correlation-id'] ||
        uuidv4();

    // Normalize and attach to request object
    req.correlationId = correlationId;

    // Add to response header for client tracking
    res.setHeader('X-Request-ID', correlationId);
    res.setHeader('X-Correlation-ID', correlationId);

    // Create child logger with correlation ID
    // This ensures all logs from this request include the ID
    if (req.app.locals.logger) {
        req.logger = req.app.locals.logger.child({ correlationId });
    }

    next();
}

/**
 * Enhanced request correlation with more metadata
 * Includes user ID, session ID, etc. when available
 */
function enhancedCorrelation(req, res, next) {
    // Generate correlation ID
    const correlationId = req.headers['x-request-id'] || uuidv4();
    req.correlationId = correlationId;

    // Build correlation metadata
    const correlationMeta = {
        correlationId,
        timestamp: new Date().toISOString(),
        method: req.method,
        path: req.path,
        ip: req.ip,
        userAgent: req.get('User-Agent')
    };

    // Add user info if authenticated
    if (req.user) {
        correlationMeta.userId = req.user.id;
        correlationMeta.username = req.user.username;
    }

    // Attach metadata to request
    req.correlationMeta = correlationMeta;

    // Set response headers
    res.setHeader('X-Request-ID', correlationId);
    res.setHeader('X-Correlation-ID', correlationId);

    next();
}

/**
 * Correlation ID validator
 * Ensures correlation ID format is valid
 */
function validateCorrelationId(id) {
    // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
}

module.exports = {
    requestCorrelation,
    enhancedCorrelation,
    validateCorrelationId
};
