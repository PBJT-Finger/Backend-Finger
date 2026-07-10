import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
  const atiek = await prisma.employees.findMany({
    where: { nama: { contains: 'Atiek' } }
  });
  console.log('Employee:', atiek);

  if (atiek.length > 0) {
    const att = await prisma.attendance.findMany({
      where: { user_id: atiek[0].user_id }
    });
    console.log('Attendance:', att);
  }
}
run();
