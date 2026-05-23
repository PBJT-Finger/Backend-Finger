import prisma from '../src/config/prisma';

async function main() {
  const shifts = await prisma.shifts.findMany();
  console.log('Shifts in DB:', JSON.stringify(shifts, null, 2));

  const employees = await prisma.employees.findMany({
    include: { shifts: true }
  });
  console.log('Employees with shifts:', JSON.stringify(employees, null, 2));
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
