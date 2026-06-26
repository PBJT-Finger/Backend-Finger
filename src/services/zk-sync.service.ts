/**
 * src/services/zk-sync.service.ts
 *
 * Menghubungkan ZkDeviceClient (lapisan perangkat keras mesin) dengan database Prisma (lapisan penyimpanan data).
 *
 * Tanggung Jawab:
 *   1. Mendengarkan event 'attendance' yang dipancarkan oleh ZkDeviceClient
 *   2. Memetakan field objek log scan mesin ZKTeco (AttendanceRecord) ke struktur tabel `attendance` di database Prisma
 *   3. Menyimpan log scan absensi secara independen (idempotent) sehingga aman dari duplikasi saat reconect
 *   4. Melindungi proses server agar tidak mati (crash) — menangkap semua error secara terisolasi pada setiap baris proses
 *
 * Desain Keputusan — Idempotensi (Upsert/Isolate logic):
 *   Mesin ZKTeco memancarkan kembali semua log historis yang ada dalam memori setiap siklus polling.
 *   Operasi INSERT mentah secara acak akan menimbulkan banyak sekali log duplikat di DB.
 *   Oleh karena itu, dilakukan pengecekan record yang presisi berdasarkan user_id, tanggal, dan waktu scan
 *   untuk memfilter log duplikat yang dikirim ulang oleh memori mesin.
 *
 * Catatan Pemetaan Kolom:
 *   ZKTeco → Prisma database:
 *   - deviceUserId → user_id (String/NIP)
 *   - recordTime   → tanggal (Date saja) + jam_masuk / jam_keluar (waktu scan)
 *   - ip           → device_id (alamat IP mesin sidik jari pengirim)
 */

import { v4 as uuidv4 } from 'uuid'; // Pembuat string UUID acak untuk pelacakan batch
import prisma from '../config/prisma'; // Prisma client untuk query DB
import { ZkDeviceClient, AttendanceRecord } from '../infrastructure/zk-client'; // Client konektivitas ZKTeco

// ─── Tipe Data ────────────────────────────────────────────────────────────────

interface BatchResult {
  batchId: string;
  processed: number;
  created: number;
  updated: number;
  errors: number;
}

// ─── ZkSyncService ───────────────────────────────────────────────────────────

export class ZkSyncService {
  private readonly zkClient: ZkDeviceClient;

  constructor(zkClient: ZkDeviceClient) {
    this.zkClient = zkClient;
  }

  /**
   * Menempelkan (attach) event listener kehadiran pada ZkDeviceClient.
   * Dipanggil sekali saat server startup pertama kali.
   */
  public start(): void {
    this.zkClient.on('attendance', (records: AttendanceRecord[]) => {
      // Jalankan fungsi penyimpanan secara asinkron tanpa harus di-await (fire-and-forget),
      // agar tidak menghalangi atau memblokir antrean event loop Node.js.
      void this.persistAttendanceBatch(records);
    });

    console.log('[ZkSyncService] Listener sinkronisasi absensi mesin berhasil ditempelkan.');
  }

  /**
   * Menyimpan sekumpulan (batch) log absensi yang dikirim dari mesin ZKTeco ke database.
   *
   * Isolasi Kesalahan:
   *   Masing-masing log diproses dalam blok try/catch secara mandiri. Kegagalan menyimpan satu baris log
   *   tidak akan membatalkan pemrosesan log lainnya dalam batch tersebut.
   */
  private async persistAttendanceBatch(records: AttendanceRecord[]): Promise<BatchResult> {
    const batchId = uuidv4();
    let created = 0;
    const updated = 0;
    let errors = 0;

    console.log(`[ZkSyncService] Memproses batch sinkronisasi ${batchId} — berisi ${records.length} rekaman`);

    for (const record of records) {
      try {
        // Abaikan scan dari ID simulasi/dummy/testing (Melinda '1' adalah user asli, jadi ID 5,6,7 yang diabaikan)
        if (['5', '6', '7'].includes(record.deviceUserId)) {
          continue;
        }

        // Abaikan log scan salah milik Aziz (ID 8) pada tanggal 2026-06-03
        const recordDateStr = record.recordTime.toISOString().substring(0, 10);
        if (record.deviceUserId === '8' && recordDateStr === '2026-06-03') {
          continue;
        }

        await this.upsertAttendanceRecord(record);
        created++;
      } catch (err) {
        errors++;
        const msg = err instanceof Error ? err.message : String(err);
        console.error(
          `[ZkSyncService] Gagal menyimpan log absensi user=${record.deviceUserId} waktu=${record.recordTime.toISOString()} — ${msg}`
        );
      }
    }

    const result: BatchResult = {
      batchId,
      processed: records.length,
      created,
      updated,
      errors,
    };

    console.log(
      `[ZkSyncService] Batch ${batchId} selesai — diproses=${result.processed} sukses=${result.created} gagal=${result.errors}`
    );

    return result;
  }

