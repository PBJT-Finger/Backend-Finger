/**
 * src/infrastructure/zklib/constants.ts
 *
 * Konstanta perintah dan data request untuk protokol komunikasi biner ZKTeco (SDK ZK).
 */

// Konstanta Perintah (Commands) Protokol ZK
export const COMMANDS = {
  CMD_CONNECT: 1000,          // Menghubungkan ke perangkat
  CMD_EXIT: 1001,             // Keluar dari sesi koneksi
  CMD_ENABLEDEVICE: 1002,     // Mengaktifkan perangkat (mengizinkan input user)
  CMD_DISABLEDEVICE: 1003,    // Menonaktifkan perangkat (mengunci input user)
  CMD_RESTART: 1004,          // Menyalakan ulang perangkat
  CMD_POWEROFF: 1005,         // Mematikan perangkat
  CMD_SLEEP: 1006,            // Menidurkan perangkat (Sleep mode)
  CMD_RESUME: 1007,           // Membangunkan perangkat
  CMD_CAPTUREFINGER: 1009,    // Menangkap sidik jari
  CMD_TEST_TEMP: 1011,        // Uji template sidik jari
  CMD_CAPTUREIMAGE: 1012,     // Menangkap gambar sidik jari
  CMD_REFRESHDATA: 1013,      // Menyegarkan cache data perangkat
  CMD_REFRESHOPTION: 1014,    // Menyegarkan cache konfigurasi/opsi
  CMD_TESTVOICE: 1017,        // Memutar suara tes pada perangkat
  CMD_GET_VERSION: 1100,      // Mendapatkan versi firmware perangkat
  CMD_CHANGE_SPEED: 1101,     // Mengubah kecepatan transmisi data
  CMD_AUTH: 1102,             // Melakukan autentikasi koneksi
  CMD_PREPARE_DATA: 1500,     // Mempersiapkan transmisi data besar
  CMD_DATA: 1501,             // Mengirim data paket transmisi
  CMD_FREE_DATA: 1502,        // Membebaskan alokasi data transmisi
  CMD_DATA_WRRQ: 1503,        // Permintaan menulis data (Write Request)
  CMD_DATA_RDY: 1504,         // Data siap untuk dibaca
  CMD_DB_RRQ: 7,              // Membaca database perangkat (Read Request)
  CMD_USER_WRQ: 8,            // Menulis data user (Write Request)
  CMD_USERTEMP_RRQ: 9,        // Membaca template sidik jari user
  CMD_USERTEMP_WRQ: 10,       // Menulis template sidik jari user
  CMD_OPTIONS_RRQ: 11,        // Membaca konfigurasi opsi perangkat
  CMD_OPTIONS_WRQ: 12,        // Menulis konfigurasi opsi perangkat
  CMD_ATTLOG_RRQ: 13,         // Membaca log transaksi kehadiran (Attendance Log)
  CMD_CLEAR_DATA: 14,         // Menghapus database perangkat
  CMD_CLEAR_ATTLOG: 15,       // Menghapus log kehadiran perangkat
  CMD_DELETE_USER: 18,        // Menghapus data user
  CMD_DELETE_USERTEMP: 19,    // Menghapus template sidik jari user
  CMD_CLEAR_ADMIN: 20,        // Menghapus hak akses administrator di perangkat
  CMD_USERGRP_RRQ: 21,        // Membaca grup user
  CMD_USERGRP_WRQ: 22,        // Menulis grup user
  CMD_USERTZ_RRQ: 23,         // Membaca zona waktu user
  CMD_USERTZ_WRQ: 24,         // Menulis zona waktu user
  CMD_GRPTZ_RRQ: 25,          // Membaca zona waktu grup
  CMD_GRPTZ_WRQ: 26,          // Menulis zona waktu grup
  CMD_TZ_RRQ: 27,             // Membaca zona waktu umum
  CMD_TZ_WRQ: 28,             // Menulis zona waktu umum
  CMD_ULG_RRQ: 29,            // Membaca log pembukaan pintu (Access Control)
  CMD_ULG_WRQ: 30,            // Menulis log pembukaan pintu
  CMD_UNLOCK: 31,             // Membuka kunci pintu (Relay control)
  CMD_CLEAR_ACC: 32,          // Menghapus pengaturan akses kontrol
  CMD_CLEAR_OPLOG: 33,        // Menghapus log operasi admin di perangkat
  CMD_OPLOG_RRQ: 34,          // Membaca log operasi admin
  CMD_GET_FREE_SIZES: 50,     // Mendapatkan ruang memori bebas di perangkat
  CMD_ENABLE_CLOCK: 57,       // Mengaktifkan tampilan jam di layar perangkat
  CMD_STARTVERIFY: 60,        // Memulai mode verifikasi
  CMD_STARTENROLL: 61,        // Memulai mode registrasi user baru (Enrollment)
  CMD_CANCELCAPTURE: 62,      // Membatalkan penangkapan sidik jari
  CMD_STATE_RRQ: 64,          // Membaca status state perangkat
  CMD_WRITE_LCD: 66,          // Menulis teks ke layar LCD perangkat
  CMD_CLEAR_LCD: 67,          // Membersihkan layar LCD perangkat
  CMD_GET_PINWIDTH: 69,       // Mendapatkan lebar ID PIN user
  CMD_SMS_WRQ: 70,            // Menulis data SMS ke layar perangkat
  CMD_SMS_RRQ: 71,            // Membaca data SMS dari perangkat
  CMD_DELETE_SMS: 72,         // Menghapus SMS
  CMD_UDATA_WRQ: 73,          // Menulis data kustom user
  CMD_DELETE_UDATA: 74,       // Menghapus data kustom user
  CMD_DOORSTATE_RRQ: 75,      // Membaca status sensor pintu
  CMD_WRITE_MIFARE: 76,       // Menulis ke kartu Mifare RFID
  CMD_EMPTY_MIFARE: 78,       // Mengosongkan kartu Mifare RFID
  CMD_VERIFY_WRQ: 79,         // Menulis konfigurasi verifikasi
  CMD_VERIFY_RRQ: 80,         // Membaca konfigurasi verifikasi
  CMD_TMP_WRITE: 87,          // Menulis data temporary
  CMD_CHECKSUM_BUFFER: 119,   // Mendapatkan checksum buffer
  CMD_DEL_FPTMP: 134,         // Menghapus template sidik jari tertentu
  CMD_GET_TIME: 201,          // Mendapatkan jam/waktu perangkat
  CMD_SET_TIME: 202,          // Mengatur jam/waktu perangkat
  CMD_REG_EVENT: 500,         // Mendaftarkan pemantauan event realtime (Realtime Event)
  CMD_ACK_OK: 2000,           // Perintah berhasil diterima & dieksekusi (Acknowledge OK)
  CMD_ACK_ERROR: 2001,        // Terjadi kegagalan pemrosesan perintah
  CMD_ACK_DATA: 2002,         // Paket data dikirim kembali sebagai respon
  CMD_ACK_RETRY: 2003,        // Permintaan kirim ulang paket
  CMD_ACK_REPEAT: 2004,       // Permintaan pengulangan paket
  CMD_ACK_UNAUTH: 2005,       // Koneksi tidak terautorisasi (kunci komunikasi salah)
  CMD_ACK_UNKNOWN: 65535,     // Respon tidak diketahui
  CMD_ACK_ERROR_CMD: 65533,   // Kesalahan perintah tidak valid
  CMD_ACK_ERROR_INIT: 65532,  // Kesalahan inisialisasi modul
  CMD_ACK_ERROR_DATA: 65531,  // Kesalahan transmisi data rusak
  EF_ATTLOG: 1,               // Event filter log kehadiran
  EF_FINGER: 2,               // Event filter penempelan jari
  EF_ENROLLUSER: 4,           // Event filter pendaftaran user baru
  EF_ENROLLFINGER: 8,         // Event filter pendaftaran jari baru
  EF_BUTTON: 16,              // Event filter penekanan tombol
  EF_UNLOCK: 32,              // Event filter pembukaan kunci
  EF_VERIFY: 128,             // Event filter proses verifikasi user
  EF_FPFTR: 256,              // Event filter ekstraksi fitur sidik jari
  EF_ALARM: 512,              // Event filter alarm berbunyi
} as const;

export const USHRT_MAX = 65535; // Batas maksimal nilai unsigned short 16-bit

export const MAX_CHUNK = 65472; // Ukuran paket transmisi maksimal dalam bytes

// Kumpulan payload Buffer biner untuk meminta data spesifik ke perangkat
export const REQUEST_DATA = {
  DISABLE_DEVICE: Buffer.from([0, 0, 0, 0]),
  GET_REAL_TIME_EVENT: Buffer.from([0x01, 0x00, 0x00, 0x00]),
  GET_ATTENDANCE_LOGS: Buffer.from([
    0x01, 0x0d, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  ]),
  GET_USERS: Buffer.from([0x01, 0x09, 0x00, 0x05, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]),
} as const;
