// src/infrastructure/zklib/utils.ts
// Kumpulan fungsi utilitas biner untuk parsing dan decoding paket data TCP ZKLib.

import { USHRT_MAX, COMMANDS } from './constants';

/**
 * Mengubah integer waktu biner bawaan ZKTeco menjadi objek Date.
 * @param time Nilai waktu dalam format integer 32-bit dari perangkat
 */
export const parseTimeToDate = (time: number): Date => {
  const second = time % 60;
  time = (time - second) / 60;
  const minute = time % 60;
  time = (time - minute) / 60;
  const hour = time % 24;
  time = (time - hour) / 24;
  const day = (time % 31) + 1;
  time = (time - (day - 1)) / 31;
  const month = time % 12;
  time = (time - month) / 12;
  const year = time + 2000;

  // Gunakan Date.UTC agar nilai waktu mentah perangkat dipertahankan dalam slot UTC
  // dari objek Date. Ini menghilangkan ketergantungan pada zona waktu server — konsumen
  // harus menggunakan metode getUTC*() untuk membaca kembali waktu perangkat yang asli.
  return new Date(Date.UTC(year, month, day, hour, minute, second));
};

/**
 * Mengubah representasi Hexadecimal biner menjadi objek Date.
 * @param hex Buffer biner mentah yang menyimpan komponen waktu
 */
export const parseHexToTime = (hex: Buffer): Date => {
  const time = {
    year: hex.readUIntLE(0, 1),
    month: hex.readUIntLE(1, 1),
    date: hex.readUIntLE(2, 1),
    hour: hex.readUIntLE(3, 1),
    minute: hex.readUIntLE(4, 1),
    second: hex.readUIntLE(5, 1),
  };

  return new Date(
    Date.UTC(2000 + time.year, time.month - 1, time.date, time.hour, time.minute, time.second)
  );
};

/**
 * Menghitung checksum paket data biner ZK untuk verifikasi integritas data.
 * @param buf Buffer data yang akan dihitung checksum-nya
 */
export const createChkSum = (buf: Buffer): number => {
  let chksum = 0;
  for (let i = 0; i < buf.length; i += 2) {
    if (i === buf.length - 1) {
      chksum += buf.readUInt8(i);
    } else {
      chksum += buf.readUInt16LE(i);
    }
    chksum %= USHRT_MAX;
  }
  chksum = USHRT_MAX - chksum - 1;

  return chksum;
};

/**
 * Membuat header paket TCP dengan enkapsulasi protokol ZK biner.
 * @param command ID perintah ZK
 * @param sessionId ID sesi komunikasi yang sedang berjalan
 * @param replyId ID balasan paket
 * @param data Payload data berupa string atau Buffer
 */
export const createTCPHeader = (
  command: number,
  sessionId: number,
  replyId: number,
  data: string | Buffer
): Buffer => {
  const dataBuffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const buf = Buffer.alloc(8 + dataBuffer.length);

  buf.writeUInt16LE(command, 0);
  buf.writeUInt16LE(0, 2); // Tempat penulisan checksum nantinya

  buf.writeUInt16LE(sessionId, 4);
  buf.writeUInt16LE(replyId, 6);
  dataBuffer.copy(buf, 8);

  const chksum2 = createChkSum(buf);
  buf.writeUInt16LE(chksum2, 2); // Menuliskan checksum yang sudah dihitung

  replyId = (replyId + 1) % USHRT_MAX;
  buf.writeUInt16LE(replyId, 6);

  // Prefix header khusus TCP ZK (8 bytes awal)
  const prefixBuf = Buffer.from([0x50, 0x50, 0x82, 0x7d, 0x13, 0x00, 0x00, 0x00]);

  prefixBuf.writeUInt16LE(buf.length, 4); // Menuliskan panjang ukuran paket ke header

  return Buffer.concat([prefixBuf, buf]);
};

/**
 * Menghilangkan header TCP ZK (8 bytes awal prefix) dan mengambil muatan data aslinya.
 * @param buf Buffer paket biner lengkap
 */