  /**
   * Logika penyimpanan (upsert/insert) untuk satu data rekaman absensi.
   *
   * Aturan Bisnis Pemetaan:
   *   - Waktu scan yang datang dari mesin adalah waktu lokal mesin.
   *   - zklib memparsingnya ke dalam objek Date UTC. Kita konversi kembali ke jam lokal
   *     dan simpan ke database dengan format tanggal jam UTC Epoch 1970 untuk representasi waktu murni.
   */
  private async upsertAttendanceRecord(record: AttendanceRecord): Promise<void> {
    const t = new Date(record.recordTime);
    // Ekstrak waktu komponen lokal mesin dari data zklib
    const localYear = t.getUTCFullYear();
    const localMonth = t.getUTCMonth();
    const localDate = t.getUTCDate();
    const localHour = t.getUTCHours();
    const localMinute = t.getUTCMinutes();
    const localSecond = t.getUTCSeconds();

    // Field 'tanggal' diisi dengan waktu tengah malam UTC (Midnight) merepresentasikan tanggal tersebut
    const tanggal = new Date(Date.UTC(localYear, localMonth, localDate));

    // ID user di mesin dipetakan ke user_id
    const user_id = record.deviceUserId;

    // Ambil info master data pegawai aktif dari DB
    const employee = await prisma.employees.findFirst({
      where: { user_id: user_id, is_active: true },
      include: { shifts: true },
    });

    const resolvedUserId = employee?.user_id ?? record.deviceUserId;
    const deviceName = this.zkClient.getDeviceUserName(record.deviceUserId);
    const resolvedName = employee?.nama ?? deviceName ?? `Karyawan ${record.deviceUserId}`;
    const resolvedJabatan = employee?.jabatan === 'DOSEN' ? 'DOSEN' : 'KARYAWAN';

    // Simpan bagian jam saja ke dalam UTC Epoch 1970-01-01T[jam]:[menit]:[detik]
    const timePart = new Date(Date.UTC(1970, 0, 1, localHour, localMinute, localSecond));

    // ─── Logika Pencegahan Duplikasi (Pak Dani) ───────────────────
    // Aturan: Maksimal 1 scan untuk sesi pagi (Check-In) dan 1 scan untuk sesi sore (Check-Out).
    // Implementasi:
    // 1. Scan pertama di hari tersebut selalu menjadi jam_masuk.
    // 2. Scan berikutnya yang berjarak kurang dari 2 jam (120 menit) dianggap duplikat (Abaikan).
    // 3. Scan yang berjarak lebih dari 2 jam mengisi jam_keluar.
    // 4. Jika jam_keluar sudah terisi, abaikan scan selanjutnya.

    const existingRecord = await prisma.attendance.findFirst({
      where: {
        user_id: resolvedUserId,
        tanggal: tanggal,
      }
    });

    if (!existingRecord) {
      // Belum ada data hari ini -> Buat sebagai Check-In (jam_masuk)
      const shiftStartHour = employee?.shifts ? new Date(employee.shifts.jam_masuk).getUTCHours() : 8;
      const shiftStartMinute = employee?.shifts ? new Date(employee.shifts.jam_masuk).getUTCMinutes() : 0;
      const scanMinutes = t.getUTCHours() * 60 + t.getUTCMinutes();
      const shiftMinutes = shiftStartHour * 60 + shiftStartMinute;
      const isNightSession = localHour >= 15;
      
      // Keterlambatan dihitung jika scan lebih dari 15 menit melewati jam masuk shift kerja.
      // Jam malam (Night Session, misal absen susulan/lembur malam) dianggap HADIR biasa.
      const morningStatus = isNightSession ? 'HADIR' : (scanMinutes > shiftMinutes + 15 ? 'TERLAMBAT' : 'HADIR');

      await prisma.attendance.create({
        data: {
          user_id: resolvedUserId,
          nama: resolvedName,
          jabatan: resolvedJabatan,
          tanggal: tanggal,
          jam_masuk: timePart,
          jam_keluar: null,
          device_id: record.ip,
          verification_method: 'SIDIK_JARI',
          status: morningStatus,
          status_keluar: 'HADIR',
        },
      });
      return;
    }

    // Jika data sudah ada, cek rentang waktu dengan jam_masuk
    if (existingRecord.jam_masuk) {
      const existingMasuk = new Date(existingRecord.jam_masuk);
      const existingScanMinutes = existingMasuk.getUTCHours() * 60 + existingMasuk.getUTCMinutes();
      const currentScanMinutes = localHour * 60 + localMinute;
      const diffMinutes = Math.abs(currentScanMinutes - existingScanMinutes);

      // Jika scan berjarak kurang dari 2 jam (120 menit), anggap sebagai duplikasi dari sesi yang sama (Abaikan)
      if (diffMinutes < 120) {
        return;
      }
    }

    // Jika lebih dari 2 jam, maka ini adalah scan sesi akhir (Check-Out)
    if (!existingRecord.jam_keluar) {
      const shiftEndHour = employee?.shifts ? new Date(employee.shifts.jam_keluar).getUTCHours() : 16;
      const shiftEndMinute = employee?.shifts ? new Date(employee.shifts.jam_keluar).getUTCMinutes() : 30;
      const scanMinutes = localHour * 60 + localMinute;
      const targetMinutes = employee?.shifts ? shiftEndHour * 60 + shiftEndMinute : 990;
      
      // Status pulang cepat dihitung jika scan pulang sebelum jam pulang shift kerja yang ditentukan
      const afternoonStatus = scanMinutes < targetMinutes ? 'PULANG_CEPAT' : 'HADIR';

      await prisma.attendance.update({
        where: { id: existingRecord.id },
        data: {
          jam_keluar: timePart,
          status_keluar: afternoonStatus,
          device_id: record.ip,
        },
      });
    } else {
      // jam_keluar sudah terisi, artinya sudah ada 1 rekam pagi dan 1 rekam sore.
      // Scan ketiga, keempat, dst pada sesi sore akan diabaikan.
      return;
    }
  }
}
