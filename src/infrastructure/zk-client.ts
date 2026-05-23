/**
 * src/infrastructure/zk-client.ts
 *
 * Anti-Corruption Layer (ACL) for ZKTeco X100-C biometric device.
 *
 * Architecture decision — Polling vs. Live-Push:
 *   The X100-C communicates over proprietary ZKTeco protocol on port 4370.
 *   node-zklib does NOT expose a reliable event listener for live push events
 *   on all firmware versions. To guarantee compatibility, we use a polling
 *   strategy: fetch all attendance logs every N seconds, diff against the
 *   last known count, and emit only NEW records.
 *
 * Trade-off: ~5s latency vs. 100% device compatibility.
 *
 * Singleton pattern: Only ONE connection to the physical device should exist.
 * Double-instantiation would corrupt the ZKLib internal state and produce
 * duplicate or missing attendance records.
 *
 * Boundary note: node-zklib does not ship TypeScript typings.
 * The `any` usage below is confined to this file ONLY and is intentional.
 * All consumers of this class receive properly typed interfaces.
 */

// node-zklib does not provide @types — this is the ONLY permitted any boundary.
// eslint-disable-next-line @typescript-eslint/no-require-imports
import { EventEmitter } from 'events';
import { env } from '../config/env';
import { ZkTcpClient } from './zklib';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AttendanceRecord {
  /** Raw serial number from ZKTeco device internal log */
  userSn: number;
  /** User ID string as stored on the device (maps to employees.nip or user_id) */
  deviceUserId: string;
  /** Timestamp of the biometric scan */
  recordTime: Date;
  /** IP address of the device that recorded this event */
  ip: string;
}

export interface DeviceInfo {
  userCounts: number;
  logCounts: number;
  logCapacity: number;
}

export type ZkClientEvent = 'attendance' | 'status' | 'error';

export type DeviceStatus = 'connecting' | 'online' | 'offline';

