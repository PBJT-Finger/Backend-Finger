# BAB III
# METODE PENELITIAN DAN PERANCANGAN SISTEM

## 3.1 Metode Pengumpulan Data
Metode Pengumpulan data yang digunakan dalam penelitian ini adalah:
1. **Observasi**
Tahap awal adalah melakukan pengamatan secara langsung pada proses pencatatan kehadiran dosen dan karyawan, mengamati infrastruktur jaringan dan bagaimana transfer data absensi dari mesin pemindai sidik jari ZKTeco menuju ke pusat pelaporan guna mengidentifikasi kelemahan sistem lama.
2. **Wawancara**
Kegiatan wawancara dilakukan dengan melakukan proses interaksi dan komunikasi tanya jawab terhadap pihak-pihak pengelola administrasi serta petugas IT kampus yang bertanggung jawab memanajemen kehadiran. Hal ini dilakukan untuk menggali informasi terkait prosedur absensi dan kendala rekapitulasi data.
3. **Dokumentasi**
Teknik dokumentasi digunakan untuk mengumpulkan spesifikasi teknis mesin ZKTeco X100-C, berkas-berkas laporan absensi sebelumnya (berupa *spreadsheet* Excel), serta kebutuhan pencatatan *shift* kerja (sesi pagi dan malam).
4. **Studi Pustaka**
Mengkaji literatur dan referensi komprehensif terkait teknik sinkronisasi data biometrik secara langsung (*direct TCP/UDP socket*), implementasi RESTful API menggunakan Node.js dan Express, serta optimasi basis data relasional.

## 3.2 Metode Pengembangan Sistem 
Penelitian ini menggunakan pendekatan rekayasa perangkat lunak (*software engineering*) yang bertujuan untuk merancang, mengembangkan, dan mengimplementasikan sistem backend absensi biometrik. Metode yang digunakan adalah model **Waterfall**, karena memberikan tahapan yang terstruktur dan sistematis untuk proyek yang spesifikasi alurnya jelas sejak awal.

Model ini meliputi langkah-langkah yang berurutan untuk menciptakan sistem backend yang beroperasi secara efektif. Pendekatan ini dimulai dari penentuan kebutuhan, perencanaan arsitektur, pembuatan model (*schema database*), pembangunan logika sinkronisasi (*development*), hingga penyerahan dan peluncuran produk:
a. **Analisis Kebutuhan**
Analisis dilakukan melalui studi kelayakan sistem absensi manual. Hasilnya, diperlukan sistem *backend* yang sanggup menarik data sidik jari langsung dari mesin (koneksi UDP/TCP), memiliki fitur seleksi otomatis untuk masuk dan pulang antar sesi, menghalau duplikat klik/scan dari pengguna, dan menyediakan *endpoint* data bagi antarmuka web.
b. **Perancangan Sistem**
Tahapan ini mencakup perancangan arsitektur *backend* menggunakan Node.js dan Express, serta lapisan ORM Prisma. Sistem dibangun modular menjadi API terpisah seperti: autentikasi, manajemen mesin (_device sync_), pengelolaan log kehadiran, dan ekspor pelaporan (*Excel/PDF*).
c. **Implementasi**
Sistem dikembangkan (*coding*) secara utuh. Logika bisnis difokuskan pada `zk-sync.service.ts` untuk menangani algoritma filter waktu jeda asinkron (minimal 2 jam antar absen) guna menutup celah kebingungan pergantian sesi, serta integrasi lapisan keamanan otentikasi JWT pada *middlewares*.
d. **Pengujian**
Sistem diuji dengan skenario metode *black box testing*, mengevaluasi setiap *endpoint* API (memakai Postman) tanpa melibatkan kode internal guna menjamin fungsionalitas utama seperti sinkronisasi TCP dan proteksi keamanan otentikasi berjalan sebagaimana spesifikasi.
e. **Pemeliharaan**
Tahap akhir melibatkan monitor log sistem (*error logs*), perawatan *database* secara rutin, dan integrasi penambalan *bug* yang dideteksi melalui tahap penggunaan harian oleh staf administrasi.

