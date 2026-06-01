/**
 * Prisma Helper Utilities
 *
 * Common utility functions for Prisma queries and transformations
 */

import prisma from '../config/prisma';
import logger from './logger';

/**
 * Test Database Connection
 * Verify Prisma can connect to the database
 *
 * @returns Connection status
 */
export async function testConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    logger.info('✅ Prisma database connection successful');
    return true;
  } catch (error) {
    logger.error('❌ Prisma database connection failed:', {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

interface DatabaseStats {
  employees: number;
  attendance: number;
  devices: number;
  shifts: number;
  admins: number;
  total: number;
}

/**
 * Get Database Statistics
 * Retrieve counts for all main tables
 *
 * @returns Table counts
 */
export async function getDatabaseStats(): Promise<DatabaseStats> {
  try {
    const [employees, attendance, devices, shifts, admins] = await Promise.all([
      prisma.employees.count(),
      prisma.attendance.count(),
      prisma.devices.count(),
      prisma.shifts.count(),
      prisma.admins.count(),
    ]);

    return {
      employees,
      attendance,
      devices,
      shifts,
      admins,
      total: employees + attendance + devices + shifts + admins,
    };
  } catch (error) {
    logger.error('Error getting database stats:', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Safely disconnect Prisma
 * Graceful shutdown helper
 */
export async function disconnect(): Promise<void> {
  try {
    await prisma.$disconnect();
    logger.info('Prisma disconnected successfully');
  } catch (error) {
    logger.error('Error disconnecting Prisma:', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Execute raw SQL query
 * Wrapper for $queryRaw with error handling
 *
 * @param query - SQL query
 * @param params - Query parameters
 * @returns Query results
 */
 
export async function executeRawQuery(query: string, params: any[] = []): Promise<any> {
  try {
    const result = await prisma.$queryRawUnsafe(query, ...params);
    return result;
  } catch (error) {
    logger.error('Raw query error:', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Format TIME field from Prisma
 * Convert DateTime to HH:MM:SS string
 *
 * @param dateTime - Prisma TIME field (returned as DateTime)
 * @returns Time in HH:MM:SS format
 */
export function formatTime(dateTime: Date | string | null | undefined): string | null {
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
 * @param date - Prisma DATE field
 * @returns Date in YYYY-MM-DD format
 */
export function formatDate(date: Date | null | undefined): string | null {
  if (!date) return null;
  return date.toISOString().split('T')[0] || null;
}
