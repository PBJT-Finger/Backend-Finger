import { Request, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { successResponse, errorResponse } from '../utils/responseFormatter';
import logger from '../utils/logger';

const prisma = new PrismaClient();

export default class EmployeeController {
  /**
   * GET /api/employees
   * Retrieves a paginated list of employees.
   * Query params: page, limit, search, jabatan, status, is_active
   */
  public static async getEmployees(req: Request, res: Response): Promise<Response> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const search = (req.query.search as string) || '';
      const jabatan = req.query.jabatan as 'DOSEN' | 'KARYAWAN' | undefined;
      const status = req.query.status as 'AKTIF' | 'CUTI' | 'RESIGN' | 'NON_AKTIF' | undefined;
      const is_active_param = req.query.is_active as string | undefined;
      
      const skip = (page - 1) * limit;

      const whereClause: Prisma.employeesWhereInput = {};

      if (search) {
        whereClause.OR = [
          { nama: { contains: search } },
          { user_id: { contains: search } }
        ];
      }

      if (jabatan) {
        whereClause.jabatan = jabatan;
      }

      if (status) {
        whereClause.status = status;
      }

      if (is_active_param !== undefined) {
        whereClause.is_active = is_active_param === 'true';
      }

      const [total, data] = await Promise.all([
        prisma.employees.count({ where: whereClause }),
        prisma.employees.findMany({
          where: whereClause,
          skip,
          take: limit,
          orderBy: { updated_at: 'desc' },
          include: {
            shifts: true
          }
        })
      ]);

      const totalPages = Math.ceil(total / limit);

      return successResponse(
        res,
        {
          data,
          pagination: {
            total,
            page,
            limit,
            totalPages,
          },
        },
        'Data pegawai berhasil diambil'
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error('Error in getEmployees', { error: msg });
      return errorResponse(res, 'Gagal mengambil data pegawai', 500);
    }
  }

  /**
   * PUT /api/employees/:user_id
   * Updates an employee's master data.
   */
  public static async updateEmployee(req: Request, res: Response): Promise<Response> {
    try {
      const { user_id } = req.params;
      const { nama, jabatan, shift_id, status } = req.body;

      if (!user_id) {
        return errorResponse(res, 'User ID pegawai wajib diberikan', 400);
      }

      // Ensure employee exists
      const employee = await prisma.employees.findUnique({
        where: { user_id }
      });

      if (!employee) {
        return errorResponse(res, 'Pegawai tidak ditemukan', 404);
      }

      const updateData: Prisma.employeesUpdateInput = {
        updated_at: new Date()
      };

      if (nama !== undefined) updateData.nama = nama;
      if (jabatan !== undefined) updateData.jabatan = jabatan as 'DOSEN' | 'KARYAWAN';
      if (shift_id !== undefined) {
        if (shift_id === null) {
          updateData.shifts = { disconnect: true };
        } else {
          updateData.shifts = { connect: { id: Number(shift_id) } };
        }
      }
      if (status !== undefined) {
        updateData.status = status as 'AKTIF' | 'CUTI' | 'RESIGN' | 'NON_AKTIF';
        if (status !== 'AKTIF') {
          updateData.is_active = false;
        } else {
          updateData.is_active = true;
        }
      }

      const updatedEmployee = await prisma.employees.update({
        where: { user_id },
        data: updateData,
        include: {
          shifts: true
        }
      });

      return successResponse(res, updatedEmployee, 'Data pegawai berhasil diperbarui');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error('Error in updateEmployee', { error: msg, user_id: req.params.user_id });
      return errorResponse(res, 'Gagal memperbarui data pegawai', 500);
    }
  }

  /**
   * DELETE /api/employees/:user_id
   * Soft deletes an employee (sets is_active to false and status to NON_AKTIF).
   */
  public static async deleteEmployee(req: Request, res: Response): Promise<Response> {
    try {
      const { user_id } = req.params;

      if (!user_id) {
        return errorResponse(res, 'User ID pegawai wajib diberikan', 400);
      }

      const employee = await prisma.employees.findUnique({
        where: { user_id }
      });

      if (!employee) {
        return errorResponse(res, 'Pegawai tidak ditemukan', 404);
      }

      const deletedEmployee = await prisma.employees.update({
        where: { user_id },
        data: {
          is_active: false,
          status: 'NON_AKTIF',
          updated_at: new Date()
        }
      });

      return successResponse(res, deletedEmployee, 'Pegawai berhasil dinonaktifkan');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error('Error in deleteEmployee', { error: msg, user_id: req.params.user_id });
      return errorResponse(res, 'Gagal menonaktifkan pegawai', 500);
    }
  }
}
