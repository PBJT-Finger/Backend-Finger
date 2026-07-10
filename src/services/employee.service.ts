// src/services/employee.service.ts
import { EmployeeRepository } from '../repositories/employee.repository';
import { Prisma } from '@prisma/client';

export class EmployeeService {
  private employeeRepository: EmployeeRepository;

  constructor() {
    this.employeeRepository = new EmployeeRepository();
  }

  /**
   * Mendapatkan daftar pegawai dengan paginasi dan filter
   */
  public async getEmployees(params: {
    page?: number | undefined;
    limit?: number | undefined;
    search?: string | undefined;
    jabatan?: 'DOSEN' | 'KARYAWAN' | undefined;
    status?: 'AKTIF' | 'CUTI' | 'RESIGN' | 'NON_AKTIF' | undefined;
    is_active_param?: string | undefined;
  }) {
    const page = params.page || 1;
    const limit = params.limit || 50;
    const skip = (page - 1) * limit;

    const whereClause: Prisma.employeesWhereInput = {
      user_id: { notIn: ['1'] }, // Kecualikan user ID khusus administrator/mesin
    };

    if (params.search) {
      whereClause.OR = [
        { nama: { contains: params.search } },
        { user_id: { contains: params.search } },
      ];
    }

    if (params.jabatan) {
      whereClause.jabatan = params.jabatan;
    }

    if (params.status) {
      whereClause.status = params.status;
    }

    if (params.is_active_param !== undefined) {
      whereClause.is_active = params.is_active_param === 'true';
    }

    const [total, data] = await this.employeeRepository.findAll({ skip, take: limit, whereClause });
    const totalPages = Math.ceil(total / limit);

    return {
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }

  /**
   * Memperbarui data pegawai
   */
  public async updateEmployee(
    user_id: string,
    data: {
      nama?: string;
      jabatan?: 'DOSEN' | 'KARYAWAN';
      shift_id?: number | null;
      status?: 'AKTIF' | 'CUTI' | 'RESIGN' | 'NON_AKTIF';
    }
  ) {
    if (!user_id) throw new Error('BAD_REQUEST: User ID pegawai wajib diberikan');

    const employee = await this.employeeRepository.findByUserId(user_id);
    if (!employee) throw new Error('NOT_FOUND: Pegawai tidak ditemukan');

    const updateData: Prisma.employeesUpdateInput = {
      updated_at: new Date(),
    };

    if (data.nama !== undefined) updateData.nama = data.nama;
    if (data.jabatan !== undefined) updateData.jabatan = data.jabatan;

    if (data.shift_id !== undefined) {
      if (data.shift_id === null) {
        if (employee.shift_id !== null) {
          updateData.shifts = { disconnect: true };
        }
      } else {
        updateData.shifts = { connect: { id: Number(data.shift_id) } };
      }
    }

    if (data.status !== undefined) {
      updateData.status = data.status;
      updateData.is_active = data.status === 'AKTIF';
    }

    return await this.employeeRepository.update(user_id, updateData);
  }

  /**
   * Menonaktifkan pegawai secara logis (Soft Delete)
   */
  public async softDeleteEmployee(user_id: string) {
    if (!user_id) throw new Error('BAD_REQUEST: User ID pegawai wajib diberikan');

    const employee = await this.employeeRepository.findByUserId(user_id);
    if (!employee) throw new Error('NOT_FOUND: Pegawai tidak ditemukan');

    return await this.employeeRepository.update(user_id, {
      is_active: false,
      status: 'NON_AKTIF',
      updated_at: new Date(),
    });
  }
}
