# BAB III - METODE PENELITIAN DAN PERANCANGAN SISTEM

## 3.1 Kerangka Kerja Penelitian
Penelitian ini menggunakan model pengembangan sistem *Waterfall* (atau *Iterative* disesuaikan dengan laporan Anda) yang mencakup tahap analisis kebutuhan, perancangan sistem, implementasi, pengujian, dan pemeliharaan. Pendekatan perancangan backend diarahkan pada pembuatan RESTful API yang melayani pengelolaan data kehadiran dosen dan karyawan.

## 3.2 Analisis Kebutuhan Sistem
### 3.2.1 Kebutuhan Fungsional
1. Sistem backend harus mampu mengambil data sidik jari secara langsung (Direct TCP/UDP Connection) dari perangkat ZKTeco X100-C.
2. Sistem harus bisa melakukan klasifikasi sesi kehadiran (Pagi dan Malam) serta menyeleksi satu rekam kedatangan awal (*first scan*) dan satu rekam purna-waktu (*last scan*) setelah interval minimum 120 menit.
3. API harus teramankan dengan JSON Web Tokens (JWT) agar hanya admin yang sah yang dapat mengelola data master.
4. Sistem harus mampu menerima masukan impor dari format berkas Excel (.xlsx) sebagai alternatif data absensi.

### 3.2.2 Kebutuhan Non-Fungsional
1. Sistem berjalan optimal menggunakan lingkungan Node.js dengan latensi minimal.
2. Memanfaatkan arsitektur keamanan yang mencegah penipuan manipulasi sesi melalui penguncian *Mutex (Mutual Exclusion)* untuk sinkronisasi paralel.
3. Basis data harus mampu menangani kueri agregat yang stabil tanpa dipengaruhi perbedaan zona waktu (Timezone safe).

## 3.3 Perancangan Arsitektur Sistem
Sistem dibangun mengadopsi pola *Modular Monolith*. Arsitektur dibangun ke dalam beberapa lapisan abstrak (*Layered Architecture*) untuk mempertahankan *Separation of Concerns (SoC)*:
1. **Lapis Infrastruktur (Anti-Corruption Layer)**: Modul `zk-client.ts` yang berinteraksi dengan protokol *proprietary* milik ZKTeco dan menerjemahkannya agar sesuai model data aplikasi.
2. **Lapis Layanan (Service Layer)**: Modul utama seperti `zk-sync.service.ts` yang meregulasi hukum dan regulasi presensi instansi, seperti menangani pengecekan *gap 120 menit* untuk absensi keluar.
3. **Lapis Pengendalian (Controller Layer)**: Memaparkan format balasan (respons) standar JSON lewat *framework* Express.js.
4. **Lapis Akses Data (Data/ORM Layer)**: Menggunakan Prisma ORM pada *database* MySQL untuk konsistensi transitif serta transaksi atomik database.

## 3.4 Desain Basis Data
Struktur basis data relasional dikelola melalui Prisma Schema yang mencakup entitas fundamental:
- **Employees (`employees`)**: Mendata hierarki NIP, tipe identitas mesin (*user_id*), Nama, dan Jabatan (Dosen/Karyawan).
- **Attendance (`attendance`)**: Memuat transkripsi absensi berelasi berdasarkan tanggal harian beserta jam masuk, jam keluar, catatan admin, serta indikator keterlambatan logis.

---

# BAB IV - HASIL DAN PEMBAHASAN

## 4.1 Implementasi Lingkungan Pengembangan
Sistem Backend ini diimplementasikan menggunakan bahasa pemrograman TypeScript 5.x berjalan di atas Node.js 20.x. *Database* ditangani oleh MySQL 8.x. Layanan ZKTeco disinkronkan melalui kanal soket LAN TCP/UDP pada *port* standar 4370.

## 4.2 Hasil Pembangunan Sistem (REST API)
Aplikasi mempresentasikan RESTful API yang tangguh yang mendanai keseluruhan sistem.
### 4.2.1 Sistem Tarik Data (Pull Sync Machine)
Pengujian metode penyedotan log mesin diuji menggunakan modul pengaya `ZkTcpClient`. Pada pembuktiannya, sistem sanggup menghindari konflik penggandaan baris *log* berkat validasi lapis kedua (Database `findFirst` periksa tanggal) dan penjagaan *Concurrency Lock*. Log tidak dibiarkan terduplikasi meskipun tombol Sinkronisasi diputar berkali-kali.

### 4.2.2 Pengolahan Logika Sesi Ganda & Jeda Otomatis
Sistem yang dinamis ini tidak lagi mewajibkan pengguna menekan tombol spesifik "Masuk" atau "Pulang" pada mesin secara mekanis. Pengembangan perantara *waktu gap* pada pangkalan fungsi sinkronisasi mencatat rekam pertama (misalnya 08:00) sebagai *Jam Masuk*. Rekam baru (misal 11.00) yang terjadi tiga jam berikutnya akan diidentikasi cerdas sebagai *Jam Keluar*. Ini berhasil menanggulangi masalah kelalaian pegawai menekan status tombol kepulangan di mesin yang kerap menjadi keluhan.

### 4.2.3 Pencegahan Data Hantu (Type Coercion Issue Handling)
Penyikapan bug terkait ID pengguna yang meresap pasca-penghapusan berhasil dihadang dengan pencegahan *Type-Safe Blacklist*. Memori hardware X100-C cenderung melempar UID bertipe data asli (*number*). Implementasi di dalam logika layanan di-_casting_ kembali secara brutal (*String casting*) agar identitas-identitas tak dikehendaki disaring penuh. 

## 4.3 Pengujian Endpoint (Postman / API Docs)
Hasil dokumentasi memunculkan laman API Swagger Interaktif yang disediakan sistem. Pengujian memuat skenario operasional krusial:
1. Otentikasi dan *Rate Limiting* (Berhasil, JWT dicegat saat tidak berhak).
2. Tampilan *Live Board* Dashboard: Memuat data tanpa pembatasan feed (*take: nolimit*), sukses menampilkan garis log absensi tepat di hari yang seragam tanpa mengorbankan stabilitas urutan.
3. Impor/Eksport Lembar *Excel* berjalan lancar pada berkas kompleks.

## 4.4 Evaluasi dan Pembahasan
Aplikasi Backend ini menyanggupi beban administrasi secara otomatis, menekan tingkat kesalahan pendataan sekunder (Dosen versus Karyawan), dan sanggup menghalau inkonsistensi waktu karena masalah zona (UTC offset errors) yang dipatenkan ke dalam format sinkronisasi mentah. Hasilnya berdampak positif memodernisasi pelaporan serta menyajikan antarmuka murni bebas modifikasi campur tangan mesin biometrik yang usang.
