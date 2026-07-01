// Mengimpor modul dan tipe data yang diperlukan dari Prisma Client
import {
  PrismaClient,        // PrismaClient untuk berinteraksi dengan database MySQL
  employees_jabatan,   // Enum jabatan pegawai (Dosen, Karyawan, dll)
  attendance_jabatan,  // Enum jabatan pada log absensi
  employees_status,    // Enum status pegawai (Aktif, Nonaktif)
} from '@prisma/client';

// Mengimpor modul bawaan Node.js untuk operasi file system dan penanganan path file
import fs from 'fs';
import path from 'path';

// Inisialisasi instance PrismaClient untuk melakukan query database
const prisma = new PrismaClient();

// Fungsi utama yang menjalankan proses pembenihan (seeding) database secara terpadu
async function main() {
  // Menampilkan pesan log bahwa pembenihan database terpadu dimulai
  console.log('Starting unified database seed...');

  // 1. Membuat atau memperbarui data Shift default untuk Karyawan
  const shift = await prisma.shifts.upsert({
    // Menentukan pencarian berdasarkan Primary Key ID = 1
    where: { id: 1 },
    // Jika data shift sudah ada, tidak ada kolom yang perlu diubah (dibiarkan kosong)
    update: {},
    // Jika data shift belum ada, buat record shift baru dengan nilai default berikut
    create: {
      id: 1,                                        // ID unik shift
      nama_shift: 'Shift Regular Karyawan',         // Nama pengenal shift
      jam_masuk: new Date('1970-01-01T08:00:00Z'),  // Jam masuk standar (08:00 UTC)
      jam_keluar: new Date('1970-01-01T16:00:00Z'), // Jam pulang standar (16:00 UTC)
      deskripsi: 'Standard office shift for karyawan', // Keterangan tambahan shift
      is_active: true,                              // Menandai shift dalam keadaan aktif
    },
  });
  // Menampilkan pesan log bahwa data shift berhasil dibuat atau di-upsert
  console.log(`Upserted shift: ${shift.nama_shift}`);

  // 2. Membuat atau memperbarui data Perangkat (Fingerprint Device) default
  const device = await prisma.devices.upsert({
    // Menentukan pencarian perangkat berdasarkan ID perangkat 'FP-GEDUNG-A-001'
    where: { device_id: 'FP-GEDUNG-A-001' },
    // Jika perangkat sudah ada, lakukan pembaruan pada kolom alamat IP perangkat
    update: {
      ip_address: '175.17.5.50',
    },
    // Jika perangkat belum ada, buat record perangkat baru dengan konfigurasi berikut
    create: {
      device_id: 'FP-GEDUNG-A-001',                             // ID unik perangkat fingerprint
      device_name: 'ADMS Fingerprint - Gedung A Lantai 1',      // Nama tampilan perangkat
      ip_address: '175.17.5.50',                                // Alamat IP default perangkat
      location: 'Gedung A Lt.1 (Lobby Utama)',                  // Lokasi fisik pemasangan perangkat
      api_key_hash: '$2b$10$abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJK', // Hash API key default
      is_active: true,                                          // Mengaktifkan status perangkat
    },
  });
  // Menampilkan pesan log bahwa perangkat fingerprint berhasil di-upsert
  console.log(`Upserted device: ${device.device_name}`);

  // 3. Mengimpor data awal secara aman dari dump SQL (fingerprint_db.sql)
  const sqlPath = path.join(process.cwd(), 'fingerprint_db.sql'); // Menentukan path absolut berkas SQL dump
  
  // Memeriksa apakah berkas dump SQL ada di direktori project
  if (fs.existsSync(sqlPath)) {
    // Menampilkan log bahwa berkas dump SQL ditemukan dan akan diproses
    console.log('Found fingerprint_db.sql. Extracting and running INSERT statements safely...');
    
    // Membaca isi berkas SQL dump ke dalam buffer biner
    const buffer = fs.readFileSync(sqlPath);
    let sqlContent = ''; // Variabel penampung string SQL
    
    // Memeriksa keberadaan UTF-16 LE BOM (Byte Order Mark) untuk encoding file
    if (buffer[0] === 0xff && buffer[1] === 0xfe) {
      // Jika memiliki BOM UTF-16 LE, ubah buffer menjadi string ber-encoding utf16le
      sqlContent = buffer.toString('utf16le');
    } else {
      // Jika tidak, gunakan encoding UTF-8 standar
      sqlContent = buffer.toString('utf-8');
    }
    
    // Memecah seluruh isi teks SQL menjadi array baris berdasarkan karakter newline
    const lines = sqlContent.split(/\r?\n/);
    
    // Objek penampung untuk mengelompokkan baris INSERT berdasarkan nama tabel
    const inserts: Record<string, string[]> = {};
    
    // Melakukan iterasi di setiap baris dari file SQL
    for (const line of lines) {
      // Jika baris diawali dengan statemen "INSERT INTO"
      if (line.startsWith('INSERT INTO')) {
        // Ekstrak nama tabel yang dibungkus oleh tanda backtick (`)
        const match = line.match(/INSERT INTO `([^`]+)`/);
        
        // Jika nama tabel berhasil didapatkan
        if (match && match[1]) {
          const tableName = match[1]; // Dapatkan nama tabel
          let tableInserts = inserts[tableName]; // Ambil daftar baris insert yang sudah ada untuk tabel tersebut
          
          // Jika belum ada entri untuk tabel tersebut, buat array baru kosong
          if (!tableInserts) {
            tableInserts = [];
            inserts[tableName] = tableInserts;
          }
          
          // Ubah perintah "INSERT INTO" menjadi "INSERT IGNORE INTO" agar tidak terjadi error bentrok key unik
          let finalLine = line.replace('INSERT INTO', 'INSERT IGNORE INTO');
          
          // Penanganan khusus untuk tabel employees agar memperbarui jabatan dan is_active jika baris sudah ada
          if (tableName === 'employees') {
            finalLine = line.replace(';', ' ON DUPLICATE KEY UPDATE jabatan=VALUES(jabatan), is_active=VALUES(is_active);');
          }
          
          // Masukkan baris SQL final ke dalam daftar baris insert untuk tabel bersangkutan
          tableInserts.push(finalLine);
        }
      }
    }

    // Daftar urutan tabel yang akan dieksekusi agar mematuhi aturan Foreign Key (Dependency Order)
    const tableOrder = [
      'shifts',          // Berdiri sendiri (independen)
      'devices',         // Berdiri sendiri
      'admins',          // Tabel admin
      'employees',       // Tergantung pada shifts
      'holidays',        // Tabel libur nasional
      'password_resets', // Tergantung pada admins
      'attendance'       // Tergantung pada employees dan devices
    ];

    let insertCount = 0; // Penghitung jumlah blok tabel yang berhasil diproses
    
    // Lakukan perulangan eksekusi SQL berdasarkan urutan tabel yang aman
    for (const table of tableOrder) {
      const tableInserts = inserts[table]; // Ambil data INSERT untuk tabel saat ini
      
      // Jika ada baris SQL yang perlu dimasukkan untuk tabel saat ini
      if (tableInserts) {
        try {
          // Penanganan khusus keamanan: Bersihkan data admin lama sebelum memproses seeding
          if (table === 'admins') {
            console.log('Cleaning up existing admins table before seeding...');
            // Menjalankan query SQL mentah secara aman untuk mengosongkan tabel admins
            await prisma.$executeRawUnsafe('DELETE FROM `admins`');
          }
          
          // Menampilkan log jumlah batch yang akan dimasukkan ke tabel
          console.log(`Inserting data for table: ${table} (${tableInserts.length} batches)...`);
          
          // Eksekusi setiap baris query INSERT secara sekuensial menggunakan Prisma raw execution
          for (const sqlLine of tableInserts) {
            await prisma.$executeRawUnsafe(sqlLine);
          }
          insertCount++; // Tambahkan jumlah tabel yang berhasil diproses
        } catch (err: any) {
          // Tampilkan log error jika ada baris eksekusi SQL yang gagal
          console.error(`Failed to execute INSERT for ${table}:`, err.message);
        }
      }
    }
    // Menampilkan log sukses dengan jumlah blok tabel yang berhasil diimpor
    console.log(`Successfully executed ${insertCount} bulk INSERT blocks from SQL dump.`);
  } else {
    // Menampilkan log jika berkas SQL dump tidak ditemukan
    console.log('No fingerprint_db.sql found. Skipping SQL import.');
  }

  // 4. Mengimpor daftar Pegawai dari data ekspor biner mesin (seeds/employees_from_device.json)
  const jsonPath = path.join(process.cwd(), 'seeds/employees_from_device.json'); // Tentukan path berkas JSON
  let rawUsers: { userId: string; name: string }[] = []; // Inisialisasi penampung pegawai mentah
  
  // Memeriksa keberadaan file JSON pegawai mesin
  if (fs.existsSync(jsonPath)) {
    // Membaca konten string dari berkas JSON
    const rawData = fs.readFileSync(jsonPath, 'utf-8');
    // Melakukan parsing data JSON menjadi array objek javascript
    rawUsers = JSON.parse(rawData);
  } else {
    // Jika berkas tidak ada, tampilkan peringatan dan gunakan data simulasi cadangan
    console.warn('employees_from_device.json not found. Using default mock users.');
    rawUsers = [
      { userId: '3', name: 'Ilham_Akhsani' },
      { userId: '4', name: 'Slamet_Riyadi' },
      { userId: '5', name: 'Lily_Budinurani' },
      { userId: '6', name: 'Ria_Candra_Dewi' },
      { userId: '7', name: 'Atiek_Nurindriani' },
    ];
  }

  const employees = []; // Array untuk menampung data pegawai yang berhasil diproses
  
  // Melakukan iterasi untuk setiap user dari perangkat fingerprint
  for (const u of rawUsers) {
    // --- SUPER BLACKLIST MELINDA ---
    // Cegah Melinda (ID 1) masuk dari proses seeding, terlepas dari apa yang ada di file statis JSON
    if (u.userId === '1') {
      console.log(`[SEED BLACKLIST] Mengabaikan data bibit atas nama Melinda (ID 1).`);
      continue;
    }

    // Membuat atau memperbarui data pegawai berdasarkan user_id mesin fingerprint
    const emp = await prisma.employees.upsert({
      // Menentukan pencarian pegawai berdasarkan kolom unik user_id
      where: { user_id: u.userId },
      // Jika pegawai sudah ada, perbarui nama pegawai (jika disediakan) dan aktifkan kembali statusnya
      update: {
        ...(u.name && u.name.trim() !== '' ? { nama: u.name } : {}),
        is_active: true,
      },
      // Jika pegawai belum terdaftar di database, buat data pegawai baru
      create: {
        user_id: u.userId,                                                      // ID pegawai pada mesin fingerprint
        nama: (u.name && u.name.trim() !== '') ? u.name : `Karyawan_${u.userId}`, // Gunakan nama asli atau nama default berangka
        jabatan: employees_jabatan.KARYAWAN,                                    // Tetapkan jabatan default sebagai Karyawan
        shift_id: shift.id,                                                     // Hubungkan ke ID shift default yang telah dibuat
        status: employees_status.AKTIF,                                         // Tetapkan status keaktifan sebagai AKTIF
        is_active: true,                                                        // Tandai record pegawai dalam kondisi aktif
      },
    });
    employees.push(emp); // Masukkan data hasil proses ke penampung array
  }
  // Menampilkan log jumlah pegawai yang berhasil disinkronkan ke database
  console.log(`Upserted ${employees.length} employees from device.`);

  // Menampilkan pesan sukses akhir bahwa seluruh proses pembenihan database selesai
  console.log('Seed completed successfully!');
}

// Menjalankan fungsi utama seeding
main()
  // Menangani penangkapan error secara global jika ada proses utama yang gagal
  .catch((e) => {
    console.error(e); // Cetak pesan error
    process.exit(1);  // Keluar dari node process dengan kode status error 1
  })
  // Blok pembersihan yang selalu dijalankan setelah proses selesai atau gagal
  .finally(async () => {
    // Memutus koneksi Prisma Client ke database MySQL agar tidak memicu memory leak atau overload koneksi
    await prisma.$disconnect();
  });
