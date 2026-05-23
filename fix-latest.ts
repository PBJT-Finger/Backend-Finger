import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const result = await prisma.attendance.updateMany({
    where: { 
      updated_at: { gte: new Date(Date.now() - 3600000) } // updated in last hour
    },
    data: { 
      tanggal: new Date('2026-05-22T00:00:00.000Z') 
    }
  });
  console.log(`Fixed ${result.count} recent records to today's date`);
}
main().catch(console.error).finally(() => prisma.$disconnect());
