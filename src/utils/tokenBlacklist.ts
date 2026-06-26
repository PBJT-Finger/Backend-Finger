/**
 * src/utils/tokenBlacklist.ts — Pencabutan Token JWT (Token Revocation)
 *
 * Implementasi saat ini: Menggunakan fallback penyimpanan memori lokal (in-memory Map).
 *
 * Catatan Risiko Keamanan:
 *   Karena modul Redis tidak digunakan secara wajib, daftar token yang dicabut (blacklist)
 *   akan terhapus jika aplikasi restart.
 *   Ini adalah trade-off yang disepakati untuk kemudahan deployment awal — token tetap akan kadaluarsa
 *   secara alami berdasarkan klaim `exp` di dalam JWT itu sendiri.
 *
 * Jika server Redis dipasang di masa mendatang, ganti Map memori ini dengan setex/exists dari ioredis.
 * Tanda tangan fungsi API (addToBlacklist, isBlacklisted) harus tetap dipertahankan.
 */

import logger from './logger'; // Logger aplikasi

// ─── Penyimpanan Memori Lokal (In-Memory Fallback Store) ─────────────────────

/**
 * Map pemetaan Token → timestamp kadaluarsa (milidetik).
 * Menyimpan waktu kadaluarsa agar Map dapat dibersihkan secara berkala tanpa bergantung pada Redis TTL.
 */
const inMemoryBlacklist = new Map<string, number>();

/** 
 * Membersihkan token yang sudah kadaluarsa dari Map agar tidak memicu kebocoran memori (memory leak).
 */
function pruneExpired(): void {
  const now = Date.now();
  for (const [token, expiry] of inMemoryBlacklist.entries()) {
    if (expiry < now) {
      inMemoryBlacklist.delete(token);
    }
  }
}

// Jalankan pembersihan token kadaluarsa setiap 5 menit
setInterval(pruneExpired, 5 * 60 * 1000).unref();

// ─── API Publik ──────────────────────────────────────────────────────────────

/**
 * Memasukkan token ke daftar pencabutan (blacklist) sampai waktu kadaluarsa alaminya terlampaui.
 * @param token         - String token JWT mentah (Jangan pernah dicatat lengkap di log)
 * @param expirySeconds - Durasi detik tersisa sebelum token kadaluarsa secara alami (dari klaim `exp`)
 */
export async function addToBlacklist(token: string, expirySeconds: number): Promise<void> {
  const expiryMs = Date.now() + expirySeconds * 1000;
  inMemoryBlacklist.set(token, expiryMs);
  logger.info('Token berhasil dimasukkan ke daftar blacklist (in-memory)', {
    tokenPrefix: token.substring(0, 10) + '...',
    expiresAt: new Date(expiryMs).toISOString(),
  });
}

/**
 * Memeriksa apakah token yang dikirimkan tergolong token yang dicabut/logout.
 */
export async function isBlacklisted(token: string): Promise<boolean> {
  const expiry = inMemoryBlacklist.get(token);
  if (expiry === undefined) return false;
  if (expiry < Date.now()) {
    // Jika token sudah kadaluarsa secara alami, hapus dari memori dan anggap tidak di-blacklist
    inMemoryBlacklist.delete(token);
    return false;
  }
  return true;
}

/** 
 * Mengembalikan data statistik ukuran blacklist untuk rute pemeriksaan kesehatan (/health).
 */
export async function getStats(): Promise<{
  totalBlacklisted: number;
  backend: string;
}> {
  pruneExpired();
  return {
    totalBlacklisted: inMemoryBlacklist.size,
    backend: 'in-memory (Redis tidak terhubung)',
  };
}

export async function connect(): Promise<void> {
  logger.info('Layanan blacklist token JWT diinisialisasi (menggunakan memori lokal)');
}

export async function disconnect(): Promise<void> {
  logger.info('Layanan blacklist token JWT dinonaktifkan');
}
