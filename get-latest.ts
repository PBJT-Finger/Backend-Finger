import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const records = await prisma.attendance.findMany({
    orderBy: { created_at: 'desc' },
    take: 5
  });
  console.log(records.map(r => ({
    id: r.id, 
    nama: r.nama, 
    tanggal: r.tanggal, 
    jam_masuk: r.jam_masuk, 
    jam_keluar: r.jam_keluar, 
    updated: r.updated_at
  })));
}
main().catch(console.error).finally(() => prisma.$disconnect());
