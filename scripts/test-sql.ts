import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() {
  const line = "INSERT INTO `employees` VALUES (34,'2','Aziz_Lembayung','KARYAWAN',NULL,'AKTIF','2026-06-14',1,'2026-06-14 04:29:55','2026-06-14 04:29:55');";
  const finalLine = line.replace(';', ' ON DUPLICATE KEY UPDATE jabatan=VALUES(jabatan), is_active=VALUES(is_active);');
  try {
    await prisma.$executeRawUnsafe(finalLine);
    console.log("Success");
  } catch (err: any) {
    console.log("Error:", err.message);
  }
}
run().finally(() => prisma.$disconnect());
