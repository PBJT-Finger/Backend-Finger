/**
 * Prisma Helper Utilities
 *
 * Common utility functions for Prisma queries and transformations
 */

const prisma = require('../config/prisma');
const logger = require('./logger');

/**
 * Test Database Connection
 * Verify Prisma can connect to the database
 *
 * @returns {Promise<boolean>} - Connection status
 */
async function testConnection() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    logger.info('✅ Prisma database connection successful');
    return true;
  } catch (error) {
    logger.error('❌ Prisma database connection failed:', error);
    return false;
  }
}

/**
 * Get Database Statistics
 * Retrieve counts for all main tables
 *
 * @returns {Promise<Object>} - Table counts
 */
async function getDatabaseStats() {
  try {
    const [employees, attendance, devices, shifts, admins] = await Promise.all([
      prisma.employees.count(),
      prisma.attendance.count(),
      prisma.devices.count(),
      prisma.shifts.count(),
      prisma.admins.count()
    ]);

    return {
      employees,
      attendance,
      devices,
      shifts,
      admins,
      total: employees + attendance + devices + shifts + admins
    };
  } catch (error) {
    logger.error('Error getting database stats:', error);
    throw error;
  }
}

/**
 * Safely disconnect Prisma
 * Graceful shutdown helper
 */
async function disconnect() {
  try {
    await prisma.$disconnect();
    logger.info('Prisma disconnected successfully');
  } catch (error) {
    logger.error('Error disconnecting Prisma:', error);
  }
}

/**
 * Execute raw SQL query
 * Wrapper for $queryRaw with error handling
 *
 * @param {string} query - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<Array>} - Query results
 */
async function executeRawQuery(query, params = []) {
  try {
    const result = await prisma.$queryRawUnsafe(query, ...params);
    return result;
  } catch (error) {
    logger.error('Raw query error:', error);
    throw error;
  }
}

/**
 * Format TIME field from Prisma
 * Convert DateTime to HH:MM:SS string
 *
 * @param {Date} dateTime - Prisma TIME field (returned as DateTime)
 * @returns {string} - Time in HH:MM:SS format
 */
function formatTime(dateTime) {
  if (!dateTime) return null;
  const date = new Date(dateTime);
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

/**
 * Format DATE field from Prisma
 * Convert Date to YYYY-MM-DD string
 *
 * @param {Date} date - Prisma DATE field
 * @returns {string} - Date in YYYY-MM-DD format
 */
function formatDate(date) {
  if (!date) return null;
  return date.toISOString().split('T')[0];
}

module.exports = {
  prisma,
  testConnection,
  getDatabaseStats,
  disconnect,
  executeRawQuery,
  formatTime,
  formatDate
};
