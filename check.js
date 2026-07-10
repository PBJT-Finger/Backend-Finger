const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const u = await prisma.employees.findMany({ where: { nama: { contains: 'Atiek' } } });
  console.log(u);
}
main().finally(() => prisma.$disconnect());
