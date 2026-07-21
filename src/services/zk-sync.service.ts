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

    // ─── Logika Auto Check-Out & Multi-Sesi (Double Shift) ───
    const existingRecords = await prisma.attendance.findMany({
      where: {
        user_id: resolvedUserId,
        tanggal: tanggal,
      },
      orderBy: { id: 'desc' }
    });

    let targetRecord = null;
    if (existingRecords.length > 0) {
      const latestRecord = existingRecords[0]!;
      
      if (latestRecord.jam_masuk && !latestRecord.jam_keluar) {
        // Ada sesi terbuka (belum check-out), jadikan target untuk check-out/spam prevention
        targetRecord = latestRecord;
      } else if (latestRecord.jam_masuk && latestRecord.jam_keluar) {
        // Sesi terakhir sudah check-out. Apakah ini spam check-out atau shift baru?
        const ex = new Date(latestRecord.jam_keluar);
        const exMinutes = ex.getUTCHours() * 60 + ex.getUTCMinutes();
        const scanMinutes = localHour * 60 + localMinute;
        
        let diffEx = scanMinutes - exMinutes;
        if (diffEx < 0) diffEx += 24 * 60;
        
        if (diffEx < 60) {
          // Baru saja check-out kurang dari 1 jam yang lalu -> anggap update/spam
          targetRecord = latestRecord;
        } else {
          // Sudah lebih dari 1 jam sejak check-out terakhir
          // Cek apakah ini sesi yang berbeda (Double Shift)
          const isNightSession = localHour >= 15;
          const h = new Date(latestRecord.jam_masuk).getUTCHours();
          const recIsNight = h >= 15;
          
          if (recIsNight === isNightSession) {
             // Masih di sesi yang sama, jadikan target untuk update jam_keluar terakhir
             targetRecord = latestRecord;
          } else {
             // Beda sesi! Waktunya buat Check-in baru untuk shift baru
             targetRecord = null;
          }
        }
      }
    }

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

    if (!targetRecord) {
      // Pertama kali scan di sesi ini -> Buat jam_masuk
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
    } else {
      if (!targetRecord.jam_masuk) {
        await prisma.attendance.update({
          where: { id: targetRecord.id },
          data: { jam_masuk: timePart, status: morningStatus, updated_at: new Date() }
        });
      } else {
        // Sudah ada jam masuk, scan berikutnya menjadi jam_keluar (Auto-Inference)
        const masuk = new Date(targetRecord.jam_masuk);
        const masukMinutes = masuk.getUTCHours() * 60 + masuk.getUTCMinutes();
        
        let diffMinutes = scanMinutes - masukMinutes;
        if (diffMinutes < 0) diffMinutes += 24 * 60; // Handle cross midnight
        
        // Proteksi re-processing: jika scan identik atau sangat dekat dengan jam_masuk
        // (< 5 menit), abaikan. Ini mencegah data jam_keluar rusak saat Backend restart.
        if (diffMinutes < 5) return;

        // Beri jeda minimal 1 jam (60 menit) untuk scan pulang agar tidak double tap
        if (diffMinutes < 60 && !targetRecord.jam_keluar) return;

        if (targetRecord.jam_keluar) {
          const ex = new Date(targetRecord.jam_keluar);
          const exMinutes = ex.getUTCHours() * 60 + ex.getUTCMinutes();
          let diffEx = scanMinutes - exMinutes;
          if (diffEx < 0) diffEx += 24 * 60;
          if (diffEx < 5) return; // Abaikan spam tap berdekatan
        }

        await prisma.attendance.update({
          where: { id: targetRecord.id },
          data: {
            jam_keluar: timePart,
            status_keluar: afternoonStatus,
            device_id: record.ip,
            updated_at: new Date()
          },
        });
      }
    }
  }
}
