// src/controllers/device.stream.controller.ts
// Kontroler ini menangani streaming data absensi secara real-time dari server ke klien/frontend
// menggunakan protokol Server-Sent Events (SSE). 
// Data yang dikirim mencakup status mesin sidik jari, riwayat log absensi terbaru dari database (history),
// serta data yang langsung di-scan dari perangkat sidik jari secara real-time (live).

import { Request, Response } from 'express';
import {
  ZkDeviceClient,
  type DeviceStatus,
  type AttendanceRecord,
} from '../infrastructure/zk-client'; // Klien Daemon koneksi ke mesin sidik jari
import prisma from '../config/prisma'; // Prisma client untuk query data riwayat

/** Struktur data absensi yang dikirimkan ke frontend */
export interface SseAttendanceRecord {
  userSn: number; // Serial number atau ID unik log absensi
  user_id: string; // ID karyawan/dosen
  nama: string;
  jabatan: string;
  status: string; // Status check-in (HADIR/TERLAMBAT)
  statusKeluar: string; // Status check-out (HADIR/PULANG_CEPAT)
  jamMasuk: string | null;
  jamKeluar: string | null;
  recordTime: string; // Waktu absensi dalam format string ISO
  ip: string; // Alamat IP perangkat asal
  source: 'history' | 'live'; // Sumber data: dari database (history) atau dari mesin langsung (live)
  is_active: boolean; // Status keaktifan pegawai
}

// Timeout 5 detik untuk query riwayat agar koneksi SSE tidak menggantung jika database lambat
const HISTORY_FETCH_TIMEOUT_MS = 5_000;

/** 
 * Menulis data secara aman ke stream SSE.
 * Mengabaikan error secara diam-diam jika koneksi klien telah terputus.
 */
function sseWrite(res: Response, event: string, data: unknown): void {
  try {
    if (!res.writableEnded) {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      // Flush data ke jaringan agar langsung sampai ke browser (terutama saat menggunakan gzip/compression)
      if (typeof (res as any).flush === 'function') {
        (res as any).flush();
      }
    }
  } catch {
    // Abaikan jika koneksi sudah ditutup oleh browser secara sepihak
  }
}

/**
 * Endpoint SSE utama untuk streaming event perangkat sidik jari dan log kehadiran.
 * GET /api/attendance/stream
 */
