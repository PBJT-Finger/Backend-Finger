/**
 * scripts/probe.ts
 *
 * Skrip utilitas CLI untuk menguji komunikasi langsung dengan mesin sidik jari ZKTeco.
 * Melakukan pemeriksaan port, koneksi soket, penarikan informasi dasar, daftar pengguna,
 * dan log kehadiran untuk memastikan perangkat keras online dan dapat diakses.
 */
import dotenv from 'dotenv';
dotenv.config();

import { ZkTcpClient } from '../src/infrastructure/zklib';

// Seluruh konfigurasi perangkat WAJIB diambil dari .env - tidak diperbolehkan fallback IP.
// Jika variabel env tidak lengkap, skrip akan langsung berhenti untuk mencegah miskonfigurasi.
if (!process.env.FINGERPRINT_IP) {
  console.error('[FATAL] FINGERPRINT_IP belum diatur di dalam berkas .env');
  process.exit(1);
}
const DEVICE_IP = process.env.FINGERPRINT_IP;
const DEVICE_PORT = parseInt(process.env.FINGERPRINT_PORT ?? '4370', 10);
const CONNECTION_TIMEOUT_MS = parseInt(process.env.FINGERPRINT_TIMEOUT ?? '10000', 10);

async function runConnectionProbe(): Promise<void> {
  console.log(`[INFO] Menginisialisasi koneksi ke ${DEVICE_IP}:${DEVICE_PORT}...`);

  const zkInstance = new ZkTcpClient(DEVICE_IP, DEVICE_PORT, CONNECTION_TIMEOUT_MS);

  try {
    console.log('[INFO] Mencoba membuat soket TCP...');
    await zkInstance.createSocket();
    await zkInstance.connect();
    console.log('[SUCCESS] Soket berhasil dibuat dan sesi koneksi terhubung.');

    // Pengujian 1: Mendapatkan Informasi Perangkat
    try {
      console.log('\n[1/3] Menarik informasi dasar perangkat...');
      const deviceInfo = await zkInstance.getInfo();
      console.log('[DATA] Informasi Perangkat:', deviceInfo);
    } catch (e) {
      console.error('[ERROR] Gagal menarik informasi dasar perangkat:', e);
    }

    // Pengujian 2: Mendapatkan Master Data Pengguna
    try {
      console.log('\n[2/3] Menarik data pengguna (Master Data)...');
      const users = await zkInstance.getUsers();
      console.log(`[DATA] Ditemukan ${users?.data?.length || 0} pengguna.`);
      if (users?.data && users.data.length > 0) {
        console.log('[DATA] Contoh Data Pengguna:', users.data.slice(0, 5));
      }
    } catch (e) {
      console.error('[ERROR] Gagal menarik data pengguna dari mesin:', e);
    }

    // Pengujian 3: Mendapatkan Log Kehadiran
    try {
      console.log('\n[3/3] Menarik log kehadiran (Clock-ins)...');
      const attendances = await zkInstance.getAttendances();
      console.log(`[DATA] Ditemukan ${attendances?.data?.length || 0} catatan log kehadiran.`);
      if (attendances?.data && attendances.data.length > 0) {
        console.log('[DATA] Contoh Catatan Kehadiran:', attendances.data.slice(0, 5));
      }
    } catch (e) {
      console.error(
         '[ERROR] Gagal menarik log absensi. Buffer mesin mungkin masih kosong atau terjadi gangguan pembacaan.',
        e
      );
    }
  } catch (error) {
    console.error('[ERROR] Uji coba koneksi (probe) gagal berkomunikasi dengan perangkat biometrik:', error);
  } finally {
    console.log('\n[INFO] Menutup koneksi soket...');
    try {
      await zkInstance.disconnect();
      console.log('[SUCCESS] Koneksi berhasil diputuskan dengan bersih.');
    } catch (disconnectError) {
      // Abaikan error disconnect agar skrip tetap keluar dengan exit code 0
    }
  }
}

runConnectionProbe();
