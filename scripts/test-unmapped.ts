import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
  const att = await prisma.attendance.findMany({
    orderBy: { created_at: 'desc' },
    take: 20
  });
  console.log('Recent attendance:');
  att.forEach(a => console.log(`${a.user_id} - ${a.nama} - ${a.tanggal.toISOString()} - In: ${a.jam_masuk} - Out: ${a.jam_keluar}`));
}
run();
