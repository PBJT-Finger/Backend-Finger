/**
 * scripts/pull-and-seed.ts
 *
 * Skrip utilitas CLI mandiri (standalone) untuk:
 *   1. Menarik seluruh data pengguna dari mesin fingerprint ZKTeco via koneksi soket TCP.
 *   2. Memformat dan mengekspor hasilnya menjadi file SQL seed (INSERT INTO employees) dan file JSON.
 *
 * Cara Menjalankan (pastikan server dapat menjangkau IP mesin):
 *   FINGERPRINT_IP=192.168.137.50 npx tsx scripts/pull-and-seed.ts
 *
 * Berkas Keluaran:
 *   - seeds/employees_from_device.sql (Skrip SQL)
 *   - seeds/employees_from_device.json (Data JSON)
 */

import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import { ZkTcpClient } from '../src/infrastructure/zklib';

// ─── Konfigurasi Parameter Koneksi & Default ────────────────────────────────
const DEVICE_IP = process.env.FINGERPRINT_IP ?? '192.168.137.50';
const DEVICE_PORT = parseInt(process.env.FINGERPRINT_PORT ?? '4370', 10);
const TIMEOUT_MS = parseInt(process.env.FINGERPRINT_TIMEOUT ?? '15000', 10);

// ID shift kerja bawaan untuk seluruh pegawai baru yang diimpor dari mesin
const DEFAULT_SHIFT_ID = 1;

// Menentukan direktori dan berkas keluaran untuk data seeding
const OUTPUT_DIR = path.resolve(__dirname, '../seeds');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'employees_from_device.sql');
const OUTPUT_JSON = path.join(OUTPUT_DIR, 'employees_from_device.json');

// ─── Fungsi Pembantu (Helpers) ──────────────────────────────────────────────

/**
 * Mengamankan string teks agar aman dimasukkan ke dalam query SQL (mencegah SQL Injection).
 */
