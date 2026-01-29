/**
 * Response Formatter Utility
 * Provides consistent response formats across all API endpoints
 */

/**
 * Send success response
 * @param {Response} res - Express response object
 * @param {Object|Array} data - Response data
 * @param {String} message - Success message
 * @param {Number} statusCode - HTTP status code (default: 200)
 */
const successResponse = (res, data = null, message = 'Success', statusCode = 200) => {
    const response = {
        success: true,
        message
    };

    if (data !== null) {
        response.data = data;
    }

    return res.status(statusCode).json(response);
};

/**
 * Send error response
 * @param {Response} res - Express response object
 * @param {String} message - Error message
 * @param {Number} statusCode - HTTP status code (default: 400)
 */
const errorResponse = (res, message = 'An error occurred', statusCode = 400) => {
    return res.status(statusCode).json({
        success: false,
        message
    });
};

/**
 * Send login/authentication response
 * @param {Response} res - Express response object
 * @param {Object} user - User object
 * @param {String} token - JWT access token
 * @param {String} refreshToken - JWT refresh token (optional)
 * @param {String} message - Success message
 */
const loginResponse = (res, user, token, refreshToken = null, message = 'Login berhasil') => {
    const response = {
        success: true,
        message,
        data: {
            user: {
                id: user.id,
                email: user.email,
                username: user.username,
                role: user.role,
                name: user.username // Using username as name for now
            },
            tokens: {
                access_token: token,
                refresh_token: refreshToken,
                token_type: 'Bearer',
                expires_in: 15 * 60 // 15 minutes in seconds
            }
        }
    };

    return res.status(200).json(response);
};

/**
 * Send paginated response
 * @param {Response} res - Express response object
 * @param {Array} data - Array of data items
 * @param {Object} pagination - Pagination metadata
 * @param {String} message - Success message
 */
const paginatedResponse = (res, data, pagination, message = 'Data retrieved successfully') => {
    return res.status(200).json({
        success: true,
        message,
        data,
        pagination: {
            page: pagination.page,
            limit: pagination.limit,
            total: pagination.total,
            totalPages: pagination.totalPages
        }
    });
};

/**
 * Send registration response
 * @param {Response} res - Express response object
 * @param {Object} user - User object
 * @param {String} message - Success message
 */
const registerResponse = (res, user, message = 'Registrasi berhasil. Silakan login.') => {
    return res.status(201).json({
        success: true,
        message,
        user: {
            id: user.id,
            email: user.email,
            username: user.username
        }
    });
};

/**
 * Send password reset related responses
 * @param {Response} res - Express response object
 * @param {Object} data - Optional data (e.g., resetToken)
 * @param {String} message - Success message
 */
const passwordResetResponse = (res, data = null, message = 'Kode verifikasi telah dikirim ke email Anda') => {
    const response = {
        success: true,
        message
    };

    if (data) {
        Object.assign(response, data);
    }

    return res.status(200).json(response);
};

module.exports = {
    successResponse,
    errorResponse,
    loginResponse,
    paginatedResponse,
    registerResponse,
    passwordResetResponse
};
