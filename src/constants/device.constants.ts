/**
 * src/constants/device.constants.ts
 *
 * Konstanta bernama untuk parameter komunikasi perangkat keras ZKTeco.
 *
 * Mengapa menggunakan konstanta daripada nilai langsung (inline values):
 *   - Menghindari angka misterius (magic numbers) yang tersebar di codebase.
 *   - Mempermudah penyetelan waktu (timing) per lingkungan jaringan tanpa harus mencari di banyak file.
 *   - Bertindak sebagai nilai cadangan (fallback defaults) jika variabel lingkungan .env tidak disetel.
 */

/** Interval default antar siklus penarikan data (polling) mesin ZKTeco (5 detik). */
export const DEFAULT_POLLING_INTERVAL_MS = 5_000;

/**
 * Jeda waktu default sebelum mencoba menghubungkan ulang socket setelah polling gagal.
 * Menggunakan jeda waktu untuk menghindari banjir permintaan (tight-loop flooding) jika mesin sedang offline.
 */
export const DEFAULT_RECONNECT_DELAY_MS = 8_000;

/**
 * Batas waktu (timeout) koneksi socket TCP default.
 * Perangkat ZKTeco pada jaringan LAN biasanya merespons kurang dari 1 detik; batas waktu 10 detik memberikan toleransi gangguan jaringan.
 */
export const DEFAULT_CONNECTION_TIMEOUT_MS = 10_000;

/**
 * Batas waktu internal socket port ZKLib.
 * Nilainya dibuat lebih rendah dari batas waktu koneksi untuk mencegah pemblokiran siklus polling akibat pembacaan data parsial.
 */
export const DEFAULT_IN_PORT_TIMEOUT_MS = 4_000;
