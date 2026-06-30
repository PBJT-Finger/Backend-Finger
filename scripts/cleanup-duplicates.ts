import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanupDuplicates() {
  console.log('Memulai pembersihan absensi ganda (double scan)...');
  
  // Ambil data yang ganda
  const dups = await prisma.$queryRaw<any[]>`
    SELECT user_id, tanggal, COUNT(*) as count 
    FROM attendance 
    GROUP BY user_id, tanggal 
    HAVING count > 1
  `;

  if (dups.length === 0) {
    console.log('✅ Tidak ditemukan absensi ganda di database.');
    return;
  }

  console.log(`Ditemukan ${dups.length} pasang data ganda. Mulai memproses...`);

  let totalDeleted = 0;

  for (const dup of dups) {
    const records = await prisma.attendance.findMany({
      where: {
        user_id: dup.user_id,
        tanggal: dup.tanggal,
      },
      orderBy: { created_at: 'asc' }, // Urutkan dari yang pertama kali direkam
    });

    if (records.length <= 1) continue;

    // Ambil record pertama sebagai data utama (untuk jam_masuk)
    const primaryRecord = records[0]!;

    
    // Cari jam keluar yang valid dari semua sisa duplikat (ambil yang paling akhir jika ada banyak)
    let bestJamKeluar = primaryRecord.jam_keluar;
    for (const r of records) {
      if (r.jam_keluar) {
        if (!bestJamKeluar || new Date(r.jam_keluar).getTime() > new Date(bestJamKeluar).getTime()) {
          bestJamKeluar = r.jam_keluar;
        }
      }
    }

    // Update primary record dengan jam_keluar terbaik
    await prisma.attendance.update({
      where: { id: primaryRecord.id },
      data: {
        jam_keluar: bestJamKeluar
      }
    });

    // Hapus semua sisanya
    const idsToDelete = records.slice(1).map(r => r.id);
    const delRes = await prisma.attendance.deleteMany({
      where: { id: { in: idsToDelete } }
    });

    totalDeleted += delRes.count;
    console.log(`- [${dup.user_id}] ${dup.tanggal.toISOString().split('T')[0]}: Menggabungkan ${records.length} baris, menghapus ${delRes.count} sampah.`);
  }

  console.log(`\n✅ Selesai! Total ${totalDeleted} baris data sampah berhasil dihapus.`);
}

cleanupDuplicates()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
