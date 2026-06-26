/**
 * Prisma Helper Utilities
 *
 * Kumpulan fungsi utilitas pembantu umum untuk query Prisma ORM, manipulasi koneksi,
 * serta transformasi format tanggal/waktu yang dikembalikan dari database MySQL.
 */

import prisma from '../config/prisma'; // Prisma client
import logger from './logger'; // Logger aplikasi

/**
 * Menguji Koneksi Database.
 * Memastikan Prisma berhasil terhubung dengan server MySQL.
 *
 * @returns Status keberhasilan koneksi (true/false)
 */
export async function testConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    logger.info('✅ Koneksi database Prisma sukses dilakukan');
    return true;
  } catch (error) {
    logger.error('❌ Koneksi database Prisma gagal dilakukan:', {
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
 * Mengambil Statistik Database.
 * Menarik jumlah baris data (count) dari semua tabel utama sistem absensi.
 *
 * @returns Jumlah record per-tabel
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
    logger.error('Error saat mengambil statistik database:', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Memutus koneksi Prisma secara aman.
 * Digunakan saat server menerima sinyal shutdown (Graceful Shutdown).
 */
export async function disconnect(): Promise<void> {
  try {
    await prisma.$disconnect();
    logger.info('Koneksi Prisma berhasil diputus secara aman');
  } catch (error) {
    logger.error('Error saat memutuskan koneksi Prisma:', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Mengeksekusi Query SQL Mentah (Raw Query).
 * Pembungkus (wrapper) untuk $queryRawUnsafe dengan penanganan error.
 *
 * @param query - String SQL query mentah
 * @param params - Parameter query array
 * @returns Hasil query database
 */
export async function executeRawQuery(query: string, params: any[] = []): Promise<any> {
  try {
    const result = await prisma.$queryRawUnsafe(query, ...params);
    return result;
  } catch (error) {
    logger.error('Eror pada eksekusi raw query:', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Memformat kolom tipe TIME dari database.
 * Mengonversi objek DateTime dari Prisma menjadi format string HH:MM:SS lokal murni.
 *
 * @param dateTime - Nilai kolom TIME dari Prisma (dikembalikan sebagai objek Date)
 * @returns String waktu format HH:MM:SS atau null
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
 * Memformat kolom tipe DATE dari database.
 * Mengonversi objek Date dari Prisma menjadi format string YYYY-MM-DD.
 *
 * @param date - Kolom DATE dari Prisma
 * @returns String tanggal format YYYY-MM-DD atau null
 */
export function formatDate(date: Date | null | undefined): string | null {
  if (!date) return null;
  return date.toISOString().split('T')[0] || null;
}
