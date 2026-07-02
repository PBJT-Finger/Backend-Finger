// src/controllers/employee.controller.ts
// Kontroler ini bertanggung jawab untuk mengelola data master pegawai (employees) di sistem.
// Operasi yang disediakan meliputi melihat daftar pegawai berpaginasi (dengan pencarian/filter),
// memperbarui data pegawai (nama, jabatan, shift, status keaktifan),
// dan menghapus pegawai (melalui penonaktifan status secara logis).

import { Request, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { successResponse, errorResponse } from '../utils/responseFormatter'; // Util format response JSON API
import logger from '../utils/logger'; // Logger internal aplikasi

const prisma = new PrismaClient(); // Inisialisasi Prisma Client untuk query database

export default class EmployeeController {
  /**
   * Mengambil daftar pegawai berpaginasi.
   * GET /api/employees
   * Parameter Query: page, limit, search, jabatan, status, is_active
   */
  public static async getEmployees(req: Request, res: Response): Promise<Response> {
    try {
      // Parsing parameter paginasi dan filter dari query URL
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const search = (req.query.search as string) || '';
      const jabatan = req.query.jabatan as 'DOSEN' | 'KARYAWAN' | undefined;
      const status = req.query.status as 'AKTIF' | 'CUTI' | 'RESIGN' | 'NON_AKTIF' | undefined;
      const is_active_param = req.query.is_active as string | undefined;

      const skip = (page - 1) * limit; // Menghitung offset baris data yang dilewati

      const whereClause: Prisma.employeesWhereInput = {
        user_id: { notIn: ['1'] }
      }; // Objek kondisi query database

      // Jika ada kata kunci pencarian, cari kecocokan di nama pegawai ATAU user_id (NIDN/NIP)
      if (search) {
        whereClause.OR = [
          { nama: { contains: search } },
          { user_id: { contains: search } }
        ];
      }

      // Filter berdasarkan jabatan ('DOSEN' atau 'KARYAWAN')
      if (jabatan) {
        whereClause.jabatan = jabatan;
      }

      // Filter berdasarkan status kepegawaian
      if (status) {
        whereClause.status = status;
      }

      // Filter berdasarkan keaktifan pegawai
      if (is_active_param !== undefined) {
        whereClause.is_active = is_active_param === 'true';
      }

      // Melakukan query hitung total data dan penarikan data pegawai secara paralel
      const [total, data] = await Promise.all([
        prisma.employees.count({ where: whereClause }),
        prisma.employees.findMany({
          where: whereClause,
          skip,
          take: limit,
          orderBy: { updated_at: 'desc' }, // Mengurutkan dari yang terakhir diubah
          include: {
            shifts: true // Menyertakan relasi data shift kerja pegawai
          }
        })
      ]);

      const totalPages = Math.ceil(total / limit); // Menghitung total halaman paginasi

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
      logger.error('Error saat mengambil daftar pegawai', { error: msg });
      return errorResponse(res, 'Gagal mengambil data pegawai', 500);
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

      if (!user_id) {
        return errorResponse(res, 'User ID pegawai wajib diberikan', 400);
      }

      // Pastikan pegawai dengan ID tersebut ada di database
      const employee = await prisma.employees.findUnique({
        where: { user_id }
      });

      if (!employee) {
        return errorResponse(res, 'Pegawai tidak ditemukan', 404);
      }

      const updateData: Prisma.employeesUpdateInput = {
        updated_at: new Date() // Tandai waktu pembaharuan saat ini
      };

      // Perbarui nama jika dikirimkan oleh client
      if (nama !== undefined) updateData.nama = nama;

      // Perbarui jabatan jika dikirimkan oleh client
      if (jabatan !== undefined) updateData.jabatan = jabatan as 'DOSEN' | 'KARYAWAN';

      // Menghubungkan atau memutus relasi shift kerja pegawai
      if (shift_id !== undefined) {
        if (shift_id === null) {
          updateData.shifts = { disconnect: true }; // Putus hubungan shift
        } else {
          updateData.shifts = { connect: { id: Number(shift_id) } }; // Hubungkan ke ID shift baru
        }
      }

      // Memperbarui status kepegawaian. Jika tidak aktif ('AKTIF'), maka is_active otomatis menjadi false
      if (status !== undefined) {
        updateData.status = status as 'AKTIF' | 'CUTI' | 'RESIGN' | 'NON_AKTIF';
        if (status !== 'AKTIF') {
          updateData.is_active = false;
        } else {
          updateData.is_active = true;
        }
      }

      // Eksekusi pembaruan data ke database
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
      logger.error('Error saat memperbarui pegawai', { error: msg, user_id: req.params.user_id });
      return errorResponse(res, 'Gagal memperbarui data pegawai', 500);
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

      if (!user_id) {
        return errorResponse(res, 'User ID pegawai wajib diberikan', 400);
      }

      // Pastikan pegawai yang akan dihapus terdaftar
      const employee = await prisma.employees.findUnique({
        where: { user_id }
      });

      if (!employee) {
        return errorResponse(res, 'Pegawai tidak ditemukan', 404);
      }

      // Update status keaktifan menjadi non-aktif
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
      logger.error('Error saat menonaktifkan pegawai', { error: msg, user_id: req.params.user_id });
      return errorResponse(res, 'Gagal menonaktifkan pegawai', 500);
    }
  }
}
