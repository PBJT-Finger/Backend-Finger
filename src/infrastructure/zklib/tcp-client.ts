// src/infrastructure/zklib/tcp-client.ts
// Klien TCP tingkat rendah untuk berkomunikasi langsung dengan perangkat biometrik ZKTeco
// menggunakan soket TCP murni (node net). Menangani jabat tangan (handshake), pengiriman perintah,
// penerimaan fragmen data besar (chunks), decoding respon, dan pemutusan koneksi yang aman.

import net from 'net';
import { MAX_CHUNK, COMMANDS, REQUEST_DATA } from './constants';
import {
  createTCPHeader,
  removeTcpHeader,
  decodeUserData72,
  decodeRecordData40,
  checkNotEventTCP,
  decodeTCPHeader,
  DecodedUser,
  DecodedRecord,
} from './utils';

export interface DeviceInfo {
  userCounts: number; // Jumlah user terdaftar di perangkat
  logCounts: number; // Jumlah log transaksi kehadiran yang tersimpan di perangkat
  logCapacity: number; // Kapasitas penyimpanan log maksimal perangkat
}

export class ZkTcpClient {
  private readonly ip: string; // IP Address perangkat target
  private readonly port: number; // Port TCP (default 4370)
  private readonly timeout: number; // Batas waktu tunggu soket (dalam milidetik)
  private sessionId: number | null = null; // ID Sesi komunikasi yang diberikan perangkat setelah terhubung
  private replyId = 0; // ID Balasan paket transmisi berjalan
  private socket: net.Socket | null = null; // Instansi Soket koneksi TCP

  constructor(ip: string, port: number, timeout: number) {
    this.ip = ip;
    this.port = port;
    this.timeout = timeout;
  }

  /**
   * Membuat soket TCP baru dan menginisialisasi koneksi fisik ke mesin.
   * @param cbError Callback penanganan error socket
   * @param cbClose Callback penanganan penutupan socket
   */
  public createSocket(
    cbError?: (err: Error) => void,
    cbClose?: (type: string) => void
  ): Promise<net.Socket> {
    return new Promise((resolve, reject) => {
      this.socket = new net.Socket();

      // Tangani event error socket sekali saja saat awal
      this.socket.once('error', (err) => {
        reject(err);
        if (cbError) cbError(err);
      });

      // Tangani sukses koneksi socket
      this.socket.once('connect', () => {
        resolve(this.socket!);
      });

      // Bersihkan referensi socket saat koneksi ditutup
      this.socket.once('close', () => {
        this.socket = null;
        if (cbClose) cbClose('tcp');
      });

      // Atur timeout socket jika disediakan
      if (this.timeout) {
        this.socket.setTimeout(this.timeout);
      }

      // Mulai koneksi TCP ke perangkat
      this.socket.connect(this.port, this.ip);
    });
  }

  /**
   * Mengirimkan perintah koneksi (CMD_CONNECT) untuk menginisialisasi sesi komunikasi.
   */
  public connect(): Promise<boolean> {
    // eslint-disable-next-line no-async-promise-executor
    return new Promise(async (resolve, reject) => {
      try {
        const reply = await this.executeCmd(COMMANDS.CMD_CONNECT, '');
        if (reply) {
          resolve(true);
        } else {
          reject(new Error('Perangkat tidak membalas perintah CMD_CONNECT'));
        }
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Menutup soket koneksi TCP secara bersih.
   */
  public closeSocket(): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.socket) {
        resolve(true);
        return;
      }
      // Hapus semua listener untuk mencegah kebocoran memori sebelum menutup socket
      this.socket.removeAllListeners('data');
      this.socket.end(() => {
        clearTimeout(timer);
        resolve(true);
      });

      // Pengaman jika socket.end menggantung terlalu lama (maksimal 2 detik)
      const timer = setTimeout(() => {
        resolve(true);
      }, 2000);
    });
  }

  /**
   * Menulis paket perintah biner ke soket TCP dan menunggu respon balasan (single-packet exchange).
   * @param msg Buffer pesan perintah terenkapsulasi
   * @param connectMode Menandakan apakah sedang dalam mode jabat tangan awal (CMD_CONNECT / CMD_EXIT)
   */
  private writeMessage(msg: Buffer, connectMode: boolean): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      let timer: NodeJS.Timeout | null = null;

      const handleData = (data: Buffer) => {
        if (timer) clearTimeout(timer);
        resolve(data);
      };

