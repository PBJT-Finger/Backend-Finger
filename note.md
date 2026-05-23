# Master Integration Plan: ZKTeco Edge-to-Web Architecture
**Document Owner:** System Architecture Team
**Target Device:** Solution X100-C (ZKTeco OUI)
**Edge IP:** 192.168.137.15 (Static, L2 Verified)
**Protocol:** UDP over Port 4370 (ZKTeco Proprietary)

---

## 1. Executive Summary
Dokumen ini menguraikan cetak biru arsitektur untuk mengintegrasikan perangkat biometrik *edge* ke dalam ekosistem aplikasi web modern. Arsitektur ini menggunakan pola **Edge Gateway** yang bertindak sebagai *Anti-Corruption Layer (ACL)* untuk menerjemahkan protokol TCP/UDP *proprietary* menjadi standar HTTP/REST atau *Event Stream*. Desain ini menjamin pemisahan fokus (*Separation of Concerns*), memastikan aplikasi web inti terisolasi dari kompleksitas dan latensi jaringan *hardware*, serta menerapkan prinsip *Security-First* di mana perangkat fisik tidak pernah diekspos langsung ke internet publik.

---

## 2. Technical Implementation: Development Phases

### Phase 1: Edge Middleware Development (Node.js)
Fokus: Membangun jembatan komunikasi yang aman dan tangguh di jaringan lokal.
* **Tech Stack:** Node.js (Express.js), `node-zklib`, PM2 / Docker.
* **Tasks:**
    * [x] Konfigurasi IP Statis perangkat (`192.168.137.15`).
    * [x] Implementasi skrip *Connection Probe* dengan penanganan error idiomatik (Selesai).
    * [ ] Membangun RESTful API internal (`/api/v1/attendance`, `/api/v1/users`).
    * [ ] Mengimplementasikan *Auto-Reconnect* & *Exponential Backoff* jika koneksi UDP *timeout*.

### Phase 2: Data Ingestion & Persistence (The Web Backend)
Fokus: Menerima data dari *Edge Middleware* dan menyimpannya secara efisien tanpa memblokir *Event Loop*.
* **Tech Stack:** Node.js/Go/Python (Backend Web), PostgreSQL/MySQL (RDBMS), Redis (Opsional untuk *Rate Limiting/Caching*).
* **Tasks:**
    * [ ] Desain skema *Database* relasional (Tabel `Employees`, `Devices`, `Attendance_Logs`).
    * [ ] Pembuatan *Webhook endpoint* atau *Pull Cron-Job* untuk sinkronisasi data dari *Middleware*.
    * [ ] Implementasi algoritma *Idempotency* saat *insert* log absensi (mencegah duplikasi data jika jaringan terputus di tengah proses).

### Phase 3: Message Brokering (For Scaling - Optional but Recommended)
Fokus: Asynchronous processing untuk *load* tinggi.
* **Tech Stack:** Apache Kafka / RabbitMQ / Redis PubSub.
* **Tasks:**
    * [ ] *Middleware* bertindak sebagai *Producer*, mem- *publish* *event* `ATTENDANCE_RECEIVED`.
    * [ ] Web Backend bertindak sebagai *Consumer*, memproses antrean dan melakukan *Bulk Insert* ke database. Kompleksitas operasi sinkronisasi diubah dari $O(N)$ *per-request* menjadi operasi *Batch* $O(1)$ untuk efisiensi CPU/Memori.

### Phase 4: Web Application Integration (Frontend)
Fokus: Visualisasi data absensi secara *real-time* atau *near real-time*.
* **Tech Stack:** React.js / Vue.js, TailwindCSS.
* **Tasks:**
    * [ ] Integrasi *dashboard* absensi harian/bulanan.
    * [ ] Indikator status perangkat (*Online/Offline*) menggunakan *Server-Sent Events (SSE)* atau *WebSocket*.

---

## 3. Deep Dive Explanation: Architectural Patterns