/**
 * Enriched device user entry stored in the local cache.
 * Mirrors the DecodedUser shape from zklib/utils but re-exported through
 * the ACL boundary so consumers never need to import from zklib directly.
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
  /** Full user objects keyed by userId string for O(1) lookup */
  private deviceUserCache = new Map<string, CachedDeviceUser>();

  private constructor() {
    super();
    // Prevent fatal process crashes if an error is emitted but no listeners are attached
    this.on('error', () => { /* silently swallowed */ });

    this.zkInstance = new ZkTcpClient(
      env.FINGERPRINT_IP,
      env.FINGERPRINT_PORT,
      env.FINGERPRINT_TIMEOUT,
    );
  }

  /** Returns the shared singleton instance. Creates it on first call. */
  public static getInstance(): ZkDeviceClient {
    if (!ZkDeviceClient.instance) {
      ZkDeviceClient.instance = new ZkDeviceClient();
    }
    return ZkDeviceClient.instance;
  }

  /** Returns the current connection status of the device. */
  public getStatus(): DeviceStatus {
    return this.currentStatus;
  }

  /**
   * Returns the total number of attendance records seen since server start.
   * Used by the /health endpoint to expose sync progress without leaking raw data.
   */
  public getLastSyncCount(): number {
    return this.lastKnownLogCount;
  }

  /** Exposes the cached name of a user fetched from the fingerprint device. */
  public getDeviceUserName(deviceUserId: string): string | undefined {
    return this.deviceUserCache.get(deviceUserId)?.name;
  }

  /**
   * Returns a snapshot of all device users currently in cache.
   * Used by DeviceUsersService to enumerate users without a new ZK connection.
   * Returns an empty array if the cache has not been populated yet (device offline).
   */
  public getCachedUsers(): CachedDeviceUser[] {
    return Array.from(this.deviceUserCache.values());
  }

  /**
   * Starts the polling loop. Idempotent — safe to call multiple times.
   *
   * Emits:
   *   - 'status'     → DeviceStatus on every state change
   *   - 'attendance' → AttendanceRecord[] containing only NEW records per cycle
   *   - 'error'      → Error (non-fatal, loop continues with back-off)
   */
  public async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log(
      `[ZkDeviceClient] Starting polling loop → ${env.FINGERPRINT_IP}:${env.FINGERPRINT_PORT}`,
    );
    this.scheduleNextPoll(0);
  }

  /** Stops the polling loop and cleanly disconnects from the device. */
  public async stop(): Promise<void> {
    this.isRunning = false;
    if (this.pollingTimer) {
      clearTimeout(this.pollingTimer);
      this.pollingTimer = null;
    }
    await this.safeDisconnect();
    this.setStatus('offline');
    console.log('[ZkDeviceClient] Polling stopped.');
  }

  // ─── Private Helpers ───────────────────────────────────────────────────────

  private scheduleNextPoll(delayMs: number): void {
    if (!this.isRunning) return;
    this.pollingTimer = setTimeout(() => {
      // Explicitly catch the returned Promise to prevent unhandled rejection
      // crashes. runPollCycle has its own try/catch, but ZKLib can throw
      // non-Error objects (plain objects/strings) that escape the async boundary.
      this.runPollCycle().catch((err: unknown) => {
        const error = err instanceof Error ? err : new Error(JSON.stringify(err));
        console.error('[ZkDeviceClient] Unhandled poll error (safety net):', error.message);
        this.emit('error', error);
        // Force reset so the next cycle reconnects from scratch
        this.currentStatus = 'offline';
        this.safeDisconnect().finally(() => {
          this.scheduleNextPoll(env.RECONNECT_DELAY_MS);
        });
      });
    }, delayMs);
  }

  private async runPollCycle(): Promise<void> {
    try {
      if (this.currentStatus !== 'online') {
        this.setStatus('connecting');

        // Always reset the socket before reconnecting — zkInstance is stateful
        // and a previously failed createSocket() leaves internal state dirty.
        // Calling safeDisconnect() first guarantees a clean slate.
        await this.safeDisconnect();

        // Race the socket creation against the configured timeout.
        // Without this, a hung TCP handshake blocks the entire polling loop
        // forever — the device never transitions back to 'offline' and no
        // retry is scheduled.
        // Prevent unhandled promise rejection if createSocket() fails AFTER the timeout
        const socketPromise = this.zkInstance.createSocket();
        socketPromise.catch(() => {}); // swallow background rejection

        await Promise.race([
          socketPromise,
          new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error(`Connection to ${env.FINGERPRINT_IP}:${env.FINGERPRINT_PORT} timed out after ${env.FINGERPRINT_TIMEOUT}ms`)),
              env.FINGERPRINT_TIMEOUT,
            ),
          ),
        ]);

        await this.zkInstance.connect();

        this.setStatus('online');
        console.log(`[ZkDeviceClient] ✓ Connected to ${env.FINGERPRINT_IP}:${env.FINGERPRINT_PORT}`);
      }

      const result = await this.zkInstance.getAttendances();
      const rawRecords = result?.data ?? [];

      // Check if there are any records with user IDs not present in the cache
      const hasUnknownUser = rawRecords.some(
        (r) => r.deviceUserId && !this.deviceUserCache.has(String(r.deviceUserId))
      );

      if (hasUnknownUser || this.deviceUserCache.size === 0) {
        try {
          const usersRes = await this.zkInstance.getUsers();
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
          console.log(`[ZkDeviceClient] Cache refreshed: ${this.deviceUserCache.size} users loaded.`);
        } catch (err) {
          console.warn('[ZkDeviceClient] Failed to refresh device users list cache:', err);
        }
      }

      // Map raw ZkTcpClient output to our typed AttendanceRecord interface
      const allRecords: AttendanceRecord[] = rawRecords.map((r) => {
        return {
          userSn: r.userSn,
          deviceUserId: r.deviceUserId,
          recordTime: r.recordTime,
          ip: env.FINGERPRINT_IP,
        };
      });

      const newCount = allRecords.length;

      if (newCount > this.lastKnownLogCount) {
        const newRecords = allRecords.slice(this.lastKnownLogCount);
        this.lastKnownLogCount = newCount;
        this.emit('attendance', newRecords);
        console.log(
          `[ZkDeviceClient] ${newRecords.length} new attendance record(s) detected. Total: ${newCount}`,
        );
      }

      this.scheduleNextPoll(env.POLLING_INTERVAL_MS);
    } catch (err) {
      const error = err instanceof Error
        ? err
        : new Error(typeof err === 'object' ? JSON.stringify(err) : String(err));
      // Log with retry countdown so it's easy to track in the terminal
      const retrySec = Math.round(env.RECONNECT_DELAY_MS / 1000);
      console.warn(
        `[ZkDeviceClient] ✗ ${error.message} — retrying in ${retrySec}s`,
      );
      this.emit('error', error);
      this.setStatus('offline');
      // Ensure socket is fully torn down before the next attempt
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
      // Intentionally ignored — disconnect errors are non-fatal.
      // The zkInstance is stateless across poll cycles; a stale disconnect
      // will not corrupt the next cycle's createSocket() call.
    }
  }
}