export const removeTcpHeader = (buf: Buffer): Buffer => {
  if (buf.length < 8) {
    return buf;
  }

  // Memeriksa signature awal "PP\x82}" (0x50, 0x50, 0x82, 0x7d)
  if (buf.compare(Buffer.from([0x50, 0x50, 0x82, 0x7d]), 0, 4, 0, 4) !== 0) {
    return buf;
  }

  return buf.subarray(8); // Mengembalikan buffer tanpa 8 bytes pertama
};

export interface DecodedUser {
  uid: number; // ID unik internal perangkat
  role: number; // Hak akses (User / Admin)
  name: string; // Nama user
  cardno: number; // Nomor kartu RFID (jika ada)
  userId: string; // ID karyawan/NIP eksternal
}

/**
 * Mendekode data biner user berukuran 72 bytes dari perangkat ZK.
 * @param userData Buffer biner berisi satu record user
 */
export const decodeUserData72 = (userData: Buffer): DecodedUser => {
  return {
    uid: userData.readUIntLE(0, 2),
    role: userData.readUIntLE(2, 1),
    name: userData.slice(11).toString('ascii').split('\0').shift() || '',
    cardno: userData.readUIntLE(35, 4),
    userId:
      userData
        .slice(48, 48 + 9)
        .toString('ascii')
        .split('\0')
        .shift() || '',
  };
};

export interface DecodedRecord {
  userSn: number; // Nomor seri transaksi internal
  deviceUserId: string; // ID user pengabsen (NIP)
  recordTime: Date; // Waktu absensi
  /**
   * Tipe punch ZKTeco dari perangkat:
   *   0 = Check-In (Masuk)
   *   1 = Check-Out (Keluar / Pulang)
   *   2 = Break-Out
   *   3 = Break-In
   *   4 = Overtime-In
   *   5 = Overtime-Out
   */
  attendanceType: number;
}

/**
 * Mendekode data biner log transaksi absensi berukuran 40 bytes dari perangkat ZK.
 * @param recordData Buffer biner berisi satu log transaksi kehadiran
 */
export const decodeRecordData40 = (recordData: Buffer): DecodedRecord => {
  return {
    userSn: recordData.readUIntLE(0, 2),
    deviceUserId:
      recordData
        .slice(2, 2 + 9)
        .toString('ascii')
        .split('\0')
        .shift() || '',
    recordTime: parseTimeToDate(recordData.readUInt32LE(27)),
    // Byte 31: status tipe absensi (punch state) langsung dari perangkat ZKTeco
    // 0 = Check-In (Masuk), 1 = Check-Out (Pulang/Keluar)
    // Catatan: byte 26 setara dengan userSn untuk ID kecil — BUKAN tipe absensi
    attendanceType: recordData.readUIntLE(31, 1),
  };
};

export interface TCPHeader {
  commandId: number; // ID Perintah
  checkSum: number; // Nilai Checksum
  sessionId: number; // ID Sesi aktif
  replyId: number; // ID Balasan
  payloadSize: number; // Ukuran payload
}

/**
 * Membaca komponen header TCP ZK.
 * @param header Buffer header TCP lengkap
 */
export const decodeTCPHeader = (header: Buffer): TCPHeader => {
  const recvData = header.subarray(8);
  const payloadSize = header.readUIntLE(4, 2);

  const commandId = recvData.readUIntLE(0, 2);
  const checkSum = recvData.readUIntLE(2, 2);
  const sessionId = recvData.readUIntLE(4, 2);
  const replyId = recvData.readUIntLE(6, 2);
  return { commandId, checkSum, sessionId, replyId, payloadSize };
};

/**
 * Memeriksa apakah paket TCP yang masuk merupakan event realtime absensi (Realtime Event) atau bukan.
 * @param data Buffer paket biner masuk
 */
export const checkNotEventTCP = (data: Buffer): boolean => {
  try {
    const payload = removeTcpHeader(data);
    const commandId = payload.readUIntLE(0, 2);
    const event = payload.readUIntLE(4, 2);
    return event === COMMANDS.EF_ATTLOG && commandId === COMMANDS.CMD_REG_EVENT;
  } catch (_err) {
    return false;
  }
};
