import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const employees = await prisma.employees.findMany();
  console.log('Total Employees:', employees.length);
  
  const attendances = await prisma.attendance.findMany();
  console.log('Total Attendances:', attendances.length);

  if (attendances.length > 0) {
    console.log('Sample Attendance:', attendances[0]);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
