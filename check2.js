const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const a = await prisma.attendance.findMany({ where: { user_id: '7' } });
  console.log("Attendance for Atiek (ID 7):", a);

  // Let's also check if there are any recent logs for unrecognized users
  const recent = await prisma.attendance.findMany({ 
    take: 10, 
    orderBy: { created_at: 'desc' }
  });
  console.log("Recent 10 Attendance records:");
  console.log(recent);
}
main().finally(() => prisma.$disconnect());
