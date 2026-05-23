/**
 * src/services/device.users.service.ts
 *
 * Bridges the ZkDeviceClient user cache with the database registration tables.
 *
 * Responsibilities:
 *   1. Read device user cache from ZkDeviceClient singleton (no new ZK connection)
 *   2. Cross-reference against employees tables
 *   3. Register new users: create employee
 *   4. Patch orphaned attendance records after a successful registration
 *
 * Design decision — Cache over live connection:
 *   ZkDeviceClient maintains a deviceUserCache refreshed every poll cycle (~5s).
 *   Creating a second ZK connection would corrupt the polling loop's TCP state.
 *   The ~5s cache staleness is acceptable for an admin registration workflow.
 *
 * Trade-off: If device is offline and cache is empty, pull returns an empty list
 *   with a clear error signal rather than attempting a new connection.
 */

import { v4 as uuidv4 } from 'uuid';
import prisma from '../config/prisma';
import { ZkDeviceClient } from '../infrastructure/zk-client';
import logger from '../utils/logger';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Registration status of a device user relative to the DB. */
export type RegistrationStatus = 'registered' | 'unregistered' | 'partial';

/**
 * A device user enriched with its DB registration status.
 * - `registered`:   employee is active — fully operational
 * - `partial`:      employee exists BUT inactive
 * - `unregistered`: no employee at all — this user will show as a number on the web
 */
export interface DeviceUserWithStatus {
  /** Internal serial number from the ZKTeco device memory */
  uid: number;
  /** User ID used as user_id in employees */
  userId: string;
  /** Name stored on the physical device */
  name: string;
  /** ZK role: 0 = normal user, 14 = admin */
  role: number;
  /** Card number (0 if not assigned) */
  cardno: number;
  registrationStatus: RegistrationStatus;
  /** Employee name from the employees table; null if unregistered */
  employeeNama: string | null;
  /** Employee jabatan; null if unregistered */
  employeeJabatan: string | null;
}

export interface DeviceUserPullResult {
  deviceStatus: string;
  totalOnDevice: number;
  summary: {
    registered: number;
    unregistered: number;
    partial: number;
  };
  users: DeviceUserWithStatus[];
}

export interface RegisterDeviceUserDto {
  /** device_user_id from the ZKTeco device (e.g. "12") */
  deviceUserId: string;
  /** Name for the employee record */
  nama: string;
  /** Jabatan enum value */
  jabatan: 'DOSEN' | 'KARYAWAN';
  /** Shift ID from the shifts table */
  shiftId: number;
}

export interface RegisterResult {
  user_id: string;
  nama: string;
  jabatan: string;
  deviceUserId: string;
  /** "created" = new employee; "mapping_added" = employee existed */
  action: 'created' | 'mapping_added';
  /** Number of orphaned attendance records that were patched */
  patchedAttendanceCount: number;
}

// ─── DeviceUsersService ───────────────────────────────────────────────────────

export class DeviceUsersService {
  private readonly zkClient: ZkDeviceClient;

  constructor() {
    // Reuse the singleton — do NOT create a new ZK connection here
    this.zkClient = ZkDeviceClient.getInstance();
  }

  /**
   * Returns all users from the ZkDeviceClient cache with their DB registration status.
   *
   * Uses a single batch DB query per table to avoid N+1 query problems.
   */
  public async getDeviceUsersWithStatus(): Promise<DeviceUserPullResult> {
    const deviceStatus = this.zkClient.getStatus();

    const cachedUsers = this.zkClient.getCachedUsers();

    if (cachedUsers.length === 0) {
      logger.warn('[DeviceUsersService] Cache is empty — device may be offline or not yet polled', {
        deviceStatus,
      });
      return {
        deviceStatus,
        totalOnDevice: 0,
        summary: { registered: 0, unregistered: 0, partial: 0 },
        users: [],
      };
    }

    const deviceUserIds = cachedUsers.map((u) => u.userId);
    const employees =
      deviceUserIds.length > 0
        ? await prisma.employees.findMany({
            where: { user_id: { in: deviceUserIds } },
            select: { user_id: true, nama: true, jabatan: true, is_active: true },
          })
        : [];

    // Build a lookup map: user_id → employee
    const employeeByUserId = new Map(employees.map((e) => [e.user_id, e]));

    // Merge into final result
    const users: DeviceUserWithStatus[] = cachedUsers.map((u) => {
      const employee = employeeByUserId.get(u.userId) ?? null;

      let registrationStatus: RegistrationStatus;
      if (!employee) {
        registrationStatus = 'unregistered';
      } else if (!employee.is_active) {
        registrationStatus = 'partial';
      } else {
        registrationStatus = 'registered';
      }

      return {
        uid: u.uid,
        userId: u.userId,
        name: u.name,
        role: u.role,
        cardno: u.cardno,
        registrationStatus,
        employeeNama: employee?.nama ?? null,
        employeeJabatan: employee?.jabatan ?? null,
      };
    });

    const summary = users.reduce(
      (acc, u) => {
        acc[u.registrationStatus]++;
        return acc;
      },
      { registered: 0, unregistered: 0, partial: 0 },
    );

    logger.info('[DeviceUsersService] Pull completed', {
      deviceStatus,
      total: users.length,
      ...summary,
    });

    return {
      deviceStatus,
      totalOnDevice: users.length,
      summary,
      users,
    };
  }

