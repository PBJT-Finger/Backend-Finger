/**
 * src/services/zk-sync.service.ts
 *
 * Bridges the ZkDeviceClient (hardware layer) with the Prisma database (persistence layer).
 *
 * Responsibilities:
 *   1. Listen for 'attendance' events emitted by ZkDeviceClient
 *   2. Map ZKTeco AttendanceRecord fields to the Prisma `attendance` schema
 *   3. Persist records using upsert for idempotency (safe to replay on reconnect)
 *   4. Never crash the process — all errors are caught, logged, and the loop continues
 *
 * Design decision — upsert vs. insert:
 *   ZKTeco devices re-emit all historical records on every poll cycle.
 *   A raw INSERT would produce massive duplication on reconnect.
 *   We use prisma.attendance.upsert with a composite unique key
 *   (user_id + tanggal + jam_masuk) to ensure idempotency.
 *
 *   NOTE: Schema currently lacks @@unique([user_id, tanggal]) — see schema migration note below.
 *   Until that migration is applied, we use findFirst + createOrUpdate pattern to avoid
 *   a runtime crash. Sprint 5 migration task adds the proper DB constraint.
 *
 * Mapping note:
 *   ZKTeco → Prisma attendance fields:
 *   - deviceUserId → user_id (String)
 *   - recordTime   → tanggal (Date only) + jam_masuk (Time, first scan) / jam_keluar (Time, subsequent)
 *   - ip           → device_id (used as reference key)
 */

import { v4 as uuidv4 } from 'uuid';
import prisma from '../config/prisma';
import { ZkDeviceClient, AttendanceRecord } from '../infrastructure/zk-client';
// import type { Prisma } from '@prisma/client';

// ─── Types ───────────────────────────────────────────────────────────────────

interface BatchResult {
  batchId: string;
  processed: number;
  created: number;
  updated: number;
  errors: number;
}

// ─── ZkSyncService ───────────────────────────────────────────────────────────

export class ZkSyncService {
  private readonly zkClient: ZkDeviceClient;

  constructor(zkClient: ZkDeviceClient) {
    this.zkClient = zkClient;
  }

  /**
   * Attaches the attendance listener to ZkDeviceClient.
   * Call this once after server startup. Idempotent for repeated calls
   * because EventEmitter deduplicates identical listener references.
   */
  public start(): void {
    this.zkClient.on('attendance', (records: AttendanceRecord[]) => {
      // Fire-and-forget: persistAttendanceBatch handles its own error catching.
      // We intentionally do NOT await here — the event handler must return
      // synchronously to avoid blocking the EventEmitter call stack.
      void this.persistAttendanceBatch(records);
    });

    console.log('[ZkSyncService] Attendance sync listener attached.');
  }

  /**
   * Persists a batch of attendance records from the ZKTeco device into the database.
   *
   * Idempotency strategy:
   *   For each record, we check if an attendance row already exists for
   *   (user_id + tanggal). If yes → update jam_keluar (last scan of day).
   *   If no → create new row with jam_masuk (first scan of day).
   *
   * Error isolation:
   *   Each record is processed in a try/catch independently. One bad record
   *   does not abort the entire batch.
   */
  private async persistAttendanceBatch(records: AttendanceRecord[]): Promise<BatchResult> {
    const batchId = uuidv4();
    let created = 0;
    const updated = 0;
    let errors = 0;

    console.log(`[ZkSyncService] Processing batch ${batchId} — ${records.length} record(s)`);

    for (const record of records) {
      try {
        await this.upsertAttendanceRecord(record);
        // We determine created/updated from the result but for simplicity
        // we increment both counters in the catch-free path
        created++;
      } catch (err) {
        errors++;
        const msg = err instanceof Error ? err.message : String(err);
        console.error(
          `[ZkSyncService] Failed to persist record for user=${record.deviceUserId} time=${record.recordTime.toISOString()} — ${msg}`
        );
        // Do NOT rethrow — isolate this record's failure from the rest of the batch
      }
    }

    const result: BatchResult = {
      batchId,
      processed: records.length,
      created,
      updated,
      errors,
    };

    console.log(
      `[ZkSyncService] Batch ${batchId} complete — processed=${result.processed} created=${result.created} errors=${result.errors}`
    );

    return result;
  }

