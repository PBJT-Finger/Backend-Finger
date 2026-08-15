import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const usersToSeed = [
  // DOSEN
  { nama: 'Slamet Riyadi', email: 'slamet.riyadi.pbjt@gmail.com', pass: 'BajaSlamet#2026', role: 'DOSEN' },
  { nama: 'Lily Budinurani', email: 'lily.budinurani.pbjt@gmail.com', pass: 'BajaLily#2026', role: 'DOSEN' },
  { nama: 'Ilham Akhsani', email: 'ilham.akhsani.pbjt@gmail.com', pass: 'BajaIlham#2026', role: 'DOSEN' },
  { nama: 'Ria Candra Dewi', email: 'ria.candradewi.pbjt@gmail.com', pass: 'BajaRia#2026', role: 'DOSEN' },
  { nama: 'Atiek Nurindriani', email: 'atiek.nurindriani.pbjt@gmail.com', pass: 'BajaAtiek#2026', role: 'DOSEN' },
  { nama: 'Aziz Azindani', email: 'aziz.azindani.pbjt@gmail.com', pass: 'BajaAziz#2026', role: 'DOSEN' },
  { nama: 'Agung Nugroho', email: 'agung.nugroho.pbjt@gmail.com', pass: 'BajaAgung#2026', role: 'DOSEN' },
  { nama: 'Ismi Kusumaningroem', email: 'ismi.kusumaningrum.pbjt@gmail.com', pass: 'BajaIsmi#2026', role: 'DOSEN' },
  { nama: 'Robiatul Adawiyah', email: 'robiatul.adawiyah.pbjt@gmail.com', pass: 'BajaRobiatul#2026', role: 'DOSEN' },
  { nama: 'Ayu Ningrum Purnamasari', email: 'ayu.purnamasari.pbjt@gmail.com', pass: 'BajaAyu#2026', role: 'DOSEN' },
  { nama: 'Septian Trikusuma', email: 'septian.trikusuma.pbjt@gmail.com', pass: 'BajaSeptian#2026', role: 'DOSEN' },
  { nama: 'Wulan Anggraini', email: 'wulan.anggraini.pbjt@gmail.com', pass: 'BajaWulan#2026', role: 'DOSEN' },
  { nama: 'Ahmad Rifa\'i', email: 'ahmad.rifai.pbjt@gmail.com', pass: 'BajaRifai#2026', role: 'DOSEN' },
  { nama: 'Ilham Sigit Dwi Arianto', email: 'ilham.sigit.pbjt@gmail.com', pass: 'BajaIlhamSigit#2026', role: 'DOSEN' },
  { nama: 'Heru Rohadi', email: 'heru.rohadi.pbjt@gmail.com', pass: 'BajaHeru#2026', role: 'DOSEN' },
  { nama: 'Tri Looke Darwanto', email: 'tri.looke.pbjt@gmail.com', pass: 'BajaTri#2026', role: 'DOSEN' },
  { nama: 'Imam Syafii', email: 'imam.syafii.pbjt@gmail.com', pass: 'BajaImam#2026', role: 'DOSEN' },
  { nama: 'Jarot Rudi Hartanto', email: 'jarot.hartanto.pbjt@gmail.com', pass: 'BajaJarot#2026', role: 'DOSEN' },
  { nama: 'Ahmad Jabidi', email: 'ahmad.jabidi.pbjt@gmail.com', pass: 'BajaJabidi#2026', role: 'DOSEN' },

  // KARYAWAN
  { nama: 'Dede Harisma', email: 'dede.harisma.pbjt@gmail.com', pass: 'BajaDede#2026', role: 'KARYAWAN' },
  { nama: 'Ali Rozan', email: 'ali.rozan.pbjt@gmail.com', pass: 'BajaAli#2026', role: 'KARYAWAN' },
  { nama: 'Agus Fathurokhman', email: 'agus.fathurokhman.pbjt@gmail.com', pass: 'BajaAgus#2026', role: 'KARYAWAN' },
  { nama: 'Agnes Safitri', email: 'agnes.safitri.pbjt@gmail.com', pass: 'BajaAgnes#2026', role: 'KARYAWAN' },
  { nama: 'Adinda Dwi Risky A', email: 'adinda.risky.pbjt@gmail.com', pass: 'BajaAdinda#2026', role: 'KARYAWAN' },
  { nama: 'Rokiman', email: 'rokiman.pbjt@gmail.com', pass: 'BajaRokiman#2026', role: 'KARYAWAN' },
];

async function main() {
  console.log('Mulai proses seeding data akun Dosen dan Karyawan...');
  
  // Ambil semua employee di DB
  const employees = await prisma.employees.findMany();
  
  let successCount = 0;
  let notFoundCount = 0;

  for (const user of usersToSeed) {
    // Cari employee dengan nama persis atau mengandung nama tsb
    let emp = employees.find(e => e.nama.trim().toLowerCase() === user.nama.trim().toLowerCase());
    
    // Jika tidak ketemu exact match, coba partial match
    if (!emp) {
      emp = employees.find(e => e.nama.toLowerCase().includes(user.nama.toLowerCase()) || user.nama.toLowerCase().includes(e.nama.toLowerCase()));
    }

    if (!emp) {
      console.warn(`[WARNING] Karyawan bernama '${user.nama}' tidak ditemukan di tabel employees. Akun tidak dibuat.`);
      notFoundCount++;
      continue;
    }

    // Cek apakah email sudah terdaftar
    const existingAdmin = await prisma.admins.findUnique({
      where: { email: user.email }
    });

    if (existingAdmin) {
      console.log(`[SKIP] Akun dengan email ${user.email} sudah ada.`);
      continue;
    }

    // Generate username dari email (sebelum @)
    const username = user.email.split('@')[0] || '';
    const password_hash = await bcrypt.hash(user.pass, 10);

    await prisma.admins.create({
      data: {
        username: username,
        password_hash: password_hash,
        email: user.email,
        full_name: user.nama,
        role: user.role, // DOSEN atau KARYAWAN
        employee_id: emp.user_id, // tautkan ke employee
        is_active: true
      }
    });

    console.log(`[OK] Berhasil membuat akun untuk: ${user.nama} (employee_id: ${emp.user_id})`);
    successCount++;
  }

  console.log('=============================================');
  console.log(`Seeding Selesai! Berhasil: ${successCount}, Tidak Ditemukan: ${notFoundCount}`);
  console.log('=============================================');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