export const streamDeviceEvents = async (req: Request, res: Response): Promise<void> => {
  // Set header agar browser mengenali koneksi ini sebagai Server-Sent Events (SSE)
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders(); // Kirim header segera ke klien

  const client = ZkDeviceClient.getInstance();

  // 1. Kirim status konektivitas mesin sidik jari saat ini secara langsung (online/offline)
  sseWrite(res, 'status', { status: client.getStatus() });

  // 2. Kirim sinyal inisialisasi awal segera agar frontend bisa menghilangkan indikator loading
  sseWrite(res, 'init', { records: [] });

  // 3. Batasi waktu proses pengambilan riwayat agar tidak menghambat streaming live
  const historyTimeout = setTimeout(() => {
    console.warn('[SSE] Pengambilan riwayat DB timeout — mengirimkan data kosong');
    sseWrite(res, 'history', { records: [] });
  }, HISTORY_FETCH_TIMEOUT_MS);

  // Mengambil 500 log absensi terbaru dan daftar status keaktifan karyawan secara paralel
  Promise.all([
    prisma.attendance.findMany({
      where: { is_deleted: false },
      orderBy: { created_at: 'desc' },
      take: 500,
      select: {
        id: true,
        user_id: true,
        nama: true,
        jabatan: true,
        status: true,
        status_keluar: true,
        jam_masuk: true,
        jam_keluar: true,
        tanggal: true,
        created_at: true,
        device_id: true,
      },
    }),
    prisma.employees.findMany({
      select: { user_id: true, is_active: true }
    })
  ])
    .then(([recentLogs, employees]) => {
      clearTimeout(historyTimeout); // Batalkan timer pengaman timeout karena query selesai tepat waktu
      const empMap = new Map(employees.map((e) => [e.user_id, e]));

      // Memetakan log absensi database ke format objek SSE yang seragam
      const history: SseAttendanceRecord[] = recentLogs.map((row) => {
        // Fungsi pembantu untuk menggabungkan field tanggal dan jam secara presisi dalam format UTC
        const combineDateTime = (tanggal: Date, timePart: Date | null): string => {
          if (!timePart) return tanggal.toISOString();
          const combined = new Date(
            Date.UTC(
              tanggal.getUTCFullYear(),
              tanggal.getUTCMonth(),
              tanggal.getUTCDate(),
              timePart.getUTCHours(),
              timePart.getUTCMinutes(),
              timePart.getUTCSeconds()
            )
          );
          return combined.toISOString();
        };

        const recordTimeStr = combineDateTime(
          row.tanggal,
          row.jam_keluar || row.jam_masuk || row.created_at
        );

        const emp = empMap.get(row.user_id);
        const isActive = emp?.is_active ?? false;

        return {
          userSn: row.id,
          user_id: row.user_id,
          nama: row.nama,
          jabatan: row.jabatan,
          status: row.status ?? 'HADIR',
          statusKeluar: row.status_keluar ?? 'HADIR',
          jamMasuk: row.jam_masuk ? combineDateTime(row.tanggal, row.jam_masuk) : null,
          jamKeluar: row.jam_keluar ? combineDateTime(row.tanggal, row.jam_keluar) : null,
          recordTime: recordTimeStr,
          ip: row.device_id ?? 'DB',
          source: 'history',
          is_active: isActive,
        };
      });
      // Kirim riwayat absensi ke frontend
      sseWrite(res, 'history', { records: history });
    })
    .catch((err) => {
      clearTimeout(historyTimeout);
      console.error('[SSE] Gagal mengambil riwayat dari DB:', err);
      sseWrite(res, 'history', { records: [] });
    });

  // 4. Mendaftarkan listener untuk memproses event perangkat secara real-time (live)
  const handleStatus = (status: DeviceStatus) => sseWrite(res, 'status', { status });

  const handleAttendance = async (records: AttendanceRecord[]) => {
    try {
      const userIds = records.map((r) => String(r.deviceUserId));

      // Ambil data detail karyawan pengabsen untuk memetakan shift dan nama asli
      const employees = await prisma.employees.findMany({
        where: { user_id: { in: userIds } },
        include: { shifts: true },
      });
      const empMap = new Map(employees.map((e) => [e.user_id, e]));

      // Memproses record real-time dari mesin sidik jari
      const liveRecords: SseAttendanceRecord[] = records
        .filter((r) => String(r.deviceUserId) !== '1') // --- BLACKLIST MELINDA ---
        .map((r) => {
          const user_id = String(r.deviceUserId);
          const emp = empMap.get(user_id);
          const devName = client.getDeviceUserName(r.deviceUserId);

          const resolvedName = emp?.nama ?? devName ?? `Pegawai ${r.deviceUserId}`;
          const resolvedJabatan = emp?.jabatan ?? 'KARYAWAN';

          const scanTime = r.recordTime;

          let jamMasuk: string | null = null;
          let jamKeluar: string | null = null;
          let status = 'HADIR';
          let statusKeluar = 'HADIR';

          // Mengatur scanTime ke dalam ISO UTC agar konsisten di browser
          const scanTimeIso = new Date(
            Date.UTC(
              scanTime.getUTCFullYear(),
              scanTime.getUTCMonth(),
              scanTime.getUTCDate(),
              scanTime.getUTCHours(),
              scanTime.getUTCMinutes(),
              scanTime.getUTCSeconds()
            )
          );

          // Menentukan apakah scan merupakan masuk atau keluar berdasarkan kode dari ZKTeco
          // Kode: 0=Check-In (Masuk), 1=Check-Out (Keluar), 2=Break-Out, 3=Break-In, 4=OT-In, 5=OT-Out (Lembur Keluar)
          const isKeluar = r.attendanceType === 1 || r.attendanceType === 5;

          if (!isKeluar) {
            // SCAN MASUK
            jamMasuk = scanTimeIso.toISOString();
            // Menentukan batas jam masuk berdasarkan shift pegawai, default ke 08:00
            const shiftStartHour = emp?.shifts ? new Date(emp.shifts.jam_masuk).getUTCHours() : 8;
            const shiftStartMinute = emp?.shifts ? new Date(emp.shifts.jam_masuk).getUTCMinutes() : 0;
            const scanMinutes = scanTime.getUTCHours() * 60 + scanTime.getUTCMinutes();
            const shiftMinutes = shiftStartHour * 60 + shiftStartMinute;
            const localHour = scanTime.getUTCHours();

            // Toleransi keterlambatan 15 menit. Khusus shift malam/sore (jam 15 keatas) otomatis HADIR tanpa hitungan terlambat standar
            const isNightSession = localHour >= 15;
            status = isNightSession ? 'HADIR' : (scanMinutes > shiftMinutes + 15 ? 'TERLAMBAT' : 'HADIR');
          } else {
            // SCAN KELUAR
            jamKeluar = scanTimeIso.toISOString();
            // Menentukan batas jam pulang berdasarkan shift pegawai, default ke 16:30 (990 menit)
            const shiftEndHour = emp?.shifts ? new Date(emp.shifts.jam_keluar).getUTCHours() : 16;
            const shiftEndMinute = emp?.shifts ? new Date(emp.shifts.jam_keluar).getUTCMinutes() : 0;
            const scanMinutes = scanTime.getUTCHours() * 60 + scanTime.getUTCMinutes();
            const targetMinutes = emp?.shifts ? shiftEndHour * 60 + shiftEndMinute : 990;

            // Jika melakukan scan keluar sebelum jam pulang shift berakhir, status PULANG_CEPAT
            statusKeluar = scanMinutes < targetMinutes ? 'PULANG_CEPAT' : 'HADIR';
          }

          return {
            userSn: r.userSn,
            user_id: user_id,
            nama: resolvedName,
            jabatan: resolvedJabatan,
            status,
            statusKeluar,
            jamMasuk,
            jamKeluar,
            recordTime: scanTimeIso.toISOString(),
            ip: r.ip,
            source: 'live',
            is_active: emp?.is_active ?? false,
          };
        });

      // Kirim event absensi live ke frontend
      sseWrite(res, 'attendance', { records: liveRecords });
    } catch (error) {
      console.error('[SSE] Gagal mengolah data absensi live:', error);
    }
  };

  // Menambahkan listener status dan absensi ke instance klien daemon
  client.on('status', handleStatus);
  client.on('attendance', handleAttendance);

  // Mengirimkan ping setiap 30 detik untuk menjaga koneksi TCP SSE agar tidak terputus (keep-alive)
  const pingInterval = setInterval(() => {
    if (!res.writableEnded) res.write(': ping\n\n');
    else clearInterval(pingInterval);
  }, 30_000);

  // Membersihkan resource dan listener jika browser menutup koneksi
  req.on('close', () => {
    clearInterval(pingInterval);
    clearTimeout(historyTimeout);
    client.off('status', handleStatus);
    client.off('attendance', handleAttendance);
  });
};
