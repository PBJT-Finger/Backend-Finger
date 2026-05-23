import prisma from '../src/config/prisma';

async function main() {
  console.log('Clearing attendance data...');
  await prisma.attendance.deleteMany({});
  
  console.log('Clearing employee data...');
  await prisma.employees.deleteMany({});
  
  console.log('Database wiped successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