function escapeSQL(val: string): string {
  return val.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/**
 * Menyusun perintah INSERT SQL massal berdasarkan data pengguna yang berhasil ditarik.
 */
function buildSeedSQL(users: Array<{ userId: string; name: string }>): string {
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

  const lines: string[] = [
    '-- ============================================================',
    '-- employees_from_device.sql',
    `-- Dibuat otomatis pada: ${new Date().toISOString()}`,
    `-- Sumber Perangkat    : ZKTeco @ ${DEVICE_IP}:${DEVICE_PORT}`,
    `-- Jumlah Pengguna     : ${users.length} catatan`,
    '-- ============================================================',
    '',
    '-- Pastikan tabel shifts memiliki setidaknya 1 baris (id=1) sebelum mengimpor file ini.',
    '-- Menggunakan INSERT IGNORE agar tidak menimpa jika data sudah ada sebelumnya.',
    '',
    'START TRANSACTION;',
    '',
    'INSERT IGNORE INTO `employees`',
    '  (`user_id`, `nama`, `jabatan`, `shift_id`, `status`, `is_active`, `created_at`, `updated_at`)',
    'VALUES',
  ];

  const valueRows = users.map((u, idx) => {
    const userId = escapeSQL(u.userId);
    const nama = escapeSQL(u.name || `User-${u.userId}`);
    // Default jabatan diset ke KARYAWAN (bisa diperbarui admin lewat UI web nanti)
    const jabatan = 'KARYAWAN';
    const isLast = idx === users.length - 1;
    return `  ('${userId}', '${nama}', '${jabatan}', ${DEFAULT_SHIFT_ID}, 'AKTIF', 1, '${now}', '${now}')${isLast ? '' : ','}`;
  });

  lines.push(...valueRows);
  lines.push('ON DUPLICATE KEY UPDATE');
  lines.push('  `nama`       = VALUES(`nama`),');
  lines.push('  `updated_at` = VALUES(`updated_at`);');
  lines.push('');
  lines.push('COMMIT;');
  lines.push('');
  lines.push(`-- Selesai: Total ${users.length} pegawai berhasil di-seed.`);

  return lines.join('\n');
}

// ─── Fungsi Utama (Main Execution) ──────────────────────────────────────────
async function main(): Promise<void> {
  console.log('='.repeat(60));
  console.log('[ Penarikan Data & Seeding ZKTeco ]');
  console.log(`  IP Mesin : ${DEVICE_IP}:${DEVICE_PORT}`);
  console.log(`  Timeout  : ${TIMEOUT_MS}ms`);
  console.log('='.repeat(60));

  const zk = new ZkTcpClient(DEVICE_IP, DEVICE_PORT, TIMEOUT_MS);

  try {
    // 1. Membuka koneksi soket TCP
    console.log('\n[1/4] Membuka soket TCP ke mesin...');
    await zk.createSocket();
    console.log('      ✓ Soket berhasil dibuka');

    // 2. Melakukan handshake sesi dengan ZKTeco
    console.log('[2/4] Melakukan inisiasi sesi komunikasi...');
    await zk.connect();
    console.log('      ✓ Sesi berhasil terhubung');

    // 3. Mengambil informasi status mesin
    console.log('[3/4] Mengambil status informasi mesin...');
    try {
      const info = await zk.getInfo();
      console.log(`      ✓ Pengguna di mesin: ${info.userCounts}`);
      console.log(`      ✓ Jumlah log absensi: ${info.logCounts}`);
      console.log(`      ✓ Kapasitas memori  : ${info.logCapacity}`);
    } catch (e) {
      console.warn('      ⚠ Gagal mendapatkan informasi mesin, mencoba langsung menarik data pengguna...');
    }

    // 4. Menarik data seluruh pengguna
    console.log('[4/4] Menarik daftar pengguna dari mesin...');
    const result = await zk.getUsers();
    const rawUsers = result.data ?? [];

    if (result.err) {
      console.warn(`      ⚠ Terjadi kendala saat penarikan data: ${result.err.message}`);
    }

    console.log(`      ✓ Sukses: Ditemukan ${rawUsers.length} pengguna`);

    if (rawUsers.length === 0) {
      console.warn('\n[WARN] Tidak ada pengguna terdaftar pada mesin. Berkas SQL seed tidak akan dibuat.');
      return;
    }

    // Normalisasi struktur data pengguna
    const users = rawUsers
      .map((u) => ({
        userId: String((u as any).userId ?? (u as any).uid ?? ''),
        name: String((u as any).name ?? '').trim(),
      }))
      .filter((u) => u.userId !== '');

    // Menampilkan daftar pengguna yang ditarik ke layar konsol
    console.log('\n--- Daftar Pengguna Hasil Tarik Mesin ---');
    users.forEach((u, i) => {
      console.log(
        `  [${String(i + 1).padStart(3, '0')}] ID: ${u.userId.padEnd(6)} | Nama: ${u.name}`
      );
    });
    console.log(`--- Total: ${users.length} Pengguna ---\n`);

    // Membuat direktori keluaran jika belum tersedia
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    // Menyimpan berkas JSON mentah
    fs.writeFileSync(OUTPUT_JSON, JSON.stringify(users, null, 2), 'utf-8');
    console.log(`[✓] Berkas JSON mentah disimpan ke: ${OUTPUT_JSON}`);

    // Menyusun skrip SQL dan menyimpannya
    const sql = buildSeedSQL(users);
    fs.writeFileSync(OUTPUT_FILE, sql, 'utf-8');
    console.log(`[✓] Berkas SQL seed disimpan ke   : ${OUTPUT_FILE}`);

    console.log('\n[SELESAI] Untuk mengimpor hasil seed ke MySQL, jalankan:');
    console.log(`  mysql -u root -p nama_database < ${OUTPUT_FILE}`);
    console.log('\nAtau jika menggunakan kontainer Docker:');
    console.log(
      '  docker exec -i nama_kontainer_mysql mysql -uroot -p<password> nama_database < seeds/employees_from_device.sql'
    );
  } catch (err) {
    console.error('\n[ERROR] Gagal terhubung ke perangkat fingerprint:');
    console.error(err);
    console.error('\nPastikan:');
    console.error(
      `  1. Alat fingerprint menyala dan dapat di-ping dari server ini: ping ${DEVICE_IP}`
    );
    console.error('  2. Port komunikasi 4370 tidak diblokir oleh firewall');
    console.error('  3. Konfigurasi IP pada berkas .env sudah tepat');
    process.exit(1);
  } finally {
    try {
      await zk.disconnect();
      console.log('\n[INFO] Sesi koneksi ke alat telah ditutup.');
    } catch (_) {
      // Abaikan error saat proses pemutusan koneksi
    }
  }
}

main();