## 3.3 Alat dan Bahan
Dalam pengembangan sistem absensi backend ini, digunakan beberapa alat dan bahan yang terdiri dari perangkat lunak (*software*) dan perangkat keras (*hardware*):
1. **Perangkat Lunak (Software)**:
   a. **Node.js (v20.x)** : *Runtime* utama berkecepatan tinggi tempat backend beroperasi.
   b. **Express.js & TypeScript** : *Framework* web API utama.
   c. **Prisma ORM** : Pengelola *Database* dan pembuat skema (*Schema builder*).
   d. **MySQL (v8.x)** : Digunakan sebagai basis data relasional.
   e. **Postman / Swagger UI** : Digunakan untuk pengujian URL dan *Endpoint API*.
   f. **Visual Studio Code** : Teks editor utama pengelolaan bahasa pemrograman.
   g. **Laragon / XAMPP** : Pendukung *web-server* lokal pengujian database.
2. **Perangkat Keras (Hardware)**:
   a. Mesin Sidik Jari Presensi: *ZKTeco X100-C*.
   b. Laptop Pengembangan: *Prosesor kelas menengah, 8 GB RAM, dan SSD*.

---

# BAB IV
# HASIL DAN PEMBAHASAN

## 4.1 Hasil
Berdasarkan keluhan yang dimonitor di instansi pendidikan terkait, ditemukan sejumlah kendala dalam mengelola data kehadiran Dosen dan Karyawan secara sekunder. Pengambilan rekaman absensi sebelumnya mewajibkan pengelola untuk menarik data logikal mesin secara manual via perangkat eksternal dengan durasi yang tak efisien (via USB atau software usang bawaan), yang membuat sistem kewalahan dalam memetakan sesi Masuk dan Pulang (utamanya saat pengguna tidak menekan tombol yang tepat di mesin biometrik).
Menanggapi masalah akut tersebut, sistem backend pintar yang adaptif telah sukses dibangun. Sistem RESTful API menggunakan arsitektur Node.js yang ditugaskan untuk menghisap/menarik data dari ZKTeco secara digital (*Live Pull*) secara _autonomous_ maupun manual. Lewat pemeringkatan filter jeda logis 120 menit dan penyesuaian zona waktu, Dosen tidak lagi dikhawatirkan gagal terekap absensinya. Sistem menghasilkan _output_ terpusat, mempermudah admin dan terintegrasi aman di tingkat infrastruktur.

## 4.2 Pembahasan
Proses pengembangan terpadu diawali atas analisis kebutuhan yang secara utuh membangun landasan perancangan sistem, hingga menuju implementasi *backend* dan visualisasinya di antarmuka web.
1. **Analisis Kebutuhan**
   Kebutuhan identifikasi melahirkan beberapa fungsi sentral:
   a. **Sinkronisasi Perangkat Biometrik (*Zk-Client*)**
      Modul _backend_ wajib melahirkan protokol koneksi ke alamat IP ZKTeco.
   b. **Pengelolaan Data Absensi Otomatis**
      Admin dapat melihat baris log presensi yang menyeleksi scan ganda per-sesi secara mandiri.
   c. **Otentikasi Berlapis Administrasi**
      Pemrosesan data terbatas hanya kepada *User* (Admin) sah melalui otorisasi *bearer token*.
