/**
 * src/infrastructure/zk-client.ts
 *
 * Anti-Corruption Layer (ACL) untuk perangkat biometrik ZKTeco X100-C.
 *
 * Keputusan Arsitektur — Polling Koneksi Persisten (Persistent Connection Polling):
 *   Terhubung SATU KALI, jaga agar sesi tetap hidup, dan lakukan polling (getAttendances) pada
 *   soket TCP yang sama setiap N detik.
 *
 *   ⚠️ MENGAPA INI PENTING:
 *   Firmware ZKTeco membunyikan nada bip notifikasi pada speaker perangkat fisik
 *   setiap kali sesi TCP BARU dibuat (CMD_CONNECT). Di bawah strategi "ephemeral" lama,
 *   perangkat terhubung/terputus setiap 5 detik, menyebabkan suara bip terus-menerus
 *   yang mengganggu pengguna dan staf.
 *
 *   Di bawah mode persisten, CMD_CONNECT dikirimkan SATU KALI (saat startup atau setelah
 *   kegagalan jaringan yang sebenarnya). Soket tetap terbuka di antara siklus polling.
 *   Perangkat hanya berbunyi bip sekali pada koneksi awal — persis seperti perilaku normal
 *   pembaca sidik jari seharusnya.
 *
 *   Jika soket TCP terputus secara tidak terduga (misalnya perangkat reboot, gangguan jaringan),
 *   klien akan mendeteksi kesalahan tersebut dan menjadwalkan koneksi ulang penuh secara otomatis.
 *
 * Trade-off: Latensi polling ~5 detik vs. kompatibilitas perangkat 100%.
 *
 * Pola Singleton: Hanya boleh ada SATU koneksi ke perangkat fisik.
 * Instansiasi ganda akan merusak state internal ZKLib dan menghasilkan
 * catatan kehadiran yang duplikat atau hilang.
 */

// node-zklib tidak menyediakan @types — ini adalah satu-satunya batas 'any' yang diizinkan.

import { EventEmitter } from 'events';
import { env } from '../config/env';
import { ZkTcpClient } from './zklib';

// ─── Tipe Data ────────────────────────────────────────────────────────────────

export interface AttendanceRecord {
  /** Nomor seri mentah dari log internal perangkat ZKTeco */
  userSn: number;
  /** String ID Pengguna seperti yang disimpan di perangkat (memetakan ke employees.nip atau user_id) */
  deviceUserId: string;
  /** Timestamp pemindaian biometrik */
  recordTime: Date;
  /** Alamat IP perangkat yang merekam kejadian ini */
  ip: string;
  /**
   * Tipe punch ZKTeco (0=Check-In, 1=Check-Out, 2=Break-Out, 3=Break-In, 4=OT-In, 5=OT-Out).
   * Gunakan ini alih-alih menebak dari jam waktu hari.
   */
  attendanceType: number;
}

export interface DeviceInfo {
  userCounts: number;
  logCounts: number;
  logCapacity: number;
}

export type ZkClientEvent = 'attendance' | 'status' | 'error';

export type DeviceStatus = 'connecting' | 'online' | 'offline';

/**
 * Entri pengguna perangkat yang diperkaya yang disimpan dalam cache lokal.
 * Mencerminkan bentuk DecodedUser dari zklib/utils tetapi diekspor kembali melalui
 * batas ACL sehingga konsumen tidak perlu mengimpor dari zklib secara langsung.
 */
export interface CachedDeviceUser {
  uid: number;
  userId: string;
  name: string;
  role: number;
  cardno: number;
}

// ─── ZkDeviceClient ──────────────────────────────────────────────────────────

export class ZkDeviceClient extends EventEmitter {
  private static instance: ZkDeviceClient;

  private readonly zkInstance: ZkTcpClient;
  private pollingTimer: NodeJS.Timeout | null = null;
  private lastKnownLogCount = 0;
  private isRunning = false;
  private currentStatus: DeviceStatus = 'offline';
  /** Objek pengguna lengkap yang diindeks oleh string userId untuk pencarian cepat O(1) */
  private deviceUserCache = new Map<string, CachedDeviceUser>();