1.  **Anti-Corruption Layer (ACL):** Aplikasi web utama dilarang keras mengimpor `node-zklib` atau berinteraksi dengan UDP. Semua komunikasi *hardware* diisolasi di *Edge Middleware*. Jika esok hari perusahaan mengganti mesin dari ZKTeco ke *brand* lain (misal: Hikvision), hanya *Middleware* yang perlu ditulis ulang, *Web Backend* tetap utuh (Mematuhi **Open/Closed Principle** dari SOLID).
2.  **Idempotent Data Sync:** Pengambilan data absensi rentan terhadap redudansi. Desain sistem menggunakan `deviceUserId` dan `timestamp` sebagai *Composite Unique Key* di database SQL. Pendekatan ini memastikan operasi `UPSERT` (Update or Insert) yang aman, mencegah *dirty reads* atau *duplicate logs*.
3.  **Memory Management:** Data yang ditarik dari mesin bisa berjumlah puluhan ribu baris. Alih-alih memuat semuanya ke dalam *array* memori di Node.js sekaligus (yang memicu *Garbage Collection Pause*), data harus diproses menggunakan pola *Streaming* atau *Chunking* (misal: 1000 baris per iterasi).

---

## 4. Deployment & Scaling Strategy

1.  **Containerization:** * *Edge Middleware* di- *build* ke dalam `Dockerfile` berbasis Alpine Linux untuk meminimalkan *attack surface*.
2.  **Orchestration (Kubernetes/Docker Swarm):**
    * Jika mengelola >5 perangkat di berbagai cabang, *Middleware* di-*deploy* sebagai *Pod* independen per lokasi fisik (berkomunikasi via Site-to-Site VPN atau Cloudflare Tunnel).
3.  **Observability (OpenTelemetry):**
    * **Metrik:** Mengekspos *endpoint* `/metrics` untuk di-*scrape* oleh Prometheus. Memantau `device_connection_latency_ms` dan `device_sync_error_rate`.
    * **Logging:** Semua log error jaringan diformat dalam struktur JSON standar dan dikirim ke ELK Stack (Elasticsearch, Logstash, Kibana) atau Grafana Loki.

---

## 5. Best Practices Checklist

* [ ] **Security-First (Network):** Perangkat Solution X100-C berada di VLAN terisolasi, hanya port 4370 yang dapat diakses oleh IP server lokal tempat *Middleware* berjalan.
* [ ] **Security-First (API):** *Endpoint* komunikasi antara *Edge Middleware* dan *Web Backend* diamankan menggunakan *Mutual TLS (mTLS)* atau setidaknya autentikasi API Key (*Bearer Token*).
* [ ] **DRY (Don't Repeat Yourself):** Pisahkan logika koneksi UDP, pemrosesan buffer ZKTeco, dan HTTP routing ke dalam *module/class* yang terpisah.
* [ ] **Graceful Degradation:** Jika mesin biometrik mati/terputus, *Edge Middleware* tidak boleh *crash*. Sistem harus secara elegan me- *log* kegagalan dan secara asinkron mencoba kembali di *background* tanpa memblokir layanan API lainnya.
* [ ] **Time Synchronization:** Pastikan server Node.js dikonfigurasi dengan NTP (*Network Time Protocol*). Implementasikan fitur `setTime()` dari *Middleware* ke perangkat biometrik setiap tengah malam untuk mencegah *Time Drift* pada mesin fisik.

---

## 6. POC Validation Results & Production Readiness

**Status:** Verified & Ready for Deployment (Tahap Konektivitas Layer Bawah)

1. **Pemisahan Tugas (Separation of Concerns):** Alat ZKTeco terkonfirmasi hanya bertindak sebagai *dumb sensor* (hanya butuh kabel LAN/Ethernet lokal tanpa perlu konfigurasi *Cloud ADMS Server*). Segala logika jam kerja, status masuk/pulang, toleransi telat ditangani 100% oleh Database dan Web Backend.
2. **Keamanan Data:** Penarikan Master Data (`getUsers`) dan *Attendance Log* berhasil divalidasi utuh tanpa *data loss*.
3. **Syarat Skala Produksi (*Deployment Requirements*):**
    * **Process Management:** Skrip jembatan Node.js (*Edge Middleware*) wajib dijalankan menggunakan `PM2` atau Docker `Restart: Always` agar dapat otomatis hidup kembali jika jaringan *hardware* terputus.
    * **Polling / Job Loop:** Ekstraksi data dijalankan dengan siklus interval (misal setiap 5 menit) untuk memantau mesin secara pasif.
    * **Fault Tolerance (Partial Try-Catch):** Blok penarikan data absen harus diisolasi; respons mesin yang kosong (0 log) memicu *timeout* pada *library*, namun skrip tidak boleh *crash*.
    * **Isolasi Jaringan:** Node.js *Middleware* **wajib** ditaruh di *local network* (LAN) kantor yang sama dengan mesin. Web Server utama (untuk HRIS Dashboard) bebas disebarkan di server *Cloud Baremetal* mana pun di internet.