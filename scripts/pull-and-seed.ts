/**
 * scripts/pull-and-seed.ts
 *
 * Script standalone untuk:
 *  1. Menarik SEMUA data user dari alat fingerprint ZKTeco via TCP
 *  2. Mengekspor hasilnya sebagai file SQL seed (INSERT INTO employees)
 *
 * Jalankan di server Proxmox (yang bisa menjangkau 175.17.5.50):
 *   FINGERPRINT_IP=175.17.5.50 npx tsx scripts/pull-and-seed.ts
 *
 * Output: seeds/employees_from_device.sql
 */

import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import { ZkTcpClient } from '../src/infrastructure/zklib';

// ─── Konfigurasi ────────────────────────────────────────────────────────────
const DEVICE_IP   = process.env.FINGERPRINT_IP ?? '175.17.5.50';
const DEVICE_PORT = parseInt(process.env.FINGERPRINT_PORT ?? '4370', 10);
const TIMEOUT_MS  = parseInt(process.env.FINGERPRINT_TIMEOUT ?? '15000', 10);

// Shift default untuk semua karyawan yang belum ada assignment-nya
const DEFAULT_SHIFT_ID = 1;

// Output file
const OUTPUT_DIR  = path.resolve(__dirname, '../seeds');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'employees_from_device.sql');
const OUTPUT_JSON = path.join(OUTPUT_DIR, 'employees_from_device.json');

// ─── Helpers ────────────────────────────────────────────────────────────────
function escapeSQL(val: string): string {
  return val.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function buildSeedSQL(users: Array<{ userId: string; name: string }>): string {
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

  const lines: string[] = [
    '-- ============================================================',
    '-- employees_from_device.sql',
    `-- Generated: ${new Date().toISOString()}`,
    `-- Source   : ZKTeco @ ${DEVICE_IP}:${DEVICE_PORT}`,
    `-- Total    : ${users.length} records`,
    '-- ============================================================',
    '',
    '-- Pastikan tabel shifts memiliki setidaknya 1 baris (id=1) sebelum import ini.',
    '-- Gunakan: INSERT IGNORE INTO employees (...) untuk skip duplikat.',
    '',
    'START TRANSACTION;',
    '',
    'INSERT IGNORE INTO `employees`',
    '  (`user_id`, `nama`, `jabatan`, `shift_id`, `status`, `is_active`, `created_at`, `updated_at`)',
    'VALUES',
  ];

  const valueRows = users.map((u, idx) => {
    const userId  = escapeSQL(u.userId);
    const nama    = escapeSQL(u.name || `User-${u.userId}`);
    // Default ke KARYAWAN — admin bisa update via UI setelah import
    const jabatan = 'KARYAWAN';
    const isLast  = idx === users.length - 1;
    return `  ('${userId}', '${nama}', '${jabatan}', ${DEFAULT_SHIFT_ID}, 'AKTIF', 1, '${now}', '${now}')${isLast ? '' : ','}`;
  });

  lines.push(...valueRows);
  lines.push('ON DUPLICATE KEY UPDATE');
  lines.push('  `nama`       = VALUES(`nama`),');
  lines.push('  `updated_at` = VALUES(`updated_at`);');
  lines.push('');
  lines.push('COMMIT;');
  lines.push('');
  lines.push(`-- Total ${users.length} employees di-seed dari alat fingerprint.`);

  return lines.join('\n');
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  console.log('='.repeat(60));
  console.log('[ ZKTeco Pull & Seed ]');
  console.log(`  Device : ${DEVICE_IP}:${DEVICE_PORT}`);
  console.log(`  Timeout: ${TIMEOUT_MS}ms`);
  console.log('='.repeat(60));

  const zk = new ZkTcpClient(DEVICE_IP, DEVICE_PORT, TIMEOUT_MS);

  try {
    // 1. Buat koneksi TCP ke alat
    console.log('\n[1/4] Membuka socket TCP ke alat...');
    await zk.createSocket();
    console.log('      ✓ Socket terbuka');

    // 2. Handshake / inisiasi sesi ZKTeco
    console.log('[2/4] Menginisiasi sesi ZKTeco...');
    await zk.connect();
    console.log('      ✓ Sesi berhasil');

    // 3. Ambil info alat dulu
    console.log('[3/4] Mengambil info alat...');
    try {
      const info = await zk.getInfo();
      console.log(`      ✓ User di alat : ${info.userCounts}`);
      console.log(`      ✓ Log absensi  : ${info.logCounts}`);
      console.log(`      ✓ Kapasitas log: ${info.logCapacity}`);
    } catch (e) {
      console.warn('      ⚠ Gagal ambil info alat, lanjut tarik user...');
    }

    // 4. Tarik semua user
    console.log('[4/4] Menarik data user dari alat...');
    const result = await zk.getUsers();
    const rawUsers = result.data ?? [];

    if (result.err) {
      console.warn(`      ⚠ Ada error saat tarik: ${result.err.message}`);
    }

    console.log(`      ✓ Berhasil: ${rawUsers.length} user ditemukan`);

    if (rawUsers.length === 0) {
      console.warn('\n[WARN] Tidak ada user di alat. Seed tidak dibuat.');
      return;
    }

    // Normalize data
    const users = rawUsers.map((u) => ({
      userId: String((u as any).userId ?? (u as any).uid ?? ''),
      name  : String((u as any).name ?? '').trim(),
    })).filter((u) => u.userId !== '');

    // Tampilkan daftar
    console.log('\n--- Daftar User dari Alat ---');
    users.forEach((u, i) => {
      console.log(`  [${String(i + 1).padStart(3, '0')}] ID: ${u.userId.padEnd(6)} | Nama: ${u.name}`);
    });
    console.log(`--- Total: ${users.length} user ---\n`);

    // Buat output dir jika belum ada
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    // Simpan JSON mentah
    fs.writeFileSync(OUTPUT_JSON, JSON.stringify(users, null, 2), 'utf-8');
    console.log(`[✓] JSON mentah tersimpan: ${OUTPUT_JSON}`);

    // Buat SQL seed
    const sql = buildSeedSQL(users);
    fs.writeFileSync(OUTPUT_FILE, sql, 'utf-8');
    console.log(`[✓] SQL seed tersimpan   : ${OUTPUT_FILE}`);

    console.log('\n[SELESAI] Untuk import ke MySQL jalankan:');
    console.log(`  mysql -u root -p finger_db < ${OUTPUT_FILE}`);
    console.log('\nAtau dari dalam container Docker:');
    console.log('  docker exec -i finger-be_mysql mysql -uroot -p<password> finger_db < seeds/employees_from_device.sql');

  } catch (err) {
    console.error('\n[ERROR] Gagal terhubung ke alat fingerprint:');
    console.error(err);
    console.error('\nPastikan:');
    console.error(`  1. Alat fingerprint menyala dan bisa di-ping dari server ini: ping ${DEVICE_IP}`);
    console.error('  2. Port 4370 tidak diblokir firewall');
    console.error('  3. Script ini dijalankan dari server Proxmox (bukan PC lokal)');
    process.exit(1);
  } finally {
    try {
      await zk.disconnect();
      console.log('\n[INFO] Koneksi ke alat ditutup.');
    } catch (_) {
      // abaikan error saat disconnect
    }
  }
}

main();
