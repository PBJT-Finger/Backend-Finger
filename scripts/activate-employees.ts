import dotenv from 'dotenv';
dotenv.config();

import prisma from '../src/config/prisma';

async function main() {
  console.log('Activating all employees in database except Melinda, Rafly, Wisnu...');

  const result = await prisma.employees.updateMany({
    where: {
      NOT: {
        user_id: {
          in: ['1', '2', '30'],
        },
      },
    },
    data: {
      is_active: true,
      status: 'AKTIF',
    },
  });

  console.log(`Successfully activated ${result.count} employees.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