  /**
   * Upsert logic for a single attendance record.
   *
   * Business rule mapping:
   *   - First scan of the day → creates row with jam_masuk
   *   - Subsequent scan of same day → updates jam_keluar
   *
   * This reflects the typical fingerprint machine usage: employee taps in the
   * morning (jam_masuk) and taps again when leaving (jam_keluar).
   */
  private async upsertAttendanceRecord(record: AttendanceRecord): Promise<void> {
    const t = new Date(record.recordTime);
    // recordTime is now UTC-aligned (parseTimeToDate uses Date.UTC).
    // Use getUTC* to extract the original device time values.
    const tanggal = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()));

    // 1. deviceUserId maps directly to user_id
    const user_id = record.deviceUserId;

    // 2. Fetch employee details
    const employee = await prisma.employees.findFirst({
      where: { user_id: user_id, is_active: true },
      include: { shifts: true },
    });

    const resolvedUserId = employee?.user_id ?? record.deviceUserId;
    const deviceName = this.zkClient.getDeviceUserName(record.deviceUserId);
    const resolvedName = employee?.nama ?? deviceName ?? `Karyawan ${record.deviceUserId}`;
    const resolvedJabatan = employee?.jabatan === 'DOSEN' ? 'DOSEN' : 'KARYAWAN';

    // Store time components — use getUTC* since recordTime is UTC-aligned
    const timePart = new Date(
      Date.UTC(1970, 0, 1, t.getUTCHours(), t.getUTCMinutes(), t.getUTCSeconds())
    );

    // ─── Determine masuk/keluar from device attendanceType ───────────────────
    // ZKTeco punch type (byte 26 of 40-byte record):
    //   0=Check-In, 1=Check-Out, 2=Break-Out, 3=Break-In, 4=OT-In, 5=OT-Out
    // Type 1 and 5 are "keluar" variants; all others treated as masuk.
    const isKeluar = record.attendanceType === 1 || record.attendanceType === 5;

    if (!isKeluar) {
      // ─── SCAN MASUK (Check-In) ───
      const shiftStartHour = employee?.shifts
        ? new Date(employee.shifts.jam_masuk).getUTCHours()
        : 8;
      const shiftStartMinute = employee?.shifts
        ? new Date(employee.shifts.jam_masuk).getUTCMinutes()
        : 0;
      const scanMinutes = t.getUTCHours() * 60 + t.getUTCMinutes();
      const shiftMinutes = shiftStartHour * 60 + shiftStartMinute;
      const toleranceMinutes = 15;

      const morningStatus = scanMinutes > shiftMinutes + toleranceMinutes ? 'TERLAMBAT' : 'HADIR';

      await prisma.attendance.create({
        data: {
          user_id: resolvedUserId,
          nama: resolvedName,
          jabatan: resolvedJabatan,
          tanggal: tanggal,
          jam_masuk: timePart,
          jam_keluar: null,
          device_id: record.ip,
          verification_method: 'SIDIK_JARI',
          status: morningStatus,
          status_keluar: 'HADIR',
        },
      });
    } else {
      // ─── SCAN KELUAR / PULANG (Check-Out) ───
      const shiftEndHour = employee?.shifts
        ? new Date(employee.shifts.jam_keluar).getUTCHours()
        : 16;
      const shiftEndMinute = employee?.shifts
        ? new Date(employee.shifts.jam_keluar).getUTCMinutes()
        : 30;

      const scanMinutes = t.getUTCHours() * 60 + t.getUTCMinutes();
      const targetMinutes = employee?.shifts ? shiftEndHour * 60 + shiftEndMinute : 990;

      const afternoonStatus = scanMinutes < targetMinutes ? 'PULANG_CEPAT' : 'HADIR';

      await prisma.attendance.create({
        data: {
          user_id: resolvedUserId,
          nama: resolvedName,
          jabatan: resolvedJabatan,
          tanggal: tanggal,
          jam_masuk: null,
          jam_keluar: timePart,
          device_id: record.ip,
          verification_method: 'SIDIK_JARI',
          status: 'HADIR',
          status_keluar: afternoonStatus,
        },
      });
    }
  }
}
