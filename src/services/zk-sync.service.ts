/**
 * src/services/zk-sync.service.ts — Attendance session threshold: 2 hours
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
import logger from '../utils/logger'; // Logger aplikasi
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

  // Mutex lock in-memory untuk mencegah race condition (double scan) pada milidetik yang sama
  private processingLocks = new Set<string>();

  // Mutex lock tingkat batch untuk mencegah siklus polling bertumpuk yang menyebabkan duplikasi row
  private isProcessingBatch = false;

  constructor(zkClient: ZkDeviceClient) {
    this.zkClient = zkClient;
  }

  /**
   * Menempelkan (attach) event listener kehadiran pada ZkDeviceClient.
   * Dipanggil sekali saat server startup pertama kali.
   */
  public start(): void {
    this.zkClient.on('attendance', async (records: AttendanceRecord[]) => {
      // Jalankan fungsi penyimpanan secara asinkron tanpa harus di-await (fire-and-forget),
      // agar tidak menghalangi atau memblokir antrean event loop Node.js.
      if (this.isProcessingBatch) {
        console.log('[ZkSyncService] Batch sebelumnya masih berjalan, mengabaikan siklus polling saat ini untuk mencegah race condition.');
        return;
      }

      this.isProcessingBatch = true;
      try {
        await this.persistAttendanceBatch(records);
      } finally {
        this.isProcessingBatch = false;
      }
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

    // Sesi malam berakhir pukul 23:59. Scan setelah 00:00 langsung masuk hari baru.
    // Tidak ada penyesuaian tanggal (date adjustment) untuk jam dini hari.
    const sessionYear = localYear;
    const sessionMonth = localMonth;
    const sessionDay = localDate;

    // Field 'tanggal' diisi dengan waktu tengah malam UTC (Midnight) merepresentasikan tanggal tersebut
    const tanggal = new Date(Date.UTC(sessionYear, sessionMonth, sessionDay));

    // ID user di mesin dipetakan ke user_id
    const user_id = String(record.deviceUserId);

    // Mutex Lock Check: Jika thread/proses lain sedang memproses absensi user ini di hari yang sama saat ini juga
    const lockKey = `${user_id}_${tanggal.toISOString()}`;
    if (this.processingLocks.has(lockKey)) {
      // Abaikan. Jika ini scan baru, ZKTeco akan memancarkan ulang di siklus polling berikutnya.
      return;
    }
    this.processingLocks.add(lockKey);

    try {
      await this._doUpsertAttendanceRecord(record, t, sessionYear, sessionMonth, sessionDay, tanggal, user_id);
    } finally {
      this.processingLocks.delete(lockKey);
    }
  }

  private async _doUpsertAttendanceRecord(
    record: AttendanceRecord,
    t: Date,
    localYear: number,
    localMonth: number,
    localDate: number,
    tanggal: Date,
    user_id: string
  ): Promise<void> {
    const localHour = t.getUTCHours();
    const localMinute = t.getUTCMinutes();
    const localSecond = t.getUTCSeconds();

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

    // Hitung tanggal kemarin untuk mencari shift malam yang menyeberang hari
    const tanggalKemarin = new Date(tanggal);
    tanggalKemarin.setUTCDate(tanggalKemarin.getUTCDate() - 1);

    // Cari record hari ini dan kemarin yang belum dihapus
    const existingRecords = await prisma.attendance.findMany({
      where: {
        user_id: resolvedUserId,
        tanggal: { in: [tanggal, tanggalKemarin] },
        is_deleted: false,
      },
      orderBy: [
        { tanggal: 'desc' },
        { id: 'desc' }
      ]
    });

    // Cek apakah tombol yang ditekan di mesin secara eksplisit adalah tombol 'Pulang/Check-Out'
    const isExplicitCheckOut = record.attendanceType === 1 || record.attendanceType === 4 || record.attendanceType === 5;

    // Format tanggal ke YYYY-MM-DD string untuk perbandingan aman tanpa gangguan timezone offset
    const toDateStr = (d: Date | string): string => {
      if (typeof d === 'string') return d.substring(0, 10);
      if (d instanceof Date && !isNaN(d.getTime())) {
        const y = d.getUTCFullYear();
        const m = String(d.getUTCMonth() + 1).padStart(2, '0');
        const day = String(d.getUTCDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      }
      return '';
    };

    const targetDateStr = toDateStr(tanggal);
    const kemarinDateStr = toDateStr(tanggalKemarin);

    // Cari open session (punya jam_masuk tapi belum ada jam_keluar)
    const openSession = existingRecords.find(r => {
      if (!r.jam_masuk || r.jam_keluar) return false;

      const rDateStr = toDateStr(r.tanggal);
      const isTodaySession = rDateStr === targetDateStr;
      if (isTodaySession) return true;

      const isYesterdaySession = rDateStr === kemarinDateStr;
      if (isYesterdaySession) {
        // Izinkan menutup sesi kemarin HANYA JIKA:
        // 1. User menekan tombol Pulang secara manual di mesin (isExplicitCheckOut === true)
        // 2. ATAU ini adalah shift malam yang menyeberang tengah malam (masuk >= 17:00 dan scan hari ini < 05:00)
        const masukTime = new Date(r.jam_masuk);
        const isNightShiftCrossMidnight = masukTime.getUTCHours() >= 17 && localHour < 5;
        return isExplicitCheckOut || isNightShiftCrossMidnight;
      }

      return false;
    });
    const scanMinutes = localHour * 60 + localMinute;

    // Logika Status Check-In:
    // Dosen Malam & Karyawan tidak ada terlambat. Dosen Pagi batas 08:00 (toleransi 15 menit).
    let morningStatus = 'HADIR';
    const isNightSession = localHour >= 15;
    if (resolvedJabatan === 'DOSEN' && !isNightSession) {
      const targetPagi = 8 * 60;
      morningStatus = scanMinutes > targetPagi + 15 ? 'TERLAMBAT' : 'HADIR';
    }

    const afternoonStatus = 'HADIR';

    if (openSession) {
      // ADA OPEN SESSION: Hitung selisih waktu dari jam_masuk
      const masukTime = new Date(openSession.jam_masuk!);
      const masukMinutes = masukTime.getUTCHours() * 60 + masukTime.getUTCMinutes();
      
      let diffMinutes = scanMinutes - masukMinutes;
      if (openSession.tanggal.getTime() === tanggalKemarin.getTime()) {
        diffMinutes += 24 * 60;
      } else if (diffMinutes < 0) {
        diffMinutes += 24 * 60;
      }

      // ATURAN 1: Jika selisih < 2 jam (120 menit), abaikan (dianggap spam / re-scan < 2 jam)
      if (diffMinutes < 120) {
        logger.info(`[ZK Sync] Re-scan diabaikan karena selisih < 2 jam (${diffMinutes} mnt) untuk user ${resolvedUserId}`);
        return;
      }

      // ATURAN 2: Jika selisih >= 2 jam, TUTUP SESI (Absen Pulang)
      await prisma.attendance.update({
        where: { id: openSession.id },
        data: {
          jam_keluar: timePart,
          status_keluar: afternoonStatus,
          device_id: record.ip,
          updated_at: new Date()
        },
      });
    } else {
      // TIDAK ADA OPEN SESSION (record baru / sesi sebelumnya sudah ditutup):
      // Wajib buat Absen Masuk (jam_masuk) sesi baru
      try {
        await prisma.attendance.create({
          data: {
            user_id: resolvedUserId,
            nama: resolvedName,
            jabatan: resolvedJabatan as any,
            tanggal: tanggal,
            jam_masuk: timePart,
            jam_keluar: null,
            device_id: record.ip,
            verification_method: 'SIDIK_JARI',
            status: morningStatus,
            status_keluar: afternoonStatus,
          },
        });
      } catch (createErr: any) {
        const isDuplicate = createErr?.code === 'P2002' ||
          (typeof createErr?.message === 'string' && createErr.message.includes('Unique constraint'));
        if (!isDuplicate) throw createErr;
      }
    }
  }
}
