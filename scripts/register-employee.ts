import dotenv from 'dotenv';
dotenv.config();
import prisma from '../src/config/prisma';

// Usage: npx tsx scripts/register-employee.ts <user_id> <nama> <jabatan>
// Example: npx tsx scripts/register-employee.ts 10 "Atiek" DOSEN
// Example: npx tsx scripts/register-employee.ts 11 "Ali" KARYAWAN

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 3) {
    console.error('❌ Error: Parameter tidak lengkap.');
    console.log('\nCara Penggunaan:');
    console.log('  npx tsx scripts/register-employee.ts <user_id> "<nama>" <jabatan>');
    console.log('\nContoh:');
    console.log('  npx tsx scripts/register-employee.ts 10 "Dr. Atiek, M.T" DOSEN');
    console.log('  npx tsx scripts/register-employee.ts 11 "Ali" KARYAWAN');
    process.exit(1);
  }

  const userId = args[0]!;
  const name = args[1]!;
  const positionInput = args[2]!.toUpperCase();

  if (positionInput !== 'DOSEN' && positionInput !== 'KARYAWAN') {
    console.error('❌ Error: Jabatan harus berupa "DOSEN" atau "KARYAWAN".');
    process.exit(1);
  }

  const jabatan = positionInput as 'DOSEN' | 'KARYAWAN';

  console.log(`[Info] Mendaftarkan karyawan/dosen ke database...`);
  console.log(`  - User ID (Device): ${userId}`);
  console.log(`  - Nama            : ${name}`);
  console.log(`  - Jabatan         : ${jabatan}`);

  try {
    const employee = await prisma.employees.upsert({
      where: { user_id: userId },
      update: {
        nama: name,
        jabatan: jabatan,
        is_active: true,
      },
      create: {
        user_id: userId,
        nama: name,
        jabatan: jabatan,
        is_active: true,
      },
    });

    console.log(`\n✅ SUKSES: Data berhasil disimpan ke database.`);
    console.log(JSON.stringify(employee, null, 2));
  } catch (error) {
    console.error('❌ Gagal menyimpan data:', error);
  }
}

main()
  .catch((err) => {
    console.error('Fatal error:', err);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
