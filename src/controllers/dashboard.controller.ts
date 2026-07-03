// src/controllers/dashboard.controller.ts
// Kontroler ini hanya berfungsi sebagai lapisan presentasi (HTTP Req/Res).
// Logika statistik dan pengambilan data telah dipindah ke DashboardService.

import { Request, Response } from 'express';
import { successResponse, errorResponse } from '../utils/responseFormatter';
import logger from '../utils/logger';
import { DashboardService } from '../services/dashboard.service';

const dashboardService = new DashboardService();

export class DashboardController {
  
  /**
   * Mengambil statistik ringkasan dashboard (kehadiran hari ini, total pegawai, persentase kehadiran, dll).
   * GET /api/dashboard/summary
   */
  public static async getSummary(req: Request, res: Response): Promise<Response> {
    try {
      const summary = await dashboardService.getDashboardSummary();
      return successResponse(res, summary, 'Berhasil mengambil statistik dashboard');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error('Error saat mengambil summary dashboard', { error: msg });
      return errorResponse(res, 'Gagal mengambil data dashboard', 500);
    }
  }
}
export default DashboardController;
