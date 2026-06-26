// src/controllers/device.controller.ts
// Kontroler ini digunakan untuk mengelola data perangkat sidik jari (fingerprint devices) di dalam database,
// seperti melihat daftar perangkat, membuat baru, mengupdate data, menghapus perangkat (soft delete),
// serta memicu sinkronisasi manual per perangkat.

import { Request, Response } from 'express';
import prisma from '../config/prisma'; // Instance Prisma Client untuk akses ke database
import { successResponse, errorResponse } from '../utils/responseFormatter'; // Util pembantu pembentuk format standard JSON API
import logger from '../utils/logger'; // Logger aplikasi
import bcrypt from 'bcrypt'; // Library pengaman hash untuk API Key perangkat jika ada
import { ZkDeviceClient } from '../infrastructure/zk-client'; // Klien Daemon ZKTeco untuk sinkronisasi data

export class DeviceController {
  /**
   * Mengambil daftar seluruh perangkat sidik jari yang aktif.
   * GET /api/devices
   */
  public static async getDevices(req: Request, res: Response): Promise<Response> {
    try {
      // Query daftar perangkat dari database yang kolom is_active bernilai true
      const devices = await prisma.devices.findMany({
        where: { is_active: true },
        select: {
          id: true,
          device_name: true,
          device_id: true,
          location: true,
          is_active: true,
          created_at: true,
        },
        orderBy: {
          created_at: 'desc', // Urutkan dari perangkat yang baru ditambahkan
        },
      });

      return successResponse(res, devices, 'Berhasil mengambil daftar perangkat');
    } catch (error) {
      logger.error('Error saat mengambil daftar perangkat', {
        error: error instanceof Error ? error.message : String(error),
      });
      return errorResponse(res, 'Gagal mengambil daftar perangkat', 500);
    }
  }

  /**
   * Mengambil detail satu perangkat berdasarkan ID database-nya.
   * GET /api/devices/:id
   */
  public static async getDeviceById(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      if (!id) return errorResponse(res, 'ID Perangkat wajib diisi', 400);

      // Cari satu perangkat berdasarkan Primary Key
      const device = await prisma.devices.findUnique({
        where: { id: Number(id) },
        select: {
          id: true,
          device_name: true,
          device_id: true,
          ip_address: true,
          location: true,
          is_active: true,
          created_at: true,
        },
      });

      // Kembalikan error 404 jika perangkat tidak ditemukan atau sudah tidak aktif
      if (!device || !device.is_active) {
        return errorResponse(res, 'Perangkat tidak ditemukan', 404);
      }

      return successResponse(res, device, 'Berhasil mengambil data detail perangkat');
    } catch (error) {
      logger.error('Error saat mengambil detail perangkat', {
        error: error instanceof Error ? error.message : String(error),
      });
      return errorResponse(res, 'Gagal mengambil data perangkat', 500);
    }
  }

  /**
   * Menambahkan perangkat sidik jari baru ke dalam sistem.
   * POST /api/devices
   */
  public static async createDevice(req: Request, res: Response): Promise<Response> {
    try {
      const { device_name, device_id, ip_address, location, api_key } = req.body;

      // Validasi input wajib
      if (!device_name || !device_id) {
        return errorResponse(res, 'Nama Perangkat dan ID Perangkat wajib diisi', 400);
      }

      // Pastikan kode unik device_id belum pernah dipakai oleh perangkat lain
      const existing = await prisma.devices.findUnique({ where: { device_id } });
      if (existing) {
        return errorResponse(res, 'ID Perangkat sudah digunakan oleh mesin lain', 409);
      }

      // Melakukan hashing api_key jika disediakan untuk autentikasi mesin ke server
      let api_key_hash = null;
      if (api_key) {
        api_key_hash = await bcrypt.hash(api_key, 10);
      }

      // Simpan data perangkat baru ke database
      const device = await prisma.devices.create({
        data: {
          device_name,
          device_id,
          ip_address,
          location,
          api_key_hash,
          is_active: true,
        },
      });

      return successResponse(
        res,
        { id: device.id, device_name: device.device_name },
        'Perangkat berhasil ditambahkan',
        201
      );
    } catch (error) {
      logger.error('Error saat membuat perangkat baru', {
        error: error instanceof Error ? error.message : String(error),
      });
      return errorResponse(res, 'Gagal membuat perangkat baru', 500);
    }
  }

  /**
   * Mengupdate informasi data perangkat sidik jari.
   * PUT /api/devices/:id
   */
  public static async updateDevice(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const { device_name, ip_address, location, is_active } = req.body;

      if (!id) return errorResponse(res, 'ID Perangkat wajib diisi', 400);

      // Cari apakah perangkat tersebut ada di database
      const device = await prisma.devices.findUnique({ where: { id: Number(id) } });
      if (!device) return errorResponse(res, 'Perangkat tidak ditemukan', 404);

      // Eksekusi pembaruan kolom data
      const updated = await prisma.devices.update({
        where: { id: Number(id) },
        data: {
          device_name: device_name !== undefined ? device_name : device.device_name,
          ip_address: ip_address !== undefined ? ip_address : device.ip_address,
          location: location !== undefined ? location : device.location,
          is_active: is_active !== undefined ? is_active : device.is_active,
        },
      });

      return successResponse(
        res,
        { id: updated.id, device_name: updated.device_name },
        'Data perangkat berhasil diperbarui'
      );
    } catch (error) {
      logger.error('Error saat memperbarui data perangkat', {
        error: error instanceof Error ? error.message : String(error),
      });
      return errorResponse(res, 'Gagal memperbarui data perangkat', 500);
    }
  }

  /**
   * Menghapus perangkat secara logis (Soft Delete, menonaktifkan is_active = false).
   * DELETE /api/devices/:id
   */
  public static async deleteDevice(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      if (!id) return errorResponse(res, 'ID Perangkat wajib diisi', 400);

      const device = await prisma.devices.findUnique({ where: { id: Number(id) } });
      if (!device) return errorResponse(res, 'Perangkat tidak ditemukan', 404);

      // Set status aktif menjadi false
      await prisma.devices.update({
        where: { id: Number(id) },
        data: { is_active: false },
      });

      return successResponse(res, null, 'Perangkat berhasil dinonaktifkan (dihapus)');
    } catch (error) {
      logger.error('Error saat menonaktifkan perangkat', {
        error: error instanceof Error ? error.message : String(error),
      });
      return errorResponse(res, 'Gagal menonaktifkan perangkat', 500);
    }
  }

  /**
   * Memicu koneksi dan sinkronisasi manual untuk satu perangkat tertentu.
   * POST /api/devices/:id/sync
   */
  public static async syncDevice(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      if (!id) return errorResponse(res, 'ID Perangkat wajib diisi', 400);

      const device = await prisma.devices.findUnique({ where: { id: Number(id) } });
      if (!device || !device.is_active) {
        return errorResponse(res, 'Perangkat tidak ditemukan atau dalam status tidak aktif', 404);
      }

      // Memanggil instance ZkDeviceClient dan memulai sinkronisasi
      const zkClient = ZkDeviceClient.getInstance();
      await zkClient.start();

      return successResponse(
        res,
        { status: zkClient.getStatus() },
        'Proses sinkronisasi perangkat berhasil dipicu'
      );
    } catch (error) {
      logger.error('Error saat memicu sinkronisasi perangkat', {
        error: error instanceof Error ? error.message : String(error),
      });
      return errorResponse(res, 'Gagal memicu sinkronisasi perangkat', 500);
    }
  }
}
export default DeviceController;