      if (this.socket) {
        this.socket.once('data', handleData);

        this.socket.write(msg, undefined, async (err) => {
          if (err) {
            if (this.socket) this.socket.removeListener('data', handleData);
            reject(err);
          } else if (this.timeout) {
            // Berikan batas waktu tunggu respon dari alat
            timer = setTimeout(
              () => {
                if (this.socket) this.socket.removeListener('data', handleData);
                reject(new Error('Batas waktu tunggu penulisan pesan habis (TIMEOUT_ON_WRITING_MESSAGE)'));
              },
              connectMode ? 2000 : this.timeout
            );
          }
        });
      } else {
        reject(new Error('Soket belum diinisialisasi'));
      }
    });
  }

  /**
   * Mengirimkan perintah pembacaan data dan menampung aliran paket data masuk (multi-packet streaming).
   * @param msg Buffer perintah permintaan data
   */
  private requestData(msg: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      let timer: NodeJS.Timeout | null = null;
      let replyBuffer = Buffer.from([]);

      const internalCallback = (data: Buffer) => {
        if (this.socket) this.socket.removeListener('data', handleOnData);
        if (timer) clearTimeout(timer);
        resolve(data);
      };

      const handleOnData = (data: Buffer) => {
        replyBuffer = Buffer.concat([replyBuffer, data]);
        // Abaikan jika data masuk adalah event realtime, bukan respon perintah
        if (checkNotEventTCP(data)) return;
        if (timer) clearTimeout(timer);
        const header = decodeTCPHeader(replyBuffer.subarray(0, 16));

        if (header.commandId === COMMANDS.CMD_DATA) {
          // Jika masih menerima fragmen data, tunggu 1 detik lagi untuk paket berikutnya
          timer = setTimeout(() => {
            internalCallback(replyBuffer);
          }, 1000);
        } else {
          // Pengaman timeout jika transmisi terhenti
          timer = setTimeout(() => {
            if (this.socket) this.socket.removeListener('data', handleOnData);
            reject(new Error('Batas waktu penerimaan permintaan data habis (TIMEOUT_ON_RECEIVING_REQUEST_DATA)'));
          }, this.timeout);

          const packetLength = data.readUIntLE(4, 2);
          if (packetLength > 8) {
            internalCallback(data);
          }
        }
      };

      if (this.socket) {
        this.socket.on('data', handleOnData);

        this.socket.write(msg, undefined, (err) => {
          if (err) {
            if (this.socket) this.socket.removeListener('data', handleOnData);
            reject(err);
          }

          timer = setTimeout(() => {
            if (this.socket) this.socket.removeListener('data', handleOnData);
            reject(new Error('Batas waktu tunggu respon setelah mengirimkan perintah habis'));
          }, this.timeout);
        });
      } else {
        reject(new Error('Soket belum diinisialisasi'));
      }
    });
  }

  /**
   * Mengeksekusi perintah ZK dengan melakukan pemaketan header secara otomatis.
   * @param command Kode perintah ZK
   * @param data Payload data biner atau string
   */
  public executeCmd(command: number, data: string | Buffer): Promise<Buffer> {
    // eslint-disable-next-line no-async-promise-executor
    return new Promise(async (resolve, reject) => {
      if (command === COMMANDS.CMD_CONNECT) {
        this.sessionId = 0;
        this.replyId = 0;
      } else {
        this.replyId++;
      }
      const buf = createTCPHeader(command, this.sessionId ?? 0, this.replyId, data);
      let reply = null;

      try {
        reply = await this.writeMessage(
          buf,
          command === COMMANDS.CMD_CONNECT || command === COMMANDS.CMD_EXIT
        );

        const rReply = removeTcpHeader(reply);
        if (rReply && rReply.length >= 6) {
          if (command === COMMANDS.CMD_CONNECT) {
            // Simpan ID sesi komunikasi yang diberikan mesin ke memori klien
            this.sessionId = rReply.readUInt16LE(4);
          }
        }
        resolve(rReply);
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Mengirim permintaan pembacaan satu fragmen data (chunk request) dari memori perangkat.
   * @param start Posisi index offset awal data di memori alat
   * @param size Ukuran byte data yang diminta
   */
  private sendChunkRequest(start: number, size: number): void {
    this.replyId++;
    const reqData = Buffer.alloc(8);
    reqData.writeUInt32LE(start, 0);
    reqData.writeUInt32LE(size, 4);
    const buf = createTCPHeader(COMMANDS.CMD_DATA_RDY, this.sessionId ?? 0, this.replyId, reqData);

    if (this.socket) {
      this.socket.write(buf, undefined, (err) => {
        if (err) {
          console.error(`[TCP][SEND_CHUNK_REQUEST] Gagal mengirim paket chunk request:`, err);
        }
      });
    }
  }

  /**
   * Membaca sekumpulan data besar (seperti seluruh tabel user atau tabel log) dengan sistem buffer fragmen.
   * @param reqData Buffer perintah inisialisasi pembacaan data
   * @param cb Callback pelacak kemajuan unduhan (progress callback)
   */
  private readWithBuffer(
    reqData: Buffer,
    cb?: (loaded: number, total: number) => void
  ): Promise<{ data: Buffer; err: Error | null }> {
    // eslint-disable-next-line no-async-promise-executor
    return new Promise(async (resolve, reject) => {
      this.replyId++;
      const buf = createTCPHeader(
        COMMANDS.CMD_DATA_WRRQ,
        this.sessionId ?? 0,
        this.replyId,
        reqData
      );
      let reply = null;

      try {
        reply = await this.requestData(buf);
      } catch (err) {
        reject(err);
        return;
      }

      const header = decodeTCPHeader(reply.subarray(0, 16));
      switch (header.commandId) {
        case COMMANDS.CMD_DATA: {
          resolve({ data: reply.subarray(16), err: null });
          break;
        }
        case COMMANDS.CMD_ACK_OK:
        case COMMANDS.CMD_PREPARE_DATA: {
          const recvData = reply.subarray(16);
          const size = recvData.readUIntLE(1, 4); // Dapatkan total byte data yang akan ditransfer

          const remain = size % MAX_CHUNK;
          const numberChunks = Math.round(size - remain) / MAX_CHUNK;
          let totalPackets = numberChunks + (remain > 0 ? 1 : 0);
          let replyData = Buffer.from([]);

          let totalBuffer = Buffer.from([]);
          let realTotalBuffer = Buffer.from([]);

          const timeout = 10000;

          const handleClose = () => {
            internalCallback(replyData, new Error('Soket terputus secara tidak terduga saat transfer data'));
          };

          const internalCallback = (repData: Buffer, err: Error | null = null) => {
            if (this.socket) {
              this.socket.removeListener('close', handleClose);
              this.socket.removeListener('data', handleOnData);
            }
            if (timer) clearTimeout(timer);
            resolve({ data: repData, err });
          };

          let timer = setTimeout(() => {
            internalCallback(replyData, new Error('Batas waktu tunggu penerimaan paket data habis (TIMEOUT)'));
          }, timeout);

          const handleOnData = (rep: Buffer) => {
            if (checkNotEventTCP(rep)) return;
            if (timer) clearTimeout(timer);
            timer = setTimeout(() => {
              internalCallback(
                replyData,
                new Error(`Batas waktu transfer habis! Sisa paket yang belum terkirim: ${totalPackets}`)
              );
            }, timeout);

            totalBuffer = Buffer.concat([totalBuffer, rep]);
            const packetLength = totalBuffer.readUIntLE(4, 2);
            if (totalBuffer.length >= 8 + packetLength) {
              realTotalBuffer = Buffer.concat([
                realTotalBuffer,
                totalBuffer.subarray(16, 8 + packetLength),
              ]);
              totalBuffer = totalBuffer.subarray(8 + packetLength);

              if (
                (totalPackets > 1 && realTotalBuffer.length === MAX_CHUNK + 8) ||
                (totalPackets === 1 && realTotalBuffer.length === remain + 8)
              ) {
                replyData = Buffer.concat([replyData, realTotalBuffer.subarray(8)]);
                totalBuffer = Buffer.from([]);
                realTotalBuffer = Buffer.from([]);

                totalPackets -= 1;
                if (cb) cb(replyData.length, size);

                if (totalPackets <= 0) {
                  internalCallback(replyData);
                }
              }
            }
          };

          if (this.socket) {
            this.socket.once('close', handleClose);
            this.socket.on('data', handleOnData);
          }

          // Lakukan pengiriman sinyal chunk request berurutan untuk memicu alat mengirim fragmen data
          for (let i = 0; i <= numberChunks; i++) {
            if (i === numberChunks) {
              this.sendChunkRequest(numberChunks * MAX_CHUNK, remain);
            } else {
              this.sendChunkRequest(i * MAX_CHUNK, MAX_CHUNK);
            }
          }

          break;
        }
        default: {
          reject(new Error('Respon perintah tidak terduga saat inisialisasi transfer data'));
        }
      }
    });
  }

  /**
   * Menarik daftar seluruh user terdaftar yang tersimpan di dalam mesin.
   */
  public async getUsers(): Promise<{ data: DecodedUser[]; err: Error | null }> {
    if (this.socket) {
      try {
        await this.freeData(); // Bebaskan cache buffer transmisi alat terlebih dahulu
      } catch (err) {
        return Promise.reject(err);
      }
    }

    let data = null;
    try {
      data = await this.readWithBuffer(REQUEST_DATA.GET_USERS as unknown as Buffer);
    } catch (err) {
      return Promise.reject(err);
    }

    if (this.socket) {
      try {
        await this.freeData();
      } catch (err) {
        return Promise.reject(err);
      }
    }

    const USER_PACKET_SIZE = 72; // Ukuran biner satu user ZK adalah 72 bytes
    let userData = data.data.subarray(4);
    const users: DecodedUser[] = [];

    // Loop decode user data per 72 bytes
    while (userData.length >= USER_PACKET_SIZE) {
      const user = decodeUserData72(userData.subarray(0, USER_PACKET_SIZE));
      users.push(user);
      userData = userData.subarray(USER_PACKET_SIZE);
    }

    return { data: users, err: data.err };
  }

  /**
   * Menarik daftar seluruh log transaksi kehadiran pegawai yang ada di memori perangkat.
   * @param callbackInProcess Callback pelacak progres sinkronisasi data
   */
  public async getAttendances(
    callbackInProcess = () => {}
  ): Promise<{ data: (DecodedRecord & { ip: string })[]; err: Error | null }> {
    if (this.socket) {
      try {
        await this.freeData();
      } catch (err) {
        return Promise.reject(err);
      }
    }

    let data = null;
    try {
      data = await this.readWithBuffer(
        REQUEST_DATA.GET_ATTENDANCE_LOGS as unknown as Buffer,
        callbackInProcess
      );
    } catch (err) {
      return Promise.reject(err);
    }

    if (this.socket) {
      try {
        await this.freeData();
      } catch (err) {
        return Promise.reject(err);
      }
    }

    const RECORD_PACKET_SIZE = 40; // Ukuran biner satu log absensi ZK adalah 40 bytes
    let recordData = data.data.subarray(4);
    const records: (DecodedRecord & { ip: string })[] = [];

    // Loop decode log data per 40 bytes
    while (recordData.length >= RECORD_PACKET_SIZE) {
      const record = decodeRecordData40(recordData.subarray(0, RECORD_PACKET_SIZE));
      records.push({ ...record, ip: this.ip });
      recordData = recordData.subarray(RECORD_PACKET_SIZE);
    }

    return { data: records, err: data.err };
  }

  /**
   * Membebaskan alokasi memori buffer pengiriman data di perangkat ZK.
   */
  public async freeData(): Promise<Buffer> {
    return await this.executeCmd(COMMANDS.CMD_FREE_DATA, '');
  }

  /**
   * Menonaktifkan/mengunci input perangkat biometrik (layar & mesin pemindai).
   */
  public async disableDevice(): Promise<Buffer> {
    return await this.executeCmd(
      COMMANDS.CMD_DISABLEDEVICE,
      REQUEST_DATA.DISABLE_DEVICE as unknown as Buffer
    );
  }

  /**
   * Mengaktifkan kembali input perangkat biometrik yang terkunci.
   */
  public async enableDevice(): Promise<Buffer> {
    return await this.executeCmd(COMMANDS.CMD_ENABLEDEVICE, '');
  }

  /**
   * Memutus koneksi dari perangkat dan menutup socket.
   */
  public async disconnect(): Promise<boolean> {
    try {
      await this.executeCmd(COMMANDS.CMD_EXIT, '');
    } catch (_err) {
      // Abaikan jika error pengiriman perintah keluar
    }
    return await this.closeSocket();
  }

  /**
   * Meminta informasi sisa ruang kapasitas penyimpanan data memori internal mesin.
   */
  public async getInfo(): Promise<DeviceInfo> {
    try {
      const data = await this.executeCmd(COMMANDS.CMD_GET_FREE_SIZES, '');

      return {
        userCounts: data.readUIntLE(24, 4),
        logCounts: data.readUIntLE(40, 4),
        logCapacity: data.readUIntLE(72, 4),
      };
    } catch (err) {
      return Promise.reject(err);
    }
  }

  /**
   * Menghapus seluruh log transaksi absensi yang tersimpan di dalam memori mesin biometrik.
   * ⚠️ CAUTION: Operasi ini destruktif dan akan membersihkan log kehadiran fisik pada alat.
   */
  public async clearAttendanceLog(): Promise<Buffer> {
    return await this.executeCmd(COMMANDS.CMD_CLEAR_ATTLOG, '');
  }
}
