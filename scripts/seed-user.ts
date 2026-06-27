/**
 * scripts/seed-user.ts
 *
 * Skrip utilitas CLI untuk memasukkan pengguna simulasi/dummy langsung ke perangkat ZKTeco.
 * Berguna untuk menguji apakah koneksi SDK dapat menulis data (write capability) ke dalam memori mesin sidik jari.
 */
import dotenv from 'dotenv';
dotenv.config();

// @ts-ignore
import ZKLib from 'node-zklib';

if (!process.env.FINGERPRINT_IP) {
  console.error('[FATAL] FINGERPRINT_IP belum diatur di dalam berkas .env');
  process.exit(1);
}
const DEVICE_IP = process.env.FINGERPRINT_IP;
const DEVICE_PORT = parseInt(process.env.FINGERPRINT_PORT ?? '4370', 10);
const CONNECTION_TIMEOUT_MS = parseInt(process.env.FINGERPRINT_TIMEOUT ?? '10000', 10);
const IN_PORT_TIMEOUT_MS = parseInt(process.env.IN_PORT_TIMEOUT_MS ?? '4000', 10);

async function seedUser(): Promise<void> {
  console.log(`[INFO] Menghubungkan ke ${DEVICE_IP}:${DEVICE_PORT}...`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const zkInstance: any = new (ZKLib as any)(
    DEVICE_IP,
    DEVICE_PORT,
    CONNECTION_TIMEOUT_MS,
    IN_PORT_TIMEOUT_MS
  );

  try {
    await zkInstance.createSocket();
    console.log('[SUCCESS] Terhubung ke mesin.');

    console.log('[INFO] Menyuntikkan user dummy (ID: 100, Nama: User Node, PIN: 12345)...');
    // Parameter node-zklib v1.3.0 setUser: (uid, userid, name, password, role = 0, cardno = 0)
    // uid (integer internal mesin), userid (string ID karyawan)
    await zkInstance.setUser(100, '100', 'User Node', '12345', 0, 0);
    console.log('[SUCCESS] User dummy berhasil dimasukkan ke mesin.');

    console.log('[INFO] Menarik seluruh data user dari mesin untuk verifikasi...');
    const users = await zkInstance.getUsers();
    console.log('[DATA] Pengguna saat ini di mesin:', users?.data);
  } catch (error) {
    console.error('[ERROR] Gagal menjalankan operasi seed user:', error);
  } finally {
    console.log('[INFO] Memutuskan koneksi...');
    try {
      await zkInstance.disconnect();
    } catch (e) {
      // Abaikan error disconnect dari library
    }
  }
}

seedUser();
