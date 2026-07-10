import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() {
  const t = new Date('2026-06-09T19:25:13Z');
  const tanggal = new Date(Date.UTC(2026, 5, 9)); 
  
  const existing = await prisma.attendance.findMany({
    where: {
      user_id: '8',
      tanggal: tanggal,
    }
  });
  console.log('existing count:', existing.length);
}
run();
