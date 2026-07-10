import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() {
  const emp = await prisma.employees.findFirst({ where: { user_id: '15' } });
  console.log('Employee 15:', emp);
}
run();
