// src/constants/rateLimits.js - Rate limiting configurations
module.exports = {
    // General API endpoints
    GENERAL_API: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100,
        message: {
            success: false,
            message: 'Too many requests from this IP, please try again later.'
        },
        standardHeaders: true,
        legacyHeaders: false
    },

    // Authentication endpoints (strict)
    AUTH_LOGIN: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 5, // 5 login attempts per 15min
        skipSuccessfulRequests: true,
        message: {
            success: false,
            message: 'Too many authentication attempts, please try again later.'
        },
        standardHeaders: true,
        legacyHeaders: false
    },

    // Export endpoints (resource intensive)
    EXPORT_API: {
        windowMs: 60 * 60 * 1000, // 1 hour
        max: 10,
        message: {
            success: false,
            message: 'Export request limit exceeded. Maximum 10 exports per hour.'
        },
        standardHeaders: true,
        legacyHeaders: false
    },

    // Summary/Analytics endpoints (calculation intensive)
    SUMMARY_API: {
        windowMs: 5 * 60 * 1000, // 5 minutes
        max: 30,
        message: {
            success: false,
            message: 'Too many summary requests. Please try again in a few minutes.'
        },
        standardHeaders: true,
        legacyHeaders: false
    },

    // ADMS push endpoint (external device integration)
    ADMS_PUSH: {
        windowMs: 1 * 60 * 1000, // 1 minute
        max: 100, // Max 100 attendance records per minute
        message: {
            success: false,
            message: 'ADMS push rate exceeded. Maximum 100 records per minute.'
        },
        standardHeaders: true,
        legacyHeaders: false
    },

    // Dashboard endpoints
    DASHBOARD_API: {
        windowMs: 1 * 60 * 1000, // 1 minute
        max: 20,
        message: {
            success: false,
            message: 'Too many dashboard requests. Please wait a moment.'
        },
        standardHeaders: true,
        legacyHeaders: false
    }
};
