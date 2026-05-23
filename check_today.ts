import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const attendances = await prisma.attendance.findMany({
    where: {
      tanggal: {
        gte: new Date('2026-05-22T00:00:00.000Z'),
        lte: new Date('2026-05-22T23:59:59.999Z')
      }
    }
  });
  console.log('Total Attendances for today:', attendances.length);
}

main().catch(console.error).finally(() => prisma.$disconnect());
