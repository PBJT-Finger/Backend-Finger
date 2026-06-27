/**
 * scripts/sync-device-users.ts
 *
 * Skrip utilitas CLI untuk menyelaraskan (sinkronisasi) master data pengguna
 * dari memori perangkat fingerprint fisik ke tabel database `employees`.
 *
 * Cara Menjalankan:
 *   npx tsx scripts/sync-device-users.ts
 */
import dotenv from 'dotenv';
dotenv.config();

import { ZkTcpClient } from '../src/infrastructure/zklib';
import prisma from '../src/config/prisma';

// Validasi konfigurasi perangkat di berkas .env
if (!process.env.FINGERPRINT_IP) {
  console.error('[FATAL] FINGERPRINT_IP belum diatur di dalam berkas .env');
  process.exit(1);
}

const DEVICE_IP = process.env.FINGERPRINT_IP;
const DEVICE_PORT = parseInt(process.env.FINGERPRINT_PORT ?? '4370', 10);
const CONNECTION_TIMEOUT_MS = parseInt(process.env.FINGERPRINT_TIMEOUT ?? '10000', 10);

async function syncDeviceUsers(): Promise<void> {
  console.log(`[INFO] Menghubungkan ke perangkat ${DEVICE_IP}:${DEVICE_PORT}...`);
  const zkInstance = new ZkTcpClient(DEVICE_IP, DEVICE_PORT, CONNECTION_TIMEOUT_MS);

  try {
    // 1. Membuka soket TCP dan melakukan handshake sesi
    await zkInstance.createSocket();
    await zkInstance.connect();
    console.log('[SUCCESS] Terhubung ke perangkat dan sesi berhasil diinisialisasi.');

    // 2. Menarik data master pengguna dari mesin
    console.log('[INFO] Menarik master data pengguna dari mesin...');
    const usersResponse = await zkInstance.getUsers();
    const rawUsers: any[] = usersResponse?.data || [];

    console.log(`[INFO] Ditemukan ${rawUsers.length} pengguna terdaftar di mesin.`);

    // 3. Melakukan sinkronisasi (upsert) ke tabel employees database
    for (const u of rawUsers) {
      const user_id = String(u.userId || u.uid);
      const nama = u.name || user_id;

      console.log(`[INFO] Menyinkronkan Pegawai -> User ID: ${user_id}, Nama: ${nama}`);

      // Upsert: Buat pegawai jika belum ada, atau perbarui jika sudah terdaftar
      await prisma.employees.upsert({
        where: { user_id: user_id },
        update: {
          nama: nama,
          shift_id: 1,
          is_active: true,
        },
        create: {
          user_id: user_id,
          nama: nama,
          jabatan: 'KARYAWAN', // Jabatan default yang dibutuhkan oleh enum database
          shift_id: 1,
          is_active: true,
        },
      });
    }

    console.log('[SUCCESS] Seluruh master data pengguna berhasil diselaraskan ke database.');
  } catch (error) {
    console.error('[ERROR] Gagal menjalankan sinkronisasi data pengguna:', error);
  } finally {
    console.log('[INFO] Memutuskan koneksi dari perangkat & database...');
    try {
      await zkInstance.disconnect();
    } catch (e) {
      // Abaikan error saat proses pemutusan koneksi
    }
    await prisma.$disconnect();
  }
}

syncDeviceUsers();
