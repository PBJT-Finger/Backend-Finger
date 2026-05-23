const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.admins.update({
    where: { email: 'bajategal@gmail.com' },
    data: { username: 'bajategal' }
  });
  console.log('Username updated to bajategal');
}

main().finally(() => prisma.$disconnect());
