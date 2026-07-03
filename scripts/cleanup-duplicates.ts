import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
  console.log('Memulai pembersihan data absensi duplikat...');

  // Mengambil semua data absensi
  const allAttendance = await prisma.attendance.findMany({
    where: { is_deleted: false },
    orderBy: { id: 'asc' } // Urutkan dari yang paling pertama dibuat
  });

  // Kelompokkan berdasarkan user_id dan tanggal
  const grouped = new Map<string, any[]>();
  
  for (const att of allAttendance) {
    const key = `${att.user_id}_${att.tanggal.toISOString()}`;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(att);
  }

  let deletedCount = 0;

  for (const [key, records] of grouped.entries()) {
    if (records.length > 1) {
      // Ada duplikat!
      console.log(`Ditemukan ${records.length} baris untuk ${key}`);
      
      // Kita simpan record yang pertama (terlama) sebagai master
      const master = records[0];
      
      // Kumpulkan ID dari record sisa untuk dihapus
      const duplicatesToDelete = records.slice(1);
      
      // Pindahkan jam keluar dari duplikat ke master jika master tidak punya jam keluar
      // (Bisa jadi Check-out tercatat di row yang berbeda karena bug sebelumnya)
      const latestCheckout = records.reverse().find(r => r.jam_keluar !== null);
      if (latestCheckout && latestCheckout.jam_keluar && master.jam_keluar === null) {
        await prisma.attendance.update({
          where: { id: master.id },
          data: {
            jam_keluar: latestCheckout.jam_keluar,
            status_keluar: latestCheckout.status_keluar
          }
        });
        console.log(`  -> Memperbarui jam keluar master ID ${master.id} dari duplikat`);
      }

      // Hapus duplikat
      for (const dup of duplicatesToDelete) {
        await prisma.attendance.delete({
          where: { id: dup.id }
        });
        deletedCount++;
        console.log(`  -> Menghapus duplikat ID ${dup.id}`);
      }
    }
  }

  console.log(`\nPembersihan selesai! Total baris duplikat yang dihapus: ${deletedCount}`);
  await prisma.$disconnect();
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
