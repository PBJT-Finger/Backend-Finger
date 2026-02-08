// src/config/database.js
const { Sequelize } = require('sequelize');
const mysql = require('mysql2/promise');
const logger = require('../utils/logger');
require('dotenv').config();

// Sequelize instance for ORM operations (non-real-time CRUD)
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USERNAME, // Fixed: Changed from DB_USER to DB_USERNAME
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    dialect: 'mysql',
    logging: false, // Disabled all query logging for cleaner output
    pool: {
      max: 10, // Maximum connections
      min: 2, // Minimum connections
      acquire: 30000, // Maximum time to get connection
      idle: 10000 // Maximum idle time
    },
    define: {
      timestamps: true,
      underscored: true,
      paranoid: true // Enable soft deletes
    }
  }
);

// Raw MySQL connection pool for ADMS (real-time fingerprint data)
let rawPool;

const createRawPool = async () => {
  rawPool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USERNAME, // Fixed: Changed from DB_USER to DB_USERNAME
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
    connectionLimit: 20, // Higher limit for real-time operations
    queueLimit: 0,
    acquireTimeout: 60000,
    timeout: 60000
  });

  // Test connection
  try {
    await rawPool.query('SELECT 1');
    logger.info('Raw MySQL pool connected successfully');
  } catch (error) {
    logger.error('Raw MySQL pool connection failed', { error: error.message, stack: error.stack });
    throw error;
  }
};

const getRawPool = () => {
  if (!rawPool) {
    throw new Error('Raw MySQL pool not initialized');
  }
  return rawPool;
};

// Test Sequelize connection
const testSequelizeConnection = async () => {
  try {
    await sequelize.authenticate();
    logger.info('Sequelize connection established successfully');
  } catch (error) {
    logger.error('Sequelize connection failed', { error: error.message, stack: error.stack });
    throw error;
  }
};

module.exports = {
  sequelize,
  createRawPool,
  getRawPool,
  testSequelizeConnection
};