  private constructor() {
    super();
    // Mencegah crash proses fatal jika error dipancarkan tetapi tidak ada listener yang terpasang
    this.on('error', () => {
      /* ditelan secara diam-diam */
    });

    this.zkInstance = new ZkTcpClient(
      env.FINGERPRINT_IP,
      env.FINGERPRINT_PORT,
      env.FINGERPRINT_TIMEOUT
    );
  }

  /** Mengembalikan instansi singleton bersama. Membuatnya pada panggilan pertama. */
  public static getInstance(): ZkDeviceClient {
    if (!ZkDeviceClient.instance) {
      ZkDeviceClient.instance = new ZkDeviceClient();
    }
    return ZkDeviceClient.instance;
  }

  /** Mengembalikan status koneksi perangkat saat ini. */
  public getStatus(): DeviceStatus {
    return this.currentStatus;
  }

  /**
   * Mengembalikan jumlah total catatan kehadiran yang terlihat sejak server dimulai.
   * Digunakan oleh endpoint /health untuk mengekspos kemajuan sinkronisasi tanpa membocorkan data mentah.
   */
  public getLastSyncCount(): number {
    return this.lastKnownLogCount;
  }

  /** Mengekspos nama cache dari pengguna yang diambil dari perangkat sidik jari. */
  public getDeviceUserName(deviceUserId: string): string | undefined {
    return this.deviceUserCache.get(deviceUserId)?.name;
  }

  /**
   * Mengembalikan snapshot dari semua pengguna perangkat yang saat ini ada di cache.
   * Digunakan oleh DeviceUsersService untuk menghitung pengguna tanpa koneksi ZK baru.
   * Mengembalikan array kosong jika cache belum diisi (perangkat offline).
   */
  public getCachedUsers(): CachedDeviceUser[] {
    return Array.from(this.deviceUserCache.values());
  }

