import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const result = await prisma.attendance.updateMany({
    where: { 
      created_at: { gte: new Date(Date.now() - 3600000) }, 
      tanggal: new Date('2026-05-21T00:00:00.000Z') 
    },
    data: { 
      tanggal: new Date('2026-05-22T00:00:00.000Z') 
    }
  });
  console.log(`Updated ${result.count} records`);
}
main().catch(console.error).finally(() => prisma.$disconnect());
