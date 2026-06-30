import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
  console.log('Menghapus data atas nama Melinda (ID 1)...');

  try {
    const employee = await prisma.employees.findFirst({
      where: {
        OR: [
          { user_id: '1' },
          { nama: 'Melinda' },
        ],
      },
    });

    if (!employee) {
      console.log('Data Melinda tidak ditemukan di tabel employees.');
      
      // Tetap coba hapus attendance jaga-jaga kalau nyangkut
      const attResult = await prisma.attendance.deleteMany({
        where: { user_id: '1' },
      });
      console.log(`Berhasil menghapus ${attResult.count} log absensi atas nama user_id '1' (Melinda).`);
      
    } else {
      console.log(`Ditemukan: ${employee.nama} (ID internal DB: ${employee.id})`);
      
      // Hapus data attendance terkait
      const attResult = await prisma.attendance.deleteMany({
        where: { user_id: employee.user_id },
      });
      console.log(`Berhasil menghapus ${attResult.count} log absensi atas nama Melinda.`);

      // Terakhir, hapus master data employee
      await prisma.employees.delete({
        where: { id: employee.id },
      });
      console.log('Berhasil menghapus master data Melinda dari tabel employees.');
    }

    console.log('Selesai!');
  } catch (error) {
    console.error('Terjadi kesalahan:', error);
  } finally {
    await prisma.$disconnect();
  }
}

run();