  /**
   * Registers a device user into the system.
   *
   * @throws Error if deviceUserId not found in cache
   */
  public async registerDeviceUser(dto: RegisterDeviceUserDto): Promise<RegisterResult> {
    const { deviceUserId, nama, jabatan, shiftId } = dto;

    // 1. Validate the device user exists in cache
    const cachedUsers = this.zkClient.getCachedUsers();
    const deviceUser = cachedUsers.find((u) => u.userId === deviceUserId);
    if (!deviceUser) {
      throw new Error(
        `Device user ID "${deviceUserId}" tidak ditemukan di cache. ` +
          'Pastikan alat terhubung dan coba tarik data terlebih dahulu.',
      );
    }

    // 2. Check if employee already exists
    const existingEmployee = await prisma.employees.findUnique({
      where: { user_id: deviceUserId },
    });

    const batchId = uuidv4();
    let action: 'created' | 'mapping_added';

    await prisma.$transaction(async (tx) => {
      if (!existingEmployee) {
        // Create new employee
        await tx.employees.create({
          data: {
            user_id: deviceUserId,
            nama,
            jabatan,
            shift_id: shiftId,
            is_active: true,
            tanggal_masuk: new Date(),
          },
        });
        action = 'created';
        logger.info('[DeviceUsersService] Employee created', { user_id: deviceUserId, nama, jabatan, batchId });
      } else {
        // Employee exists — just update
        await tx.employees.update({
          where: { user_id: deviceUserId },
          data: {
            nama,
            jabatan,
            shift_id: shiftId,
          }
        });
        action = 'mapping_added';
        logger.info('[DeviceUsersService] Employee updated', {
          user_id: deviceUserId,
          existingNama: existingEmployee.nama,
          batchId,
        });
      }
    });

    // 3. Patch orphaned attendance records (outside transaction — non-fatal)
    const patchedAttendanceCount = await this.patchOrphanAttendanceRecords(
      deviceUserId,
      nama,
      jabatan,
    );

    logger.audit?.('DEVICE_USER_REGISTERED', 0, {
      deviceUserId,
      user_id: deviceUserId,
      nama,
      jabatan,
      action: action!,
      patchedAttendanceCount,
      batchId,
    });

    return {
      user_id: deviceUserId,
      nama: nama,
      jabatan,
      deviceUserId,
      action: action!,
      patchedAttendanceCount,
    };
  }

  /**
   * Updates orphaned attendance records that were created before this employee existed.
   */
  private async patchOrphanAttendanceRecords(
    deviceUserId: string,
    nama: string,
    jabatan: 'DOSEN' | 'KARYAWAN',
  ): Promise<number> {
    try {
      const result = await prisma.attendance.updateMany({
        where: {
          user_id: deviceUserId,
          is_deleted: false,
        },
        data: {
          nama,
          jabatan,
          updated_at: new Date(),
        },
      });

      if (result.count > 0) {
        logger.info('[DeviceUsersService] Orphaned attendance records patched', {
          deviceUserId,
          patchedCount: result.count,
        });
      }

      return result.count;
    } catch (err) {
      // Non-fatal — log and continue. The registration itself succeeded.
      logger.error('[DeviceUsersService] Failed to patch orphaned attendance records', {
        deviceUserId,
        error: err instanceof Error ? err.message : String(err),
      });
      return 0;
    }
  }
}
