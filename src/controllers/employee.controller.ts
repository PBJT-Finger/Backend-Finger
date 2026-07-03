// src/controllers/employee.controller.ts
// Kontroler ini hanya berfungsi sebagai lapisan presentasi (HTTP Req/Res).
// Semua logika bisnis dan akses database dipisahkan ke Service Layer (Clean Architecture).

import { Request, Response } from 'express';
import { successResponse, errorResponse } from '../utils/responseFormatter'; // Util format response JSON API
import logger from '../utils/logger'; // Logger internal aplikasi
import { EmployeeService } from '../services/employee.service';

const employeeService = new EmployeeService();

export default class EmployeeController {

  // Fungsi pembantu untuk memetakan pesan error dari layer service ke HTTP Status
  private static handleError(res: Response, error: any, defaultMessage: string) {
    const errMessage = error instanceof Error ? error.message : String(error);
    logger.error(`[EmployeeController] ${defaultMessage}`, { error: errMessage });

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
   * Mengambil daftar pegawai berpaginasi.
   * GET /api/employees
   * Parameter Query: page, limit, search, jabatan, status, is_active
   */
  public static async getEmployees(req: Request, res: Response): Promise<Response> {
    try {
      const page = parseInt(req.query.page as string) || undefined;
      const limit = parseInt(req.query.limit as string) || undefined;
      const search = (req.query.search as string) || undefined;
      const jabatan = req.query.jabatan as 'DOSEN' | 'KARYAWAN' | undefined;
      const status = req.query.status as 'AKTIF' | 'CUTI' | 'RESIGN' | 'NON_AKTIF' | undefined;
      const is_active_param = req.query.is_active as string | undefined;

      const result = await employeeService.getEmployees({
        page,
        limit,
        search,
        jabatan,
        status,
        is_active_param,
      });

      return successResponse(res, result, 'Data pegawai berhasil diambil');
    } catch (error) {
      return EmployeeController.handleError(res, error, 'Gagal mengambil data pegawai');
    }
  }

  /**
   * Memperbarui data master pegawai.
   * PUT /api/employees/:user_id
   */
  public static async updateEmployee(req: Request, res: Response): Promise<Response> {
    try {
      const { user_id } = req.params;
      const { nama, jabatan, shift_id, status } = req.body;

      if (!user_id) return errorResponse(res, 'User ID pegawai wajib diberikan', 400);

      const updatedEmployee = await employeeService.updateEmployee(user_id as string, {
        nama,
        jabatan,
        shift_id,
        status,
      });

      return successResponse(res, updatedEmployee, 'Data pegawai berhasil diperbarui');
    } catch (error) {
      return EmployeeController.handleError(res, error, 'Gagal memperbarui data pegawai');
    }
  }

  /**
   * Menghapus pegawai secara logis (Soft Delete / Penonaktifan).
   * DELETE /api/employees/:user_id
   * Mengubah is_active menjadi false dan status menjadi NON_AKTIF.
   */
  public static async deleteEmployee(req: Request, res: Response): Promise<Response> {
    try {
      const { user_id } = req.params;

      if (!user_id) return errorResponse(res, 'User ID pegawai wajib diberikan', 400);

      const deletedEmployee = await employeeService.softDeleteEmployee(user_id as string);
      return successResponse(res, deletedEmployee, 'Pegawai berhasil dinonaktifkan');
    } catch (error) {
      return EmployeeController.handleError(res, error, 'Gagal menonaktifkan pegawai');
    }
  }
}
