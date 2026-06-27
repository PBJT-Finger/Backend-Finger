/**
 * scripts/sync-attendance.ts
 *
 * Skrip utilitas CLI untuk melakukan sinkronisasi log absensi kehadiran secara manual
 * dari perangkat fingerprint ZKTeco ke basis data MySQL (Prisma).
 *
 * Cara Menjalankan:
 *   npx tsx scripts/sync-attendance.ts
 */
import dotenv from 'dotenv';
dotenv.config();

import prisma from '../src/config/prisma';
import { ZkTcpClient } from '../src/infrastructure/zklib';

async function syncAttendance(): Promise<void> {
  const startTime = Date.now();
  console.log('[SYNC-ATTENDANCE] 🚀 Memulai sinkronisasi kehadiran (Versi TS)...');

  // Validasi konfigurasi lingkungan .env
  if (!process.env['FINGERPRINT_IP']) {
    console.error('[FATAL] FINGERPRINT_IP belum diatur pada berkas .env');
    process.exit(1);
  }
  const deviceIp = process.env['FINGERPRINT_IP'];
  const devicePort = parseInt(process.env['FINGERPRINT_PORT'] ?? '4370', 10);
  const connectionTimeout = parseInt(process.env['FINGERPRINT_TIMEOUT'] ?? '10000', 10);
  console.log(`[SYNC-ATTENDANCE] Menggunakan Perangkat: ${deviceIp}:${devicePort}`);

  // Inisialisasi klien TCP ZKTeco
  const zkInstance = new ZkTcpClient(deviceIp, devicePort, connectionTimeout);

  try {
    // 1. Mengambil Master Data Pegawai yang Aktif dari Database
    console.log('[SYNC-ATTENDANCE] 📥 Mengambil data pegawai aktif...');
    const mappings: any[] = await prisma.$queryRaw`
      SELECT 
        e.user_id,
        e.nama,
        e.jabatan
      FROM employees e
      WHERE e.is_active = 1
    `;

    // Menyusun pemetaan Map untuk mempermudah pencarian (O(1)) berdasarkan user_id
    const employeeMapping = new Map<string, { user_id: string; nama: string; jabatan: string }>();
    mappings.forEach((m) => {
      employeeMapping.set(String(m.user_id), {
        user_id: m.user_id,
        nama: m.nama,
        jabatan: m.jabatan,
      });
    });

    console.log(`[SYNC-ATTENDANCE] ✅ Berhasil memuat ${employeeMapping.size} pemetaan data pegawai.`);

    // 2. Terhubung ke Perangkat Fingerprint dan Tarik Log Absensi
    console.log('[SYNC-ATTENDANCE] 🔌 Menghubungkan ke perangkat sidik jari...');
    await zkInstance.createSocket();
    await zkInstance.connect();
    console.log('[SYNC-ATTENDANCE] ✅ Koneksi berhasil.');

    const result = await zkInstance.getAttendances();
    const logs = result?.data ?? [];
    console.log(`[SYNC-ATTENDANCE] ✅ Berhasil menarik ${logs.length} log absensi dari mesin.`);

    if (logs.length === 0) {
      console.log('[SYNC-ATTENDANCE] ℹ️  Tidak ada data log absensi baru pada mesin.');
      return;
    }

    // 3. Melakukan Pemrosesan dan Penyimpanan Log ke Basis Data
    let successCount = 0;
    for (const log of logs) {
      const deviceUserId = String(log.deviceUserId || '');
      const employee = employeeMapping.get(deviceUserId);

      // Jika data log absen tidak cocok dengan data pegawai aktif di DB, abaikan
      if (!employee) {
        continue;
      }

      const scanTime = new Date(log.recordTime);
      const tanggal = new Date(scanTime);
      tanggal.setHours(0, 0, 0, 0); // Normalisasi ke tanggal tanpa jam (midnight)

      // Cari apakah catatan absensi pegawai bersangkutan pada tanggal tersebut sudah ada
      const existing = await prisma.attendance.findFirst({
        where: {
          user_id: employee.user_id,
          tanggal: tanggal,
          is_deleted: false,
        },
      });

      const hour = scanTime.getHours();
      const isMasuk = hour < 12; // Scan sebelum jam 12.00 diidentifikasi sebagai absen masuk

      if (existing) {
        // Jika data hari ini sudah ada, perbarui jam masuk atau jam keluar yang masih kosong
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
        // Jika belum ada data sama sekali pada tanggal tersebut, buat baris catatan baru
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
    console.log(
      `[SYNC-ATTENDANCE] ✅ Sinkronisasi selesai dalam ${duration} detik. Berhasil memproses ${successCount} catatan.`
    );
  } catch (error: any) {
    console.error('[SYNC-ATTENDANCE] 💥 Terjadi kesalahan fatal saat sinkronisasi:', error.message);
  } finally {
    // Memastikan koneksi soket mesin dan basis data ditutup dengan aman
    try {
      await zkInstance.disconnect();
    } catch {}
    await prisma.$disconnect();
  }
}

// Menjalankan skrip sinkronisasi
syncAttendance();
