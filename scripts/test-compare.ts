import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() {
  const agung = await prisma.employees.findFirst({ where: { nama: { contains: 'Agung' } } });
  const atiek = await prisma.employees.findFirst({ where: { user_id: '7' } });
  console.log('Agung:', agung);
  console.log('Atiek:', atiek);
}
run();
