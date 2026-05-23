/**
 * src/controllers/device.users.controller.ts
 *
 * HTTP boundary for device user management operations.
 *
 * Endpoints:
 *   GET  /api/device/users/pull    — list device users with DB registration status
 *   POST /api/device/users/register — register a device user into the system
 *
 * Auth: Both endpoints require a valid Bearer token (authenticateToken middleware).
 *
 * Error contract:
 *   All errors return the standard envelope: { success: false, message: string }
 *   400 — validation failure or business rule violation
 *   409 — conflict (user already registered)
 *   500 — unexpected service error
 */

import { Request, Response } from 'express';
import { DeviceUsersService } from '../services/device.users.service';
import { successResponse, errorResponse } from '../utils/responseFormatter';
import logger from '../utils/logger';

// ─── Constants ────────────────────────────────────────────────────────────────

const VALID_JABATAN = ['DOSEN', 'KARYAWAN'] as const;

// ─── DeviceUsersController ────────────────────────────────────────────────────

export class DeviceUsersController {
  /**
   * GET /api/device/users/pull
   *
   * Returns all users registered on the ZKTeco device along with their
   * registration status in the database. Data is sourced from the in-memory
   * cache — no new ZK connection is established.
   *
   * Response shape:
   * {
   *   "success": true,
   *   "data": {
   *     "deviceStatus": "online" | "offline" | "connecting",
   *     "totalOnDevice": number,
   *     "summary": { "registered": N, "unregistered": N, "partial": N },
   *     "users": [ DeviceUserWithStatus[] ]
   *   }
   * }
   */
  public static async pullDeviceUsers(req: Request, res: Response): Promise<Response> {
    try {
      const service = new DeviceUsersService();
      const result = await service.getDeviceUsersWithStatus();

      return successResponse(
        res,
        result,
        `Berhasil menarik ${result.totalOnDevice} pengguna dari cache alat.`,
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error('Pull device users error', {
        error: msg,
        userId: req.user?.id,
        correlationId: req.correlationId,
      });
      return errorResponse(res, 'Gagal menarik data pengguna dari alat', 500);
    }
  }

  /**
   * POST /api/device/users/register
   *
   * Registers a single device user into the system.
   * Body: { deviceUserId, nama, jabatan, shiftId }
   *
   * Response shape:
   * {
   *   "success": true,
   *   "data": {
   *     "user_id": string,
   *     "nama": string,
   *     "jabatan": string,
   *     "deviceUserId": string,
   *     "action": "created" | "mapping_added",
   *     "patchedAttendanceCount": number
   *   }
   * }
   */
  public static async registerDeviceUser(req: Request, res: Response): Promise<Response> {
    try {
      const { deviceUserId, nama, jabatan, shiftId } = req.body as {
        deviceUserId?: unknown;
        nama?: unknown;
        jabatan?: unknown;
        shiftId?: unknown;
      };

      // ── Input validation ──────────────────────────────────────────────────

      if (!deviceUserId || typeof deviceUserId !== 'string' || deviceUserId.trim() === '') {
        return errorResponse(res, 'deviceUserId wajib diisi dan harus berupa string', 400);
      }

      if (!nama || typeof nama !== 'string' || nama.trim() === '') {
        return errorResponse(res, 'Nama wajib diisi', 400);
      }

      if (!jabatan || !VALID_JABATAN.includes(jabatan as (typeof VALID_JABATAN)[number])) {
        return errorResponse(
          res,
          `Jabatan harus salah satu dari: ${VALID_JABATAN.join(', ')}`,
          400,
        );
      }

      const parsedShiftId = typeof shiftId === 'number' ? shiftId : parseInt(String(shiftId), 10);
      if (isNaN(parsedShiftId) || parsedShiftId <= 0) {
        return errorResponse(res, 'shiftId harus berupa angka positif', 400);
      }

      // ── Service call ──────────────────────────────────────────────────────

      const service = new DeviceUsersService();
      const result = await service.registerDeviceUser({
        deviceUserId: deviceUserId.trim(),
        nama: nama.trim(),
        jabatan: jabatan as 'DOSEN' | 'KARYAWAN',
        shiftId: parsedShiftId,
      });

      const message =
        result.action === 'created'
          ? `Pengguna "${result.nama}" berhasil didaftarkan sebagai karyawan baru`
          : `Mapping berhasil ditambahkan untuk karyawan "${result.nama}" yang sudah terdaftar`;

      logger.audit('DEVICE_USER_REGISTERED', req.user?.id ?? 0, {
        deviceUserId,
        user_id: deviceUserId.trim(),
        action: result.action,
        patchedAttendanceCount: result.patchedAttendanceCount,
        ip: req.ip,
        correlationId: req.correlationId,
      });

      return successResponse(res, result, message, 201);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);

      // Distinguish business rule violations (4xx) from unexpected errors (5xx)
      const isConflict =
        msg.includes('sudah terdaftar') ||
        msg.includes('sudah dipetakan') ||
        msg.includes('tidak ditemukan di cache');

      logger.error('Register device user error', {
        error: msg,
        userId: req.user?.id,
        body: { deviceUserId: req.body?.deviceUserId },
        correlationId: req.correlationId,
      });

      if (isConflict) {
        return errorResponse(res, msg, msg.includes('tidak ditemukan') ? 400 : 409);
      }

      return errorResponse(res, 'Gagal mendaftarkan pengguna alat', 500);
    }
  }
}

export default DeviceUsersController;
