/**
 * src/services/device.users.service.ts
 *
 * Menghubungkan cache user dari ZkDeviceClient dengan tabel registrasi database pegawai.
 *
 * Tanggung Jawab:
 *   1. Membaca cache user mesin dari singleton ZkDeviceClient (tanpa membuat koneksi ZK baru)
 *   2. Membandingkan silang (cross-reference) data user mesin dengan tabel employees (pegawai) di DB
 *   3. Mendaftarkan user mesin baru ke dalam database sebagai pegawai (create/update employee)
 *   4. Memperbaiki (patching) data log absensi lama yang belum terisi nama dan jabatan setelah proses registrasi sukses
 *
 * Desain Keputusan — Menggunakan Cache dibanding Live Connection langsung:
 *   ZkDeviceClient mengelola cache user (deviceUserCache) yang diperbarui setiap siklus polling (~5 detik).
 *   Membuat koneksi TCP ZKTeco baru akan merusak status TCP loop polling yang sedang berjalan.
 *   Keterlambatan pembaruan cache ~5 detik dapat diterima untuk alur kerja pendaftaran admin.
 *
 * Konsekuensi: Jika perangkat offline dan cache kosong, penarikan data akan mengembalikan daftar kosong
 * dengan pesan kesalahan yang jelas, alih-alih mencoba membuat koneksi TCP baru yang lambat/gagal.
 */

import { v4 as uuidv4 } from 'uuid'; // Pembuat string UUID acak untuk pelacakan transaksi audit
import prisma from '../config/prisma'; // Prisma client untuk manipulasi data DB
import { ZkDeviceClient } from '../infrastructure/zk-client'; // Client koneksi mesin ZKTeco
import logger from '../utils/logger'; // Logger aplikasi

// ─── Tipe Data ────────────────────────────────────────────────────────────────

/** Status registrasi user mesin sidik jari terhadap database sistem. */
export type RegistrationStatus = 'registered' | 'unregistered' | 'partial';

/**
 * Representasi user mesin sidik jari yang diperkaya dengan status registrasi DB.
 * - `registered`:   pegawai aktif — beroperasi penuh secara normal
 * - `partial`:      pegawai terdaftar tetapi berstatus non-aktif di DB
 * - `unregistered`: pegawai belum terdaftar sama sekali — hanya tampil nomor ID saja di web
 */
export interface DeviceUserWithStatus {
  /** Nomor seri internal dari memori mesin ZKTeco */
  uid: number;
  /** User ID mesin yang dipetakan sebagai user_id tabel employees */
  userId: string;
  /** Nama yang tersimpan langsung di dalam memori mesin fisik */
  name: string;
  /** Role mesin ZK: 0 = user biasa, 14 = administrator mesin */
  role: number;
  /** Nomor kartu RFID/Akses (0 jika tidak ada) */
  cardno: number;
  registrationStatus: RegistrationStatus;
  /** Nama pegawai dari tabel employees; bernilai null jika belum terdaftar */
  employeeNama: string | null;
  /** Jabatan pegawai dari tabel employees; bernilai null jika belum terdaftar */
  employeeJabatan: string | null;
  /** ID Shift jam kerja pegawai; bernilai null jika belum terdaftar */
  employeeShiftId: number | null;
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
  /** ID user mesin ZKTeco (contoh: "12") */
  deviceUserId: string;
  /** Nama pegawai untuk didaftarkan ke tabel employees */
  nama: string;
  /** Jabatan enum (DOSEN atau KARYAWAN) */
  jabatan: 'DOSEN' | 'KARYAWAN';
  /** ID Shift jam kerja yang dipilih */
  shiftId?: number | null;
}

export interface RegisterResult {
  user_id: string;
  nama: string;
  jabatan: string;
  deviceUserId: string;
  /** "created" = baru didaftarkan; "mapping_added" = pegawai sudah ada sebelumnya */
  action: 'created' | 'mapping_added';
  /** Jumlah log absensi lama yang diperbaiki nama & jabatannya */
  patchedAttendanceCount: number;
}

// ─── DeviceUsersService ───────────────────────────────────────────────────────

export class DeviceUsersService {
  private readonly zkClient: ZkDeviceClient;

  constructor() {
    // Menggunakan singleton ZkDeviceClient yang sudah aktif — JANGAN buat koneksi baru
    this.zkClient = ZkDeviceClient.getInstance();
  }

