import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanupDuplicates() {
  console.log('Memulai pembersihan absensi ganda (double scan)...');

  // Ambil semua data pada hari yang memiliki duplikat berdasarkan tanggal dan user
  const candidates = await prisma.$queryRaw<any[]>`
    SELECT user_id, tanggal
    FROM attendance 
    GROUP BY user_id, tanggal 
    HAVING COUNT(*) > 1
  `;

  if (candidates.length === 0) {
    console.log('✅ Tidak ditemukan grup tanggal yang duplikat di database.');
    return;
  }

  console.log(`Ditemukan kandidat ${candidates.length} pasang user & tanggal. Memeriksa detail per sesi...`);

  let totalDeleted = 0;

  for (const cand of candidates) {
    const rawRecords = await prisma.attendance.findMany({
      where: {
        user_id: cand.user_id,
        tanggal: cand.tanggal,
      },
      orderBy: { created_at: 'asc' }, // Urutkan dari yang pertama direkam
    });

    if (rawRecords.length <= 1) continue;

    // Kelompokkan record yang ada per sesi
    const pagiRecords: any[] = [];
    const malamRecords: any[] = [];

    rawRecords.forEach(r => {
      const jam = r.jam_masuk ? new Date(r.jam_masuk).getUTCHours() : 8; // Default pagi jika bingung
      if (jam >= 15 || jam < 6) {
        malamRecords.push(r);
      } else {
        pagiRecords.push(r);
      }
    });

    const mergeAndClean = async (records: any[], sesiName: string) => {
      if (records.length <= 1) return;

      const primaryRecord = records[0]!;
      let bestJamKeluar = primaryRecord.jam_keluar;

      for (const r of records) {
        if (r.jam_keluar) {
          if (!bestJamKeluar || new Date(r.jam_keluar).getTime() > new Date(bestJamKeluar).getTime()) {
            bestJamKeluar = r.jam_keluar;
          }
        }
      }

      await prisma.attendance.update({
        where: { id: primaryRecord.id },
        data: { jam_keluar: bestJamKeluar }
      });

      const idsToDelete = records.slice(1).map(r => r.id);
      const delRes = await prisma.attendance.deleteMany({
        where: { id: { in: idsToDelete } }
      });

      totalDeleted += delRes.count;
      console.log(`- [${cand.user_id}] ${cand.tanggal.toISOString().split('T')[0]} (${sesiName}): Menghapus ${delRes.count} sampah.`);
    };

    await mergeAndClean(pagiRecords, 'PAGI');
    await mergeAndClean(malamRecords, 'MALAM');
  }

  console.log(`\n✅ Selesai! Total ${totalDeleted} baris data sampah berhasil dihapus.`);
}

cleanupDuplicates()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
