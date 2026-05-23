# 👨‍💻 Developer Guide (DEV.md)
**Panduan Lengkap Memahami Project Backend Finger untuk Pemula IT**

Halo! Selamat datang di project **Backend Finger**. Dokumen ini dibuat khusus untuk membantu kamu yang mungkin masih baru di dunia pengembangan sistem backend, Node.js, atau TypeScript. 

Bahasa di sini dibuat sesederhana mungkin agar kamu bisa cepat paham cara kerja aplikasi ini dari hulu ke hilir.

---

## 1. 🌟 Apa itu Project Backend Finger?

Sistem absensi kampus biasanya menggunakan mesin sidik jari (fingerprint) seperti merek **ZKTeco**. Mesin ini punya data absen (siapa yang scan dan jam berapa). Tapi, mesin ini tidak bisa langsung menampilkan datanya ke halaman web atau dashboard HRD.

**Di sinilah Backend Finger berperan.**

Aplikasi ini bertugas sebagai **"Jembatan"** antara:
1. **Mesin Fingerprint ZKTeco** (di jaringan lokal kampus).
2. **Database MySQL** (tempat menyimpan data absensi).
3. **Frontend / Dashboard Web** (tempat Admin/HRD melihat rekap absen).

Aplikasi ini akan **menarik data secara otomatis** dari mesin, mengolahnya (mengecek apakah itu jam masuk atau pulang), lalu menyimpannya rapi di database.

---

## 2. 🚀 Panduan Setup Detail (Langkah-demi-Langkah)

Panduan ini didesain agar aplikasi dapat berjalan 100% dengan sukses di komputermu, dari tahap awal sampai server menyala. Ikuti secara berurutan.

### Langkah 1: Persiapan Aplikasi

1. Buka terminal (Command Prompt / PowerShell / Git Bash) di komputer Anda.
2. Masuk ke direktori `backend-finger`:
   ```bash
   cd backend-finger
   ```
3. Install seluruh dependensi (paket Node.js) yang dibutuhkan:
   ```bash
   npm install
   ```
   *(Tunggu sampai proses selesai. Perintah ini akan mengunduh semua pustaka Node.js dari internet dan menginstal alat-alat seperti TypeScript).*

### Langkah 2: Konfigurasi Environment (`.env`)

Aplikasi butuh "buku alamat" (konfigurasi) agar tahu cara terhubung dengan database dan mesin fingerprint.

1. Salin template `.env.example` menjadi file baru bernama `.env`. Jika menggunakan terminal Windows/PowerShell:
   ```bash
   cp .env.example .env
   ```
   *(Atau kamu bisa copy-paste file `.env.example` secara manual di File Explorer lalu ganti namanya menjadi `.env`)*
2. Buka file `.env` menggunakan kode editor (VS Code, Notepad, dll).
3. **Konfigurasi Database MySQL**: 
   - Jika kamu menggunakan **Laragon**, servis MySQL umumnya tidak menggunakan password (`root` dan kosong).
   - Pastikan variabel `DATABASE_URL` diisi dengan benar.
   ```env
   DB_HOST=localhost
   DB_PORT=3306
   DB_NAME=finger_db
   DB_USERNAME=root
   DB_PASSWORD=      # Kosongkan jika pakai Laragon default tanpa password
   
   # PENTING (Wajib sama dengan password MySQL kamu):
   # Jika Laragon tanpa password, tulis seperti ini:
   DATABASE_URL=mysql://root:@localhost:3306/finger_db
   ```
4. **Konfigurasi Fingerprint & JWT**:
   - Pastikan `JWT_ACCESS_SECRET` dan `JWT_REFRESH_SECRET` diisi dengan kalimat acak yang panjang agar aman (minimal 32 karakter).
   - `FINGERPRINT_IP` diisi dengan IP alat absen (contoh: `192.168.1.201`). Jika kamu belum punya alat fisik, biarkan apa adanya, backend tetap bisa menyala.

### Langkah 3: Setup Database MySQL

Pastikan aplikasi MySQL kamu (misalnya **Laragon** atau **XAMPP**) sudah dalam keadaan **Start/Running**.

1. Buka pengelola MySQL Anda (contoh: klik tombol **Database** di Laragon / buka phpMyAdmin / buka HeidiSQL).
2. Buat database kosong baru dengan nama `finger_db`:
   ```sql
   CREATE DATABASE finger_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```
