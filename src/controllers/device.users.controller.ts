/**
 * src/controllers/device.users.controller.ts
 *
 * Batasan HTTP untuk operasi manajemen pengguna perangkat sidik jari.
 *
 * Endpoint yang didukung:
 *   GET  /api/device/users/pull    — Menarik daftar pengguna dari cache mesin beserta status registrasi mereka di DB
 *   POST /api/device/users/register — Mendaftarkan pengguna mesin sidik jari ke dalam tabel pegawai (employees) sistem
 *
 * Autentikasi: Kedua endpoint memerlukan token Bearer JWT yang valid (melalui middleware authenticateToken).
 *
 * Format Respon Error:
 *   Semua error dikembalikan dalam format standar: { success: false, message: string }
 *   400 — Kegagalan validasi atau pelanggaran aturan bisnis
 *   409 — Konflik data (misal pengguna sudah terdaftar)
 *   500 — Kesalahan internal server yang tidak terduga
 */

import { Request, Response } from 'express';
import { DeviceUsersService } from '../services/device.users.service'; // Mengimpor business logic terkait pengguna mesin
import { successResponse, errorResponse } from '../utils/responseFormatter'; // Util format respon API
import logger from '../utils/logger'; // Logger aplikasi

// ─── Konstanta ────────────────────────────────────────────────────────────────

// Daftar jabatan pegawai yang sah dalam sistem
const VALID_JABATAN = ['DOSEN', 'KARYAWAN'] as const;

// ─── DeviceUsersController ────────────────────────────────────────────────────

export class DeviceUsersController {
  /**
   * GET /api/device/users/pull
   *
   * Mengembalikan semua pengguna yang terdaftar di perangkat ZKTeco beserta status
   * sinkronisasi registrasinya di database. Data diambil dari cache memori internal
   * klien sidik jari agar tidak membebani perangkat secara berlebihan.
   *
   * Format Respon Sukses:
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
      // Mengambil daftar pengguna dari perangkat ZKTeco beserta status pemetaannya di database
      const result = await service.getDeviceUsersWithStatus();

      return successResponse(
        res,
        result,
        `Berhasil menarik ${result.totalOnDevice} pengguna dari cache alat.`
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error('Error saat menarik data pengguna perangkat', {
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
   * Mendaftarkan satu pengguna mesin sidik jari ke database pegawai internal.
   * Parameter Body: { deviceUserId, nama, jabatan, shiftId }
   *
   * Format Respon Sukses:
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

      // ── Validasi Input Parameter ──────────────────────────────────────────

      // Memastikan deviceUserId diisi, berupa string, dan tidak kosong
      if (!deviceUserId || typeof deviceUserId !== 'string' || deviceUserId.trim() === '') {
        return errorResponse(res, 'deviceUserId wajib diisi dan harus berupa string', 400);
      }

      // Memastikan nama pegawai diisi dan berupa string
      if (!nama || typeof nama !== 'string' || nama.trim() === '') {
        return errorResponse(res, 'Nama wajib diisi', 400);
      }

      // Memastikan jabatan yang dimasukkan bernilai 'DOSEN' atau 'KARYAWAN'
      if (!jabatan || !VALID_JABATAN.includes(jabatan as (typeof VALID_JABATAN)[number])) {
        return errorResponse(
          res,
          `Jabatan harus salah satu dari: ${VALID_JABATAN.join(', ')}`,
          400
        );
      }

      // Validasi shiftId jika disediakan oleh client
      let parsedShiftId: number | null = null;
      if (shiftId !== undefined && shiftId !== null && shiftId !== '') {
        const temp = typeof shiftId === 'number' ? shiftId : parseInt(String(shiftId), 10);
        if (isNaN(temp) || temp <= 0) {
          return errorResponse(res, 'shiftId harus berupa angka positif', 400);
        }
        parsedShiftId = temp;
      }

      // ── Memanggil Logika Layanan Registrasi ─────────────────────────────────

      const service = new DeviceUsersService();
      const result = await service.registerDeviceUser({
        deviceUserId: deviceUserId.trim(),
        nama: nama.trim(),
        jabatan: jabatan as 'DOSEN' | 'KARYAWAN',
        shiftId: parsedShiftId,
      });

      // Menentukan pesan sukses berdasarkan aksi pendaftaran
      const message =
        result.action === 'created'
          ? `Pengguna "${result.nama}" berhasil didaftarkan sebagai karyawan baru`
          : `Pemetaan berhasil diperbarui untuk user "${result.nama}" yang sudah terdaftar`;

      // Mencatat log audit pendaftaran user perangkat baru
      logger.audit('DEVICE_USER_REGISTERED', req.user?.id ?? 0, {
        deviceUserId,
        user_id: deviceUserId.trim(),
        action: result.action,
        patchedAttendanceCount: result.patchedAttendanceCount, // Jumlah log kehadiran lampau yang berhasil diperbaiki namanya
        ip: req.ip,
        correlationId: req.correlationId,
      });

      return successResponse(res, result, message, 201);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);

      // Membedakan pelanggaran logika bisnis (HTTP 4xx) dengan kesalahan server internal (HTTP 5xx)
      const isConflict =
        msg.includes('sudah terdaftar') ||
        msg.includes('sudah dipetakan') ||
        msg.includes('tidak ditemukan di cache');

      logger.error('Error saat mendaftarkan user perangkat sidik jari', {
        error: msg,
        userId: req.user?.id,
        body: { deviceUserId: req.body?.deviceUserId },
        correlationId: req.correlationId,
      });

      // Jika ada konflik/kesalahan logika bisnis, kembalikan status HTTP yang sesuai (400 atau 409)
      if (isConflict) {
        return errorResponse(res, msg, msg.includes('tidak ditemukan') ? 400 : 409);
      }

      return errorResponse(res, 'Gagal mendaftarkan pengguna alat', 500);
    }
  }
}

export default DeviceUsersController;