  /**
   * Mengambil semua user dari cache ZkDeviceClient lengkap dengan status registrasi database mereka.
   *
   * Menggunakan query batch tunggal untuk mencegah masalah N+1 queries.
   */
  public async getDeviceUsersWithStatus(): Promise<DeviceUserPullResult> {
    const deviceStatus = this.zkClient.getStatus(); // Cek status koneksi mesin (online/offline)
    const cachedUsers = this.zkClient.getCachedUsers(); // Ambil cache user mesin

    if (cachedUsers.length === 0) {
      logger.warn('[DeviceUsersService] Cache kosong — mesin offline atau belum selesai polling', {
        deviceStatus,
      });
      return {
        deviceStatus,
        totalOnDevice: 0,
        summary: { registered: 0, unregistered: 0, partial: 0 },
        users: [],
      };
    }

    // Ambil daftar semua user ID dari mesin
    const deviceUserIds = cachedUsers.map((u) => u.userId);
    // Cari data pegawai di DB yang NIP/NIDN nya ada di daftar user ID mesin tadi
    const employees =
      deviceUserIds.length > 0
        ? await prisma.employees.findMany({
          where: { user_id: { in: deviceUserIds } },
          select: { user_id: true, nama: true, jabatan: true, shift_id: true, is_active: true },
        })
        : [];

    // Buat map pencarian cepat (lookup map): user_id → employee
    const employeeByUserId = new Map(employees.map((e) => [e.user_id, e]));

    // Gabungkan data cache mesin dengan status database
    const users: DeviceUserWithStatus[] = cachedUsers
      .map((u) => {
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
          employeeShiftId: employee?.shift_id ?? null,
        };
      });

    // Hitung total ringkasan per status registrasi
    const summary = users.reduce(
      (acc, u) => {
        acc[u.registrationStatus]++;
        return acc;
      },
      { registered: 0, unregistered: 0, partial: 0 }
    );

    logger.info('[DeviceUsersService] Penarikan data user mesin selesai', {
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
   * Mendaftarkan user mesin sidik jari ke dalam tabel pegawai database.
   *
   * @throws Error jika ID user mesin tidak ditemukan di cache ZKTeco
   */
  public async registerDeviceUser(dto: RegisterDeviceUserDto): Promise<RegisterResult> {
    const { deviceUserId, nama, jabatan, shiftId } = dto;

    // 1. Periksa apakah pegawai dengan user_id ini sudah ada di database
    const existingEmployee = await prisma.employees.findUnique({
      where: { user_id: deviceUserId },
    });

    // 2. Jika pegawai belum ada di DB, barulah pastikan user mesin yang didaftarkan ada dalam cache
    if (!existingEmployee) {
      const cachedUsers = this.zkClient.getCachedUsers();
      const deviceUser = cachedUsers.find((u) => u.userId === deviceUserId);
      if (!deviceUser) {
        throw new Error(
          `User ID mesin "${deviceUserId}" tidak ditemukan di cache. ` +
          'Pastikan mesin terhubung dan coba tarik data user terlebih dahulu.'
        );
      }
    }

    const batchId = uuidv4();
    let action: 'created' | 'mapping_added';

    // Bungkus pembuatan/pembaruan pegawai dalam Prisma transaction
    await prisma.$transaction(async (tx) => {
      if (!existingEmployee) {
        // Buat pegawai baru
        await tx.employees.create({
          data: {
            user_id: deviceUserId,
            nama,
            jabatan,
            shift_id: shiftId ?? null,
            is_active: true,
            tanggal_masuk: new Date(),
          },
        });
        action = 'created';
        logger.info('[DeviceUsersService] Pegawai baru berhasil dibuat', {
          user_id: deviceUserId,
          nama,
          jabatan,
          batchId,
        });
      } else {
        // Pegawai sudah terdaftar sebelumnya — lakukan update profile
        await tx.employees.update({
          where: { user_id: deviceUserId },
          data: {
            nama,
            jabatan,
            shift_id: shiftId ?? null,
            is_active: true,
          },
        });
        action = 'mapping_added';
        logger.info('[DeviceUsersService] Pemetaan pegawai berhasil diperbarui', {
          user_id: deviceUserId,
          existingNama: existingEmployee.nama,
          batchId,
        });
      }
    });

    // 3. Perbaiki log absensi lama pegawai yang sebelumnya belum teridentifikasi (nama & jabatan kosong)
    const patchedAttendanceCount = await this.patchOrphanAttendanceRecords(
      deviceUserId,
      nama,
      jabatan
    );

    // Catat log audit transaksi registrasi user mesin
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
   * Memperbaiki catatan log absensi 'yatim' (orphaned) yang masuk sebelum data pegawai didaftarkan ke sistem.
   */
  private async patchOrphanAttendanceRecords(
    deviceUserId: string,
    nama: string,
    jabatan: 'DOSEN' | 'KARYAWAN'
  ): Promise<number> {
    try {
      // Cari log absensi yang memiliki user_id sama tetapi nama/jabatan masih belum diisi lengkap
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
        logger.info('[DeviceUsersService] Log absensi yatim berhasil diperbaiki', {
          deviceUserId,
          patchedCount: result.count,
        });
      }

      return result.count;
    } catch (err) {
      // Non-fatal error — catat log dan abaikan agar alur registrasi pegawai tidak ikutan gagal
      logger.error('[DeviceUsersService] Gagal memperbaiki log absensi yatim', {
        deviceUserId,
        error: err instanceof Error ? err.message : String(err),
      });
      return 0;
    }
  }
}
