import { USHRT_MAX, COMMANDS } from './constants';

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

  // Use Date.UTC so the device's raw time values are preserved in the UTC slots
  // of the Date object. This eliminates server-timezone dependency — consumers
  // must use getUTC*() methods to read back the original device time.
  return new Date(Date.UTC(year, month, day, hour, minute, second));
};

export const parseHexToTime = (hex: Buffer): Date => {
  const time = {
    year: hex.readUIntLE(0, 1),
    month: hex.readUIntLE(1, 1),
    date: hex.readUIntLE(2, 1),
    hour: hex.readUIntLE(3, 1),
    minute: hex.readUIntLE(4, 1),
    second: hex.readUIntLE(5, 1),
  };

  return new Date(Date.UTC(2000 + time.year, time.month - 1, time.date, time.hour, time.minute, time.second));
};

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

export const createTCPHeader = (
  command: number,
  sessionId: number,
  replyId: number,
  data: string | Buffer
): Buffer => {
  const dataBuffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const buf = Buffer.alloc(8 + dataBuffer.length);

  buf.writeUInt16LE(command, 0);
  buf.writeUInt16LE(0, 2);

  buf.writeUInt16LE(sessionId, 4);
  buf.writeUInt16LE(replyId, 6);
  dataBuffer.copy(buf, 8);

  const chksum2 = createChkSum(buf);
  buf.writeUInt16LE(chksum2, 2);

  replyId = (replyId + 1) % USHRT_MAX;
  buf.writeUInt16LE(replyId, 6);

  const prefixBuf = Buffer.from([0x50, 0x50, 0x82, 0x7d, 0x13, 0x00, 0x00, 0x00]);

  prefixBuf.writeUInt16LE(buf.length, 4);

  return Buffer.concat([prefixBuf, buf]);
};

export const removeTcpHeader = (buf: Buffer): Buffer => {
  if (buf.length < 8) {
    return buf;
  }

  if (buf.compare(Buffer.from([0x50, 0x50, 0x82, 0x7d]), 0, 4, 0, 4) !== 0) {
    return buf;
  }

  return buf.subarray(8);
};

export interface DecodedUser {
  uid: number;
  role: number;
  name: string;
  cardno: number;
  userId: string;
}

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
  userSn: number;
  deviceUserId: string;
  recordTime: Date;
  /**
   * ZKTeco punch type from the device:
   *   0 = Check-In (Masuk)
   *   1 = Check-Out (Keluar / Pulang)
   *   2 = Break-Out
   *   3 = Break-In
   *   4 = Overtime-In
   *   5 = Overtime-Out
   */
  attendanceType: number;
}

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
    // Byte 31: actual punch state from ZKTeco device
    // 0 = Check-In (Masuk), 1 = Check-Out (Pulang/Keluar)
    // Note: byte 26 equals userSn for small IDs — NOT the attendance type
    attendanceType: recordData.readUIntLE(31, 1),
  };
};

export interface TCPHeader {
  commandId: number;
  checkSum: number;
  sessionId: number;
  replyId: number;
  payloadSize: number;
}

export const decodeTCPHeader = (header: Buffer): TCPHeader => {
  const recvData = header.subarray(8);
  const payloadSize = header.readUIntLE(4, 2);

  const commandId = recvData.readUIntLE(0, 2);
  const checkSum = recvData.readUIntLE(2, 2);
  const sessionId = recvData.readUIntLE(4, 2);
  const replyId = recvData.readUIntLE(6, 2);
  return { commandId, checkSum, sessionId, replyId, payloadSize };
};

export const checkNotEventTCP = (data: Buffer): boolean => {
  try {
    const payload = removeTcpHeader(data);
    const commandId = payload.readUIntLE(0, 2);
    const event = payload.readUIntLE(4, 2);
    return event === COMMANDS.EF_ATTLOG && commandId === COMMANDS.CMD_REG_EVENT;
  } catch (err) {
    return false;
  }
};
