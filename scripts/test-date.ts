import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() {
  const tanggal = new Date(Date.UTC(2026, 5, 9)); // June 9, 2026
  console.log('Querying for tanggal:', tanggal.toISOString());
  const existing = await prisma.attendance.findMany({
    where: {
      user_id: '8',
      tanggal: tanggal,
    }
  });
  console.log('Found:', existing.length);
  
  const existing2 = await prisma.attendance.findMany({
    where: {
      user_id: '8',
      tanggal: {
        gte: tanggal,
        lte: tanggal
      }
    }
  });
  console.log('Found (gte/lte):', existing2.length);
}
run();
