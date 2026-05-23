// scripts/sync-attendance.ts
// Auto-sync attendance logs from fingerprint device to database in TypeScript
// Usage: npx tsx scripts/sync-attendance.ts

import dotenv from 'dotenv';
dotenv.config();

import prisma from '../src/config/prisma';

import { ZkTcpClient } from '../src/infrastructure/zklib';

async function syncAttendance(): Promise<void> {
  const startTime = Date.now();
  console.log('[SYNC-ATTENDANCE] 🚀 Starting attendance sync (TS Version)...');
  if (!process.env['FINGERPRINT_IP']) {
    console.error('[FATAL] FINGERPRINT_IP is not set in .env');
    process.exit(1);
  }
  const deviceIp = process.env['FINGERPRINT_IP'];
  const devicePort = parseInt(process.env['FINGERPRINT_PORT'] ?? '4370', 10);
  const connectionTimeout = parseInt(process.env['FINGERPRINT_TIMEOUT'] ?? '10000', 10);
  console.log(`[SYNC-ATTENDANCE] Device: ${deviceIp}:${devicePort}`);

  // Create zkInstance with matching connection parameters
  const zkInstance = new ZkTcpClient(
    deviceIp,
    devicePort,
    connectionTimeout
  );

  try {
    // 1. Fetch employees
    console.log('[SYNC-ATTENDANCE] 📥 Fetching employees...');
    const mappings: any[] = await prisma.$queryRaw`
      SELECT 
        e.user_id,
        e.nama,
        e.jabatan
      FROM employees e
      WHERE e.is_active = 1
    `;

    const employeeMapping = new Map<string, { user_id: string; nama: string; jabatan: string }>();
    mappings.forEach((m) => {
      employeeMapping.set(String(m.user_id), {
        user_id: m.user_id,
        nama: m.nama,
        jabatan: m.jabatan,
      });
    });

    console.log(`[SYNC-ATTENDANCE] ✅ Loaded ${employeeMapping.size} employee mappings`);

    // 2. Connect to device and fetch logs
    console.log('[SYNC-ATTENDANCE] 🔌 Connecting to fingerprint device...');
    await zkInstance.createSocket();
    await zkInstance.connect();
    console.log('[SYNC-ATTENDANCE] ✅ Connected.');

    const result = await zkInstance.getAttendances();
    const logs = result?.data ?? [];
    console.log(`[SYNC-ATTENDANCE] ✅ Fetched ${logs.length} attendance logs from device`);

    if (logs.length === 0) {
      console.log('[SYNC-ATTENDANCE] ℹ️  No logs found on device.');
      return;
    }

    // 3. Process logs and save to DB
    let successCount = 0;
    for (const log of logs) {
      const deviceUserId = String(log.deviceUserId || '');
      const employee = employeeMapping.get(deviceUserId);

      if (!employee) {
        continue;
      }

      const scanTime = new Date(log.recordTime);
      const tanggal = new Date(scanTime);
      tanggal.setHours(0, 0, 0, 0); // Normalize to date-only

      // Check if attendance already exists
      const existing = await prisma.attendance.findFirst({
        where: {
          user_id: employee.user_id,
          tanggal: tanggal,
          is_deleted: false,
        },
      });

      const hour = scanTime.getHours();
      const isMasuk = hour < 12; // Morning scan represents incoming absensi

      if (existing) {
        if (isMasuk && !existing.jam_masuk) {
          await prisma.attendance.update({
            where: { id: existing.id },
            data: { jam_masuk: scanTime, updated_at: new Date() },
          });
          successCount++;
        } else if (!isMasuk && !existing.jam_keluar) {
          await prisma.attendance.update({
            where: { id: existing.id },
            data: { jam_keluar: scanTime, updated_at: new Date() },
          });
          successCount++;
        }
      } else {
        const insertData: any = {
          user_id: employee.user_id,
          nama: employee.nama,
          jabatan: employee.jabatan === 'DOSEN' ? 'DOSEN' : 'KARYAWAN',
          tanggal: tanggal,
          device_id: deviceIp,
          verification_method: 'SIDIK_JARI',
          status: 'HADIR',
        };

        if (isMasuk) {
          insertData.jam_masuk = scanTime;
        } else {
          insertData.jam_keluar = scanTime;
        }

        await prisma.attendance.create({ data: insertData });
        successCount++;
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[SYNC-ATTENDANCE] ✅ Sync completed in ${duration}s. Processed ${successCount} entries.`);
  } catch (error: any) {
    console.error('[SYNC-ATTENDANCE] 💥 Fatal error during sync:', error.message);
  } finally {
    try {
      await zkInstance.disconnect();
    } catch {}
    await prisma.$disconnect();
  }
}

// Run if executed directly
syncAttendance();