  /**
   * Memulai loop polling. Idempotent — aman untuk dipanggil beberapa kali.
   *
   * Strategi: KONEKSI PERSISTEN
   *   - Terhubung sekali (CMD_CONNECT) → perangkat berbunyi bip sekali pada awal mula — diharapkan.
   *   - Lakukan polling (getAttendances) setiap POLLING_INTERVAL_MS pada soket terbuka yang SAMA.
   *   - Hanya sambungkan kembali saat soket terputus (kesalahan jaringan, reboot perangkat, dll).
   *
   * Memancarkan Event:
   *   - 'status'     → DeviceStatus pada setiap perubahan state
   *   - 'attendance' → AttendanceRecord[] hanya berisi catatan BARU per siklus
   *   - 'error'      → Error (non-fatal, loop berlanjut dengan back-off jeda waktu)
   */
  public async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log(
      `[ZkDeviceClient] Memulai loop polling → ${env.FINGERPRINT_IP}:${env.FINGERPRINT_PORT}`
    );
    // Mulai dengan polling pertama segera (tanpa penundaan)
    this.scheduleNextPoll(0);
  }

  /** Menghentikan loop polling dan memutuskan hubungan secara bersih dari perangkat. */
  public async stop(): Promise<void> {
    this.isRunning = false;
    if (this.pollingTimer) {
      clearTimeout(this.pollingTimer);
      this.pollingTimer = null;
    }
    await this.safeDisconnect();
    this.setStatus('offline');
    console.log('[ZkDeviceClient] Polling dihentikan.');
  }

  // ─── Pembantu Privat (Private Helpers) ───────────────────────────────────────

  private scheduleNextPoll(delayMs: number): void {
    if (!this.isRunning) return;
    this.pollingTimer = setTimeout(() => {
      // Tangkap Promise yang dikembalikan secara eksplisit untuk mencegah crash akibat unhandled rejection.
      // runPollCycle memiliki try/catch sendiri, tetapi ZKLib dapat melempar
      // objek non-Error (objek polos/string) yang lolos dari batas asinkron.
      this.runPollCycle().catch((err: unknown) => {
        const error = err instanceof Error ? err : new Error(JSON.stringify(err));
        console.error('[ZkDeviceClient] Kesalahan polling tidak tertangani (jaring pengaman):', error.message);
        this.emit('error', error);
        // Paksa reset sehingga siklus berikutnya terhubung kembali dari awal
        this.currentStatus = 'offline';
        this.safeDisconnect().finally(() => {
          this.scheduleNextPoll(env.RECONNECT_DELAY_MS);
        });
      });
    }, delayMs);
  }

  private async runPollCycle(): Promise<void> {
    try {
      // ── FASE KONEKSI (hanya jika belum online) ─────────────────────────────
      // Di bawah strategi koneksi persisten, blok ini berjalan SATU KALI pada saat startup
      // dan kemudian hanya setelah soket terputus secara tidak terduga/kesalahan perangkat.
      // CMD_CONNECT memicu bunyi bip perangkat — dikirim maksimal SATU KALI per sesi.
      if (this.currentStatus !== 'online') {
        this.setStatus('connecting');

        // Selalu setel ulang soket sebelum menghubungkan kembali — zkInstance mempertahankan state
        // dan createSocket() yang gagal sebelumnya meninggalkan state internal kotor.
        // Memanggil safeDisconnect() terlebih dahulu menjamin lembaran bersih.
        await this.safeDisconnect();

        // Balapan pembuatan soket terhadap batas waktu yang dikonfigurasi.
        // Tanpa ini, jabat tangan TCP yang menggantung memblokir seluruh loop polling
        // selamanya — perangkat tidak pernah beralih kembali ke 'offline' dan tidak ada
        // percobaan ulang yang dijadwalkan.
        const socketPromise = this.zkInstance.createSocket();
        socketPromise.catch(() => {}); // telan penolakan latar belakang

        await Promise.race([
          socketPromise,
          new Promise<never>((_, reject) =>
            setTimeout(
              () =>
                reject(
                  new Error(
                    `Koneksi ke ${env.FINGERPRINT_IP}:${env.FINGERPRINT_PORT} habis waktu setelah ${env.FINGERPRINT_TIMEOUT}ms`
                  )
                ),
              env.FINGERPRINT_TIMEOUT
            )
          ),
        ]);

        const connectPromise = this.zkInstance.connect();
        connectPromise.catch(() => {}); // telan penolakan latar belakang

        await Promise.race([
          connectPromise,
          new Promise<never>((_, reject) =>
            setTimeout(
              () =>
                reject(
                  new Error(
                    `Jabat tangan dengan perangkat ZKTeco habis waktu setelah ${env.FINGERPRINT_TIMEOUT}ms`
                  )
                ),
              env.FINGERPRINT_TIMEOUT
            )
          ),
        ]);

        this.setStatus('online');
        console.log(
          `[ZkDeviceClient] ✓ Terhubung ke ${env.FINGERPRINT_IP}:${env.FINGERPRINT_PORT}`
        );
      }

      // ── FASE POLLING (berjalan setiap siklus pada soket terbuka yang SAMA) ───
      const attendancesPromise = this.zkInstance.getAttendances();
      attendancesPromise.catch(() => {});

      const result = await Promise.race([
        attendancesPromise,
        new Promise<any>((_, reject) =>
          setTimeout(
            () => reject(new Error(`getAttendances habis waktu setelah ${env.FINGERPRINT_TIMEOUT}ms`)),
            env.FINGERPRINT_TIMEOUT
          )
        ),
      ]);
      const rawRecords = result?.data ?? [];

      // Periksa apakah ada catatan dengan ID pengguna yang tidak ada dalam cache
      const hasUnknownUser = rawRecords.some(
          (r: any) => r.deviceUserId && !this.deviceUserCache.has(String(r.deviceUserId))
      );

      if (hasUnknownUser || this.deviceUserCache.size === 0) {
        try {
          const usersPromise = this.zkInstance.getUsers();
          usersPromise.catch(() => {});

          const usersRes = await Promise.race([
            usersPromise,
            new Promise<any>((_, reject) =>
              setTimeout(
                () => reject(new Error(`getUsers habis waktu setelah ${env.FINGERPRINT_TIMEOUT}ms`)),
                env.FINGERPRINT_TIMEOUT
              )
            ),
          ]);
          const rawUsers = usersRes?.data ?? [];
          this.deviceUserCache.clear();
          for (const u of rawUsers) {
            if (u.userId) {
              this.deviceUserCache.set(String(u.userId), {
                uid: u.uid,
                userId: String(u.userId),
                name: u.name || '',
                role: u.role,
                cardno: u.cardno,
              });
            }
          }
          console.log(
            `[ZkDeviceClient] Cache diperbarui: ${this.deviceUserCache.size} pengguna dimuat.`
          );
        } catch (err) {
          console.warn('[ZkDeviceClient] Gagal memperbarui cache daftar pengguna perangkat:', err);
        }
      }

      // Petakan output mentah ZkTcpClient ke antarmuka AttendanceRecord yang bertipe kuat
      const allRecords: AttendanceRecord[] = rawRecords.map((r: any) => {
        return {
          userSn: r.userSn,
          deviceUserId: r.deviceUserId,
          recordTime: r.recordTime,
          ip: env.FINGERPRINT_IP,
          attendanceType: r.attendanceType ?? 0,
        };
      });

      const newCount = allRecords.length;

      // [CRITICAL FIX]: Tangani pembersihan memori perangkat jika log dihapus manual di alat
      if (newCount < this.lastKnownLogCount) {
        console.warn(`[ZkDeviceClient] Log perangkat dihapus/dibersihkan! Menyetel ulang pointer dari ${this.lastKnownLogCount} ke 0.`);
        this.lastKnownLogCount = 0;
      }

      if (newCount > this.lastKnownLogCount) {
        const newRecords = allRecords.slice(this.lastKnownLogCount);
        this.lastKnownLogCount = newCount;
        this.emit('attendance', newRecords);
        console.log(
          `[ZkDeviceClient] ${newRecords.length} catatan kehadiran baru terdeteksi. Total: ${newCount}`
        );
      }

      // ── KONEKSI PERSISTEN: Jangan terputus setelah setiap polling ───────────
      // Jaga agar soket tetap terbuka. Jadwalkan siklus polling berikutnya dan kembali.
      // Perangkat hanya akan berbunyi bip lagi jika koneksi terputus dan perlu
      // dibuat kembali (ditangani oleh blok catch di bawah).
      this.scheduleNextPoll(env.POLLING_INTERVAL_MS);

    } catch (err) {
      const error =
        err instanceof Error
          ? err
          : new Error(typeof err === 'object' ? JSON.stringify(err) : String(err));

      const retrySec = Math.round(env.RECONNECT_DELAY_MS / 1000);
      console.warn(`[ZkDeviceClient] ✗ ${error.message} — menghubungkan kembali dalam ${retrySec} detik`);
      this.emit('error', error);

      // Tandai offline dan hancurkan soket yang rusak secara bersih sebelum mencoba lagi.
      // Siklus polling berikutnya akan terhubung kembali (satu bip pada perangkat) dan dilanjutkan.
      this.setStatus('offline');
      await this.safeDisconnect();
      this.scheduleNextPoll(env.RECONNECT_DELAY_MS);
    }
  }

  private setStatus(status: DeviceStatus): void {
    if (this.currentStatus !== status) {
      this.currentStatus = status;
      this.emit('status', status);
      console.log(`[ZkDeviceClient] Status → ${status}`);
    }
  }

  private async safeDisconnect(): Promise<void> {
    try {
      await this.zkInstance.disconnect();
    } catch {
      // Sengaja diabaikan — kesalahan pemutusan koneksi bersifat non-fatal.
      // zkInstance tidak mempertahankan state di antara siklus polling; pemutusan koneksi yang basi
      // tidak akan merusak panggilan createSocket() siklus berikutnya.
    }
  }
}
