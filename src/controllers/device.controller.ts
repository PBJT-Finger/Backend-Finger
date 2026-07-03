// src/controllers/device.controller.ts
// Kontroler ini hanya berfungsi sebagai lapisan presentasi (HTTP Req/Res).
// Semua logika bisnis dan akses database dipisahkan ke Service Layer (Clean Architecture).

import { Request, Response } from 'express';
import { successResponse, errorResponse } from '../utils/responseFormatter'; // Util pembantu pembentuk format standard JSON API
import logger from '../utils/logger'; // Logger aplikasi
import { ZkDeviceClient } from '../infrastructure/zk-client'; // Klien Daemon ZKTeco untuk sinkronisasi data
import { DeviceService } from '../services/device.service';

const deviceService = new DeviceService();

export class DeviceController {
  
  // Fungsi pembantu untuk memetakan pesan error dari layer service ke HTTP Status
  private static handleError(res: Response, error: any, defaultMessage: string) {
    const errMessage = error instanceof Error ? error.message : String(error);
    logger.error(`[DeviceController] ${defaultMessage}`, { error: errMessage });

    if (errMessage.startsWith('BAD_REQUEST:')) {
      return errorResponse(res, errMessage.replace('BAD_REQUEST: ', ''), 400);
    }
    if (errMessage.startsWith('NOT_FOUND:')) {
      return errorResponse(res, errMessage.replace('NOT_FOUND: ', ''), 404);
    }
    if (errMessage.startsWith('CONFLICT:')) {
      return errorResponse(res, errMessage.replace('CONFLICT: ', ''), 409);
    }
    return errorResponse(res, defaultMessage, 500);
  }

  /**
   * Mengambil daftar seluruh perangkat sidik jari yang aktif.
   * GET /api/devices
   */
  public static async getDevices(req: Request, res: Response): Promise<Response> {
    try {
      const devices = await deviceService.getActiveDevices();
      return successResponse(res, devices, 'Berhasil mengambil daftar perangkat');
    } catch (error) {
      return DeviceController.handleError(res, error, 'Gagal mengambil daftar perangkat');
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

      const device = await deviceService.getDeviceById(Number(id));
      return successResponse(res, device, 'Berhasil mengambil data detail perangkat');
    } catch (error) {
      return DeviceController.handleError(res, error, 'Gagal mengambil data perangkat');
    }
  }

  /**
   * Menambahkan perangkat sidik jari baru ke dalam sistem.
   * POST /api/devices
   */
  public static async createDevice(req: Request, res: Response): Promise<Response> {
    try {
      const result = await deviceService.createDevice(req.body);
      return successResponse(res, result, 'Perangkat berhasil ditambahkan', 201);
    } catch (error) {
      return DeviceController.handleError(res, error, 'Gagal membuat perangkat baru');
    }
  }

  /**
   * Mengupdate informasi data perangkat sidik jari.
   * PUT /api/devices/:id
   */
  public static async updateDevice(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      if (!id) return errorResponse(res, 'ID Perangkat wajib diisi', 400);

      const result = await deviceService.updateDevice(Number(id), req.body);
      return successResponse(res, result, 'Data perangkat berhasil diperbarui');
    } catch (error) {
      return DeviceController.handleError(res, error, 'Gagal memperbarui data perangkat');
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

      await deviceService.deleteDevice(Number(id));
      return successResponse(res, null, 'Perangkat berhasil dinonaktifkan (dihapus)');
    } catch (error) {
      return DeviceController.handleError(res, error, 'Gagal menonaktifkan perangkat');
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

      // Pastikan perangkat valid via service (akan throw error 404 jika tidak valid)
      await deviceService.getDeviceById(Number(id));

      // Memanggil instance ZkDeviceClient dan memulai sinkronisasi
      // Catatan: Infrastruktur (ZKClient) secara bertahap bisa digeser ke DeviceService juga ke depannya.
      const zkClient = ZkDeviceClient.getInstance();
      await zkClient.start();

      return successResponse(
        res,
        { status: zkClient.getStatus() },
        'Proses sinkronisasi perangkat berhasil dipicu'
      );
    } catch (error) {
      return DeviceController.handleError(res, error, 'Gagal memicu sinkronisasi perangkat');
    }
  }
}
export default DeviceController;