2. **Perancangan Sistem**
   Desain terstruktur menggambarkan aliran sistem sebelum dimodelkan dalam bahasa pemrograman:
   a. **Diagram Use Case**
      (*Tempatkan Gambar Use Case: Admin mengelola Master Data, Menarik Log Kehadiran, Cetak Rekap*)
   b. **Diagram Alir (Flowchart)**
      (*Tempatkan Gambar Flowchart: Aliran data sinkronisasi TCP/UDP perangkat ZKTeco ke MySQL MySQL Database*)
   c. **ERD (Entity Relationship Diagram)**
      Pada sistem absensi, entitas sentral dirancang sebagai berikut:
      - **Tabel Employees**: Menyimpan rincian master pegawai (NIP, Nama, user_id sinkronisasi mesin, Jabatan: DOSEN/KARYAWAN, Status Aktif).
      - **Tabel Attendance**: Mendata absensi konklusif berisi ID Karyawan, Tanggal Transaksi, Waktu Jam Masuk, Jam Keluar, Sesi, Status Keterlambatan, dan Catatan Admin.
      - **Tabel Devices**: Katalog spesifikasi mesin sidik jari yang terafiliasi pada jaringan lokal kampus.
   d. **Desain API**
      Sistem disusun menggunakan rute HTTP baku. Tabel operasi Endpoint:
      - `POST /api/auth/login` : Autentikasi token akses.
      - `GET /api/dashboard/summary` : Penarikan rekapan statistik hari ini dan feed live-scan.
      - `GET /api/attendance` : Daftar lengkap pemuatan rekapan log paginasi.
      - `POST /api/device/:id/sync` : Menghidupkan *trigger* penarikan log sidik jari dari memori ZKTeco.

3. **Implementasi Sistem**
   Penerjemahan algoritma tertuang ke halaman web visual (*Frontend Integration*).
   a. **Halaman Dashboard & Live Scanner**
      Setelah login, administrator akan disajikan beranda dengan *Feed Log* otomatis (`take: all hari ini`) dan indikator hadir secara persentase tanpa delay.
   b. **Halaman Tarik Data Users (Registrasi)**
      Fitur pemetaan pengguna (*Mapping*). Mengandung mekanisme keamanan (*Type-Safe String*) yang membentengi antarmuka dari pengguna hantu/tidak valid *(blacklist ID)* agar tidak diregistrasi ulang ke database.
   c. **Halaman Rekapitulasi (Lecturer & Employee)**
      Memuat daftar final presensi masuk-keluar pasca filterisasi jeda (*gap* 120 menit).

## 4.3 Pengujian Sistem
Siklus verifikasi tahap purna difokuskan menguji luaran fungsionalitas dan keandalan respons server *REST API*.

1. **Uji Coba BlackBox Testing**
   Dilakukan lewat perantara web (*Frontend*). Tabel matriks uji:
   - **Login Admin**: Uji kredensial `superadmin` beserta penolakan *password* keliru. (Hasil: Respon *Unauthorized* dan sesi dijaga).
   - **Simulasi Tarik Data Log (Sinkronisasi)**: Melakukan ratusan klik *spam* tarik absensi dari mesin. (Hasil: Berhasil diisolasi oleh *Mutex-Lock*, tidak terjadi data ganda sama sekali).
   - **Tampilan Live History**: Menganalisa susunan log harian saat pagination berganti angka. (Hasil: Tabel stabil tak acak sebab penyortiran ketat berdasarkan jam\_masuk).
2. **Uji Coba Postman (Backend Tests)**
   Konsistensi kontrak API divakidasi:
   - Endpoint `GET /api/attendance` di Postman mengembalikan balasan (HTTP `200 OK`) berupa *array JSON payload* absensi berserta nilai paginasi dan limit baris.
   - Endpoint Pengunggahan Dokumen Excel (`POST /api/attendance/import`) diserang dengan format anomali. Sistem secara tangguh merespon kode (HTTP `400 Bad Request`) jika format tabel gagal diurai.

Hasil eksplorasi membuktikan sistem kebal dari beban manipulasi, merespon dalam kecepatan milidetik, mencegah *Type Coercion bug*, serta menyerap beban lalu-lintas data secara efektif sehingga siap untuk tahap adopsi lingkungan operasional nyata.
