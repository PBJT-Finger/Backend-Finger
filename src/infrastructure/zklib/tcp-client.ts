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
  userCounts: number;
  logCounts: number;
  logCapacity: number;
}

export class ZkTcpClient {
  private readonly ip: string;
  private readonly port: number;
  private readonly timeout: number;
  private sessionId: number | null = null;
  private replyId = 0;
  private socket: net.Socket | null = null;

  constructor(ip: string, port: number, timeout: number) {
    this.ip = ip;
    this.port = port;
    this.timeout = timeout;
  }

  public createSocket(
    cbError?: (err: Error) => void,
    cbClose?: (type: string) => void
  ): Promise<net.Socket> {
    return new Promise((resolve, reject) => {
      this.socket = new net.Socket();

      this.socket.once('error', (err) => {
        reject(err);
        if (cbError) cbError(err);
      });

      this.socket.once('connect', () => {
        resolve(this.socket!);
      });

      this.socket.once('close', () => {
        this.socket = null;
        if (cbClose) cbClose('tcp');
      });

      if (this.timeout) {
        this.socket.setTimeout(this.timeout);
      }

      this.socket.connect(this.port, this.ip);
    });
  }

  public connect(): Promise<boolean> {
    return new Promise(async (resolve, reject) => {
      try {
        const reply = await this.executeCmd(COMMANDS.CMD_CONNECT, '');
        if (reply) {
          resolve(true);
        } else {
          reject(new Error('NO_REPLY_ON_CMD_CONNECT'));
        }
      } catch (err) {
        reject(err);
      }
    });
  }

  public closeSocket(): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.socket) {
        resolve(true);
        return;
      }
      this.socket.removeAllListeners('data');
      this.socket.end(() => {
        clearTimeout(timer);
        resolve(true);
      });

      const timer = setTimeout(() => {
        resolve(true);
      }, 2000);
    });
  }

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
            timer = setTimeout(
              () => {
                if (this.socket) this.socket.removeListener('data', handleData);
                reject(new Error('TIMEOUT_ON_WRITING_MESSAGE'));
              },
              connectMode ? 2000 : this.timeout
            );
          }
        });
      } else {
        reject(new Error('Socket is not initialized'));
      }
    });
  }

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
        if (checkNotEventTCP(data)) return;
        if (timer) clearTimeout(timer);
        const header = decodeTCPHeader(replyBuffer.subarray(0, 16));

        if (header.commandId === COMMANDS.CMD_DATA) {
          timer = setTimeout(() => {
            internalCallback(replyBuffer);
          }, 1000);
        } else {
          timer = setTimeout(() => {
            if (this.socket) this.socket.removeListener('data', handleOnData);
            reject(new Error('TIMEOUT_ON_RECEIVING_REQUEST_DATA'));
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
            reject(new Error('TIMEOUT_IN_RECEIVING_RESPONSE_AFTER_REQUESTING_DATA'));
          }, this.timeout);
        });
      } else {
        reject(new Error('Socket is not initialized'));
      }
    });
  }

  public executeCmd(command: number, data: string | Buffer): Promise<Buffer> {
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
            this.sessionId = rReply.readUInt16LE(4);
          }
        }
        resolve(rReply);
      } catch (err) {
        reject(err);
      }
    });
  }

  private sendChunkRequest(start: number, size: number): void {
    this.replyId++;
    const reqData = Buffer.alloc(8);
    reqData.writeUInt32LE(start, 0);
    reqData.writeUInt32LE(size, 4);
    const buf = createTCPHeader(COMMANDS.CMD_DATA_RDY, this.sessionId ?? 0, this.replyId, reqData);

    if (this.socket) {
      this.socket.write(buf, undefined, (err) => {
        if (err) {
          console.error(`[TCP][SEND_CHUNK_REQUEST] Error:`, err);
        }
      });
    }
  }

  private readWithBuffer(
    reqData: Buffer,
    cb?: (loaded: number, total: number) => void
  ): Promise<{ data: Buffer; err: Error | null }> {
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
          const size = recvData.readUIntLE(1, 4);

          const remain = size % MAX_CHUNK;
          const numberChunks = Math.round(size - remain) / MAX_CHUNK;
          let totalPackets = numberChunks + (remain > 0 ? 1 : 0);
          let replyData = Buffer.from([]);

          let totalBuffer = Buffer.from([]);
          let realTotalBuffer = Buffer.from([]);

          const timeout = 10000;

          const handleClose = () => {
            internalCallback(replyData, new Error('Socket is disconnected unexpectedly'));
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
            internalCallback(replyData, new Error('TIMEOUT WHEN RECEIVING PACKET'));
          }, timeout);

          const handleOnData = (rep: Buffer) => {
            if (checkNotEventTCP(rep)) return;
            if (timer) clearTimeout(timer);
            timer = setTimeout(() => {
              internalCallback(
                replyData,
                new Error(`TIME OUT !! ${totalPackets} PACKETS REMAIN !`)
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
          reject(new Error('ERROR_IN_UNHANDLE_CMD'));
        }
      }
    });
  }

  public async getUsers(): Promise<{ data: DecodedUser[]; err: Error | null }> {
    if (this.socket) {
      try {
        await this.freeData();
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

    const USER_PACKET_SIZE = 72;
    let userData = data.data.subarray(4);
    const users: DecodedUser[] = [];

    while (userData.length >= USER_PACKET_SIZE) {
      const user = decodeUserData72(userData.subarray(0, USER_PACKET_SIZE));
      users.push(user);
      userData = userData.subarray(USER_PACKET_SIZE);
    }

    return { data: users, err: data.err };
  }

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

    const RECORD_PACKET_SIZE = 40;
    let recordData = data.data.subarray(4);
    const records: (DecodedRecord & { ip: string })[] = [];

    while (recordData.length >= RECORD_PACKET_SIZE) {
      const record = decodeRecordData40(recordData.subarray(0, RECORD_PACKET_SIZE));
      records.push({ ...record, ip: this.ip });
      recordData = recordData.subarray(RECORD_PACKET_SIZE);
    }

    return { data: records, err: data.err };
  }

  public async freeData(): Promise<Buffer> {
    return await this.executeCmd(COMMANDS.CMD_FREE_DATA, '');
  }

  public async disableDevice(): Promise<Buffer> {
    return await this.executeCmd(
      COMMANDS.CMD_DISABLEDEVICE,
      REQUEST_DATA.DISABLE_DEVICE as unknown as Buffer
    );
  }

  public async enableDevice(): Promise<Buffer> {
    return await this.executeCmd(COMMANDS.CMD_ENABLEDEVICE, '');
  }

  public async disconnect(): Promise<boolean> {
    try {
      await this.executeCmd(COMMANDS.CMD_EXIT, '');
    } catch (err) {
      // Ignored
    }
    return await this.closeSocket();
  }

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

  public async clearAttendanceLog(): Promise<Buffer> {
    return await this.executeCmd(COMMANDS.CMD_CLEAR_ATTLOG, '');
  }
}
