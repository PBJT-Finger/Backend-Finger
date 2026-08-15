const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const latest = await prisma.attendance.findFirst({
    where: {
      tanggal: {
        lt: new Date('2030-01-01')
      }
    },
    orderBy: { tanggal: 'desc' }
  });
  console.log("LATEST VALID ATTENDANCE:", latest);
}

main().finally(() => prisma.$disconnect());
