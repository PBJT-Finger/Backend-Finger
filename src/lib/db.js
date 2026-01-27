// lib/db.js - MySQL Connection Pool (Replaces Prisma)
const mysql = require('mysql2/promise');
const logger = require('../utils/logger');

let pool = null;

/**
 * Create MySQL connection pool
 */
const createPool = () => {
    if (pool) return pool;

    pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        connectionLimit: 20,
        queueLimit: 0,
        waitForConnections: true,
        enableKeepAlive: true,
        keepAliveInitialDelay: 0
    });

    logger.info('MySQL connection pool created');
    return pool;
};

/**
 * Get pool instance
 */
const getPool = () => {
    if (!pool) {
        return createPool();
    }
    return pool;
};

/**
 * Test database connection
 */
const testConnection = async () => {
    try {
        const pool = getPool();
        await pool.query('SELECT 1');
        logger.info('✅ MySQL connected to database');
        return true;
    } catch (error) {
        logger.error('❌ MySQL connection failed', {
            error: error.message,
            stack: error.stack
        });
        throw error;
    }
};

/**
 * Close pool (for graceful shutdown)
 */
const closePool = async () => {
    try {
        if (pool) {
            await pool.end();
            pool = null;
            logger.info('MySQL pool closed');
        }
    } catch (error) {
        logger.error('Error closing MySQL pool', {
            error: error.message
        });
    }
};

/**
 * Execute query with automatic connection handling
 */
const query = async (sql, params = []) => {
    const pool = getPool();
    const [rows] = await pool.execute(sql, params);
    return rows;
};

/**
 * Get a connection from pool for transactions
 */
const getConnection = async () => {
    const pool = getPool();
    return await pool.getConnection();
};

module.exports = {
    createPool,
    getPool,
    testConnection,
    closePool,
    query,
    getConnection
};