3. Kembali ke terminal di VS Code (pastikan kamu masih berada di dalam folder `backend-finger`).
4. Sinkronkan bentuk tabel-tabelnya (Schema Prisma) ke dalam MySQL:
   ```bash
   npx prisma db push
   ```
   *(Perintah ini akan secara ajaib membuatkan semua tabel yang dibutuhkan ke dalam databasemu!)*
5. Masukkan data-data contoh (Data shift, jadwal karyawan awal, dan akun Admin) dengan perintah:
   ```bash
   npm run db:setup
   ```
   *Jika sukses, akan muncul pesan berwarna hijau: `✅ All data loaded successfully!`*

### Langkah 4: Menjalankan Server Backend

Setelah database siap, mari kita nyalakan mesin utamanya!

```bash
npm run dev
```

Jika berhasil, terminal akan memunculkan tulisan seperti ini:
```text
✅ MySQL connected to database (Prisma)
[ZkSyncService] Attendance sync listener attached.
[ZkDeviceClient] Starting polling loop → 192.168.1.201:4370
✅ ZKTeco Biometric client started successfully (Direct Hardware Integration)
✅ Application initialized successfully
🚀 Server berjalan di port 3333
🧪 Try It (Swagger UI): http://localhost:3333/finger-api/docs
```
🎉 **Selesai!** Backend kamu sudah hidup dan siap melayani permintaan dari Frontend. 
Silakan buka browser dan tes API di `http://localhost:3333/finger-api/docs`.

---

## 3. ⚙️ Cara Kerja Sistem (Flow Sederhana)

Bayangkan aplikasi ini seperti **petugas resepsionis yang rajin**:

1. **Koneksi Otomatis**: Saat server dinyalakan (`npm run dev`), aplikasi akan langsung mencoba mencari mesin fingerprint di alamat IP tertentu.
2. **Tanya Mesin (Polling)**: Setiap 5 detik, aplikasi akan "bertanya" ke mesin: *"Hai, ada data absen baru tidak?"*. Proses bertanya berulang-ulang ini disebut **Polling**.
3. **Ambil & Cocokkan Data**: Jika ada orang yang baru saja menempelkan jarinya, mesin akan mengirim data. Aplikasi akan mencari tahu menggunakan tabel `employee_device_mapping`.
4. **Simpan ke Database**: Setelah tahu NIP-nya, aplikasi akan menyimpan data tersebut ke database MySQL. Jika jam 08:00, dicatat sebagai `jam_masuk`.
5. **Kirim ke Web (API)**: Jika Admin membuka web dashboard, web tersebut akan meminta data absen. Aplikasi kita akan mengambil data dari MySQL dan mengirimkannya ke web.

---

## 4. 🛠️ Teknologi yang Digunakan (Tech Stack)

Jangan bingung dengan istilah-istilah ini, berikut penjelasannya:

*   **Node.js**: Lingkungan untuk menjalankan bahasa JavaScript/TypeScript di server (backend), bukan di browser.
*   **TypeScript**: Bahasa pemrograman turunan JavaScript. Bedanya, TypeScript lebih ketat (punya tipe data). Jadi kalau kita salah tulis variabel, error-nya ketahuan sebelum program dijalankan. Sangat membantu mengurangi bug!
*   **Express.js**: Framework untuk membuat REST API (jalur komunikasi agar frontend bisa minta data ke backend).
*   **Prisma ORM**: Alat yang mempermudah kita ngobrol dengan database. Kita tidak perlu menulis perintah SQL manual (seperti `SELECT * FROM...`), cukup gunakan kode yang mudah dibaca seperti `prisma.employees.findMany()`.
*   **MySQL**: Tempat penyimpanan datanya (Database relational).
*   **node-zklib**: "Penerjemah" khusus agar aplikasi kita bisa mengerti bahasa mesin ZKTeco.

---

## 5. 📂 Memahami Struktur Folder Utama

Tidak semua folder harus kamu pahami sekarang. Fokus ke folder `src/` saja:

```text
backend-finger/
├── src/
│   ├── config/        👉 Pengaturan awal (Database, Error, Lingkungan .env)
│   ├── controllers/   👉 "Otak" yang memproses permintaan dari Frontend (Logika Bisnis)
│   ├── infrastructure/👉 Kode khusus untuk ngobrol dengan alat luar (Mesin Fingerprint)
│   ├── routes/        👉 Daftar alamat URL (Contoh: "/api/attendance" mengarah ke mana)
│   ├── services/      👉 "Tangan kanan" controller, proses rumit seperti Sync ke ZKTeco
│   └── app.ts & server.ts 👉 Tempat aplikasi pertama kali dijalankan (Titik Mulai)
├── prisma/            👉 Berisi bentuk tabel database (schema.prisma)
└── scripts/           👉 Skrip bantuan seperti menambah pegawai dari terminal
```

