// src/middlewares/auth.middleware.js - Middleware autentikasi JWT
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');
const { isBlacklisted } = require('../utils/tokenBlacklist');

/**
 * JWT Authentication Middleware
 * Validasi JWT token dari Authorization header
 * Keamanan: Bearer token wajib untuk semua protected routes
 * Phase 2: Added token blacklist checking untuk revocation support
 */
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      logger.warn('Autentikasi gagal: Token tidak disediakan', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path
      });
      return res.status(401).json({
        success: false,
        message: 'Access token diperlukan'
      });
    }

    // Phase 2: Check if token is blacklisted (revoked)
    const blacklisted = await isBlacklisted(token);
    if (blacklisted) {
      logger.warn('Autentikasi gagal: Token has been revoked', {
        ip: req.ip,
        tokenPrefix: token.substring(0, 15) + '...',
        path: req.path
      });
      return res.status(401).json({
        success: false,
        message: 'Token has been revoked. Please login again.'
      });
    }

    // Verifikasi JWT token
    jwt.verify(token, process.env.JWT_ACCESS_SECRET, (err, decoded) => {
      if (err) {
        logger.warn('Autentikasi gagal: Token tidak valid', {
          ip: req.ip,
          error: err.message,
          path: req.path
        });
        return res.status(403).json({
          success: false,
          message: 'Invalid or expired token'
        });
      }

      // Add user info to request object
      req.user = {
        id: decoded.id,
        username: decoded.username,
        role: decoded.role
      };

      // Log successful authentication
      logger.info('Authentication successful', {
        userId: req.user.id,
        username: req.user.username,
        path: req.path,
        method: req.method
      });

      next();
    });
  } catch (error) {
    logger.error('Authentication middleware error', {
      error: error.message,
      stack: error.stack,
      ip: req.ip,
      path: req.path
    });
    return res.status(500).json({
      success: false,
      message: 'Authentication error'
    });
  }
};

/**
 * Admin Role Check Middleware
 * Ensures user has admin role
 * Security: Only admin users can access certain endpoints
 */
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    logger.warn('Authorization failed: Admin role required', {
      userId: req.user?.id,
      username: req.user?.username,
      role: req.user?.role,
      path: req.path
    });
    return res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  }
  next();
};

/**
 * Request Logging Middleware
 * Logs all incoming requests for audit purposes
 */
const requestLogger = (req, res, next) => {
  const start = Date.now();

  // Log request
  logger.http('Request received', {
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id || 'unauthenticated'
  });

  // Log response
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.http('Request completed', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userId: req.user?.id || 'unauthenticated'
    });
  });

  next();
};

module.exports = {
  authenticateToken,
  requireAdmin,
  requestLogger
};