---

## 6. 🔑 Konsep Kunci untuk Pemula

### A. Apa itu REST API & Endpoint?
API itu seperti **Pelayan Restoran**. Frontend (Pelanggan) memesan makanan (Data), API (Pelayan) mengambil pesanan, pergi ke Dapur (Database/Backend), dan memberikan makanannya ke Pelanggan.

**Endpoint** adalah alamat pesannya. Contoh:
- `GET /api/attendance` 👉 Pelanggan minta daftar absen.
- `POST /api/auth/login` 👉 Pelanggan kirim username & password untuk masuk.

### B. Apa itu JWT (JSON Web Token)?
Seperti **Kartu Akses / ID Card**. Saat user berhasil Login, backend akan memberikan JWT. Untuk setiap permintaan berikutnya, user harus melampirkan JWT ini agar backend tahu bahwa dia adalah orang yang sah.

### C. Mengapa disebut "Idempoten"?
Kata ini sering muncul di project ini. **Idempoten** berarti: *Biarpun sebuah proses diulang 100 kali, hasilnya tetap sama seperti dilakukan 1 kali.*
Contoh: Mesin fingerprint sering ngirim data absen yang sama berulang kali. Tapi aplikasi kita didesain pintar, jadi datanya tidak akan dobel/ganda di tabel MySQL.

---

## 7. 🛣️ Alur Membaca Kode (Contoh Kasus)

Biarkan kita ikuti apa yang terjadi saat Frontend meminta **Daftar Absensi**:

1. **User membuka Web**: Web menembak URL `GET /api/attendance`.
2. **Masuk ke Route**: Buka file `src/routes/attendance.routes.ts`. Di situ tertulis kalau ada request `GET /`, teruskan ke controller.
3. **Masuk ke Controller**: Buka file `src/controllers/attendance.controller.ts`. Di sinilah logika pagination dan validasi NIP terjadi.
4. **Masuk ke Prisma (Database)**: Di dalam controller itu, ada kode `prisma.attendance.findMany(...)`. Ini tugasnya mengambil data absensi dari MySQL.
5. **Kembali ke Web**: Data yang didapat di-format menjadi struktur JSON (`{ "success": true, "data": [...] }`), lalu dikirim balik ke Frontend.

---

## 8. 🚀 Cara Menambah Fitur Baru

Jika atasanmu meminta fitur baru (misal: "Buat API untuk melihat detail shift"), ini langkahnya:

1. **Buat Model (Jika perlu tabel baru)**: Tambahkan tabel di `prisma/schema.prisma` lalu jalankan `npx prisma db push`.
2. **Buat Route**: Buat file di folder `src/routes/` (misal `shift.routes.ts`).
3. **Buat Controller**: Buat file di folder `src/controllers/` (misal `shift.controller.ts`). Tulis logika ambil data di situ menggunakan `prisma.shifts.findMany()`.
4. **Daftarkan Route**: Buka `src/app.ts`, pastikan route barumu di-import dan ditambahkan dengan `app.use(...)`.

---

## 💡 Tips Terakhir & Pemecahan Masalah (Troubleshooting)

- **Port 3333 is already in use**: Artinya server sebelumnya nyangkut di memori komputer. Buka terminal/PowerShell dan ketik: `taskkill /F /IM node.exe`, lalu jalankan `npm run dev` lagi.
- **ECONNREFUSED / Database Error**: Artinya aplikasi gagal terhubung ke MySQL. Pastikan Laragon/XAMPP menyala dan periksa kembali konfigurasi `DATABASE_URL` di file `.env`.
- **Jangan takut pesan Error!** Di TypeScript, jika ada kode yang digaris bawahi merah, arahkan mouse ke sana. Editor (VSCode) akan memberi tahu persis apa yang salah.
- **SELALU** jalankan `npx prisma db push` setelah mengubah file `schema.prisma`.

Selamat ngoding! Pelan-pelan saja, backend development itu sangat menyenangkan kalau kita sudah paham alurnya. 😊
