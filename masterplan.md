# Master Plan: Upgrade backend-finger → TypeScript + ZkDeviceClient

**Project:** `backend-finger`
**Target:** TypeScript strict mode + integrasi `ZkDeviceClient` dari `test-connect-x100c`
**Date:** 2026-05-11
**Author:** System Architecture Team

---

## 1. Current State Analysis

### 1.1 Project Structure (Existing — JavaScript)

```
backend-finger/
├── src/
│   ├── app.js                       ← Express setup, middleware stack
│   ├── server.js                    ← Entry point, graceful shutdown
│   ├── config/
│   │   ├── env.js                   ← envalid validation
│   │   ├── prisma.js                ← PrismaClient singleton
│   │   ├── swagger.js               ← OpenAPI spec
│   │   ├── scalar.config.js         ← Scalar docs HTML generator
│   │   └── i18n.translations.js    ← EN/ID translations
│   ├── constants/
│   │   └── rateLimits.js
│   ├── controllers/
│   │   ├── admin.controller.js
│   │   ├── attendance.controller.js
│   │   ├── auth.controller.js
│   │   ├── dashboard.controller.js
│   │   ├── device.controller.js     ← STUB: 5/6 methods belum diimplementasi
│   │   └── export.controller.js
│   ├── middlewares/
│   │   ├── auth.middleware.js
│   │   ├── correlation.js
│   │   ├── errorHandler.middleware.js
│   │   ├── metrics.middleware.js
│   │   └── userRateLimit.js
│   ├── routes/
│   │   ├── admin.routes.js
│   │   ├── attendance.routes.js
│   │   ├── auth.routes.js
│   │   ├── dashboard.routes.js
│   │   ├── device.routes.js
│   │   ├── export.routes.js
│   │   ├── health.routes.js
│   │   └── metrics.routes.js
│   │   (tidak ada adms.routes — endpoint ADMS tidak digunakan)
│   ├── services/
│   │   ├── attendance.import.service.js
│   │   ├── attendanceService.js
│   │   ├── emailService.js
│   │   ├── exportService.js
│   │   └── fingerprint.service.js   ← zklib-js, NO polling, NO reconnect
│   ├── utils/
│   │   ├── attendanceTransformer.js
│   │   ├── errors.js
│   │   ├── jwt.js
│   │   ├── logger.js                ← Winston JSON structured
│   │   ├── metrics.js               ← prom-client
│   │   ├── prismaHelpers.js
│   │   ├── responseFormatter.js
│   │   └── tokenBlacklist.js        ← Redis DISABLED (TODO)
│   └── validators/
│       └── attendance.validators.js
├── prisma/
│   └── schema.prisma                ← MySQL: admins, employees, attendance, devices, shifts
├── .env.example
├── Dockerfile
└── package.json                     ← CommonJS, Node 18+
```

### 1.2 ZkDeviceClient (Root Project — sudah TypeScript)

```
(Root) /
└── src/
    ├── infrastructure/
    │   └── zk-client.ts   ← ZkDeviceClient: Singleton, EventEmitter, polling 5s, reconnect 8s
    ├── server.ts           ← SSE broadcast + Express
    ├── probe.ts
    └── seed-user.ts
```

### 1.3 Technical Debt (Pain Points)

| Area | Masalah | Risiko |
|---|---|---|
| `fingerprint.service.js` | Tidak ada polling loop, tidak ada reconnect | Device disconnect = mati total |
| `fingerprint.service.js` | Pakai `zklib-js` (deprecated) bukan `node-zklib` | Library salah, harus diganti |
| `device.controller.js` | 5 dari 6 method return `501` | Feature gap kritis |
| Semua file | Untyped: `any`, bare `object`, no interface | Bug tersembunyi, refactor berbahaya |
| `logger.js` | Tidak ada `traceId` / `correlationId` di setiap log | Tidak audit-ready |
| `env.js` | Tidak ada `FINGERPRINT_TIMEOUT`, `POLLING_INTERVAL` | Magic number inline |
| `tokenBlacklist.js` | Redis disabled — komentar TODO | Token revocation tidak berjalan |

---

## 2. Target Architecture

### 2.1 Prinsip

- **Anti-Corruption Layer (ACL):** `ZkDeviceClient` adalah satu-satunya pintu ke hardware. Import `node-zklib` **hanya** boleh ada di `infrastructure/zk-client.ts`. Mematuhi **Open/Closed Principle** — jika device ganti brand, hanya `zk-client.ts` yang ditulis ulang.
- **node-zklib sebagai library final:** Tidak ada `zklib-js`, tidak ada dynamic require fallback. `node-zklib@^1.3.0` sudah divalidasi langsung di hardware X100-C (IP `192.168.137.15`).
- **TypeScript strict:** `"strict": true`, tidak ada `any` kecuali di satu titik boundary `node-zklib` (wajib komentar justifikasi `// node-zklib tidak punya @types`).
- **Layered Architecture:** `server → routes → controllers → services → infrastructure/db`.
- **Event-Driven Sync:** `ZkDeviceClient` emit `attendance` → `ZkSyncService` proses + persist ke DB dengan idempotency.
- **Tanpa ADMS:** Endpoint `/adms` tidak digunakan. Sinkronisasi dilakukan murni via polling `node-zklib` langsung dari server.

### 2.2 Target Folder Structure

```
backend-finger/
├── src/
│   ├── app.ts
│   ├── server.ts
│   ├── config/
│   │   ├── env.ts               ← envalid + FINGERPRINT_* vars
│   │   ├── prisma.ts
│   │   ├── swagger.ts
│   │   ├── scalar.config.ts
│   │   └── i18n.translations.ts
│   ├── constants/
│   │   ├── rateLimits.ts
│   │   └── device.constants.ts  ← POLLING_INTERVAL_MS, RECONNECT_DELAY_MS, dll.
│   ├── types/
│   │   ├── express.d.ts         ← Augment req.user, req.correlationId
│   │   ├── attendance.types.ts
│   │   ├── auth.types.ts
│   │   └── device.types.ts
│   ├── infrastructure/
│   │   └── zk-client.ts         ← Wrapper node-zklib: Singleton, EventEmitter, polling, reconnect
│   ├── controllers/             ← Semua .ts, semua method implemented (tanpa adms)
│   ├── middlewares/             ← Semua .ts
│   ├── routes/                  ← Semua .ts (tanpa adms.routes)
│   ├── services/
│   │   ├── attendance.import.service.ts
│   │   ├── attendance.service.ts
│   │   ├── email.service.ts
│   │   ├── export.service.ts
│   │   └── zk-sync.service.ts   ← BARU: listener ZkDeviceClient → DB persistence
│   ├── utils/                   ← Semua .ts
│   └── validators/              ← Semua .ts
├── prisma/
│   └── schema.prisma
├── tsconfig.json
├── .env.example                 ← + FINGERPRINT_* section
└── package.json
```

---

## 3. Dependency Changes

### 3.1 Remove

```bash
# zklib-js: deprecated, diganti node-zklib yang sudah proven di hardware X100-C
# sequelize: tidak digunakan, ORM adalah Prisma
npm remove zklib-js sequelize
```

### 3.2 Add / Update

```bash
# TypeScript toolchain
npm install -D typescript@^5.4 ts-node@^10.9 tsconfig-paths@^4.2
npm install -D @types/node @types/express @types/bcrypt
npm install -D @types/jsonwebtoken @types/nodemailer @types/compression
npm install -D @types/cors @types/multer @types/uuid
npm install -D tsx@^4

# ZK Device
npm install node-zklib@^1.3.0
```

### 3.3 Update package.json scripts

```json
{
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "start": "node dist/server.js",
    "build": "rimraf dist && tsc --project tsconfig.json",
    "type-check": "tsc --noEmit",
    "lint": "eslint \"src/**/*.ts\"",
    "device:probe": "tsx src/infrastructure/probe.ts",
    "device:seed": "tsx src/infrastructure/seed-user.ts",
    "postinstall": "prisma generate"
  }
}
```

---

## 4. tsconfig.json (Target)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "lib": ["ES2022"],
    "rootDir": "./src",
    "outDir": "./dist",
    "esModuleInterop": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

---

## 5. Sprint Plan

### 📂 Agent Context — Baca Sebelum Sprint

```
backend-finger/src/app.js                         → Express setup & middleware stack
backend-finger/src/server.js                      → Entry point & graceful shutdown pattern
backend-finger/src/config/env.js                  → envalid env validation
backend-finger/src/services/fingerprint.service.js → ZK service lama (akan DIGANTI)
backend-finger/src/services/attendanceService.js  → Business logic absensi
backend-finger/src/middlewares/auth.middleware.js → JWT pattern
backend-finger/prisma/schema.prisma               → DB schema
root/src/infrastructure/zk-client.ts               → ZkDeviceClient (dipindah ke backend-finger)
```

---

### Sprint 0 — Foundation & Toolchain

**Goal:** TypeScript bisa dikompilasi, `tsx watch` jalan, tidak ada JS lagi di `src/`.

#### [Task 0.0] Consolidation & Cleanup (PRE-REQUISITE)
**Goal:** Memastikan tidak ada file/folder selain `.md` di luar `backend-finger/`.
- [ ] Pindahkan `src/infrastructure/zk-client.ts` ke `backend-finger/src/infrastructure/zk-client.ts`
- [ ] Pindahkan `src/probe.ts` dan `src/seed-user.ts` ke `backend-finger/scripts/`
- [ ] Hapus folder `src/`, `public/`, `node_modules/` yang ada di root (luar `backend-finger/`)
- [ ] Hapus file `package.json`, `package-lock.json`, `tsconfig.json` di root.
- [ ] Pastikan dependensi `node-zklib` masuk ke `backend-finger/package.json`

#### [Task 0.1] Setup tsconfig & package.json
**File:** `backend-finger/tsconfig.json`, `backend-finger/package.json`
- [ ] Terapkan tsconfig strict mode di atas
- [ ] Update scripts ke `tsx watch` dan `rimraf dist && tsc`
- [ ] Install semua `@types/*` yang dibutuhkan
- [ ] Install `tsx` dan `rimraf` sebagai devDependencies

#### [Task 0.2] Setup `src/types/express.d.ts`
**File:** `backend-finger/src/types/express.d.ts`
- [ ] Augment `Express.Request`: `user: AuthenticatedUser`, `correlationId: string`
- [ ] Define interface `AuthenticatedUser { id: number; username: string; role: string }`

#### [Task 0.3] Konversi `config/env.js` → `env.ts`
**File:** `backend-finger/src/config/env.ts`
- [ ] Tambah env vars: `FINGERPRINT_IP`, `FINGERPRINT_PORT`, `FINGERPRINT_TIMEOUT`, `POLLING_INTERVAL_MS`, `RECONNECT_DELAY_MS`
- [ ] Export typed interface `AppEnv`
- [ ] Tidak ada `any` — semua field eksplisit

**Definition of Done:**
- [ ] Tidak ada file/folder non-markdown di luar `backend-finger`
- [ ] `npm run type-check` exit 0
- [ ] `npm run dev` server jalan tanpa error
- [ ] Tidak ada file `.js` di `src/`

---

### Sprint 1 — Infrastructure: ZkDeviceClient

**Goal:** `ZkDeviceClient` berjalan di dalam `backend-finger` sebagai singleton yang configurable via env.

#### [Task 1.1] Adapt `zk-client.ts`
**File:** `backend-finger/src/infrastructure/zk-client.ts`
- [ ] File sudah dipindah dari langkah 0.0.
- [ ] Ubah konstanta hardcoded → baca dari `env.ts`: `FINGERPRINT_IP`, `FINGERPRINT_PORT`, `FINGERPRINT_TIMEOUT`, `POLLING_INTERVAL_MS`, `RECONNECT_DELAY_MS`
- [ ] Tambah method `getLastSyncCount(): number` untuk health check
- [ ] Export: `AttendanceRecord`, `DeviceInfo`, `DeviceStatus`, `ZkClientEvent`

#### [Task 1.2] Buat `device.constants.ts`
**File:** `backend-finger/src/constants/device.constants.ts`
- [ ] `DEFAULT_POLLING_INTERVAL_MS = 5_000`
- [ ] `DEFAULT_RECONNECT_DELAY_MS = 8_000`
- [ ] `DEFAULT_CONNECTION_TIMEOUT_MS = 10_000`
- [ ] `DEFAULT_IN_PORT_TIMEOUT_MS = 4_000`

#### [Task 1.3] Buat `zk-sync.service.ts`
**File:** `backend-finger/src/services/zk-sync.service.ts`
- [ ] Class `ZkSyncService` — listen ke `ZkDeviceClient` events
- [ ] Method `start()`: attach listener `attendance` → `persistAttendanceBatch(records)`
- [ ] Method `persistAttendanceBatch()`: upsert ke tabel `attendance` via Prisma
  - Idempotency key: composite `deviceUserId + recordTime`
  - Log setiap batch: `{ count, deviceIp, batchId: uuid }`
- [ ] Error dalam `persistAttendanceBatch` TIDAK crash proses — log dan lanjut

**Definition of Done:**
- [ ] `ZkDeviceClient` singleton dapat di-instantiate di `server.ts`
- [ ] `ZkSyncService.start()` attach listener dan log batch masuk
- [ ] Type check clean

---

### Sprint 2 — Utils & Middlewares Conversion

**Goal:** Semua layer infrastruktur (logger, jwt, errors, middlewares) fully typed.

#### [Task 2.1] `utils/logger.ts`
**File:** `backend-finger/src/utils/logger.ts`
- [ ] Tambah `correlationId` ke setiap log entry (ambil dari `AsyncLocalStorage` atau parameter)
- [ ] Export typed `LogContext` interface
- [ ] Method `audit(event: string, userId: number, metadata: Record<string, unknown>): void`

#### [Task 2.2] `utils/errors.ts`
**File:** `backend-finger/src/utils/errors.ts`
- [ ] Base class `AppError extends Error` dengan `statusCode`, `code`, `details`
- [ ] Sub-classes: `ValidationError`, `AuthenticationError`, `NotFoundError`, `ConflictError`

#### [Task 2.3] `middlewares/auth.middleware.ts`
**File:** `backend-finger/src/middlewares/auth.middleware.ts`
- [ ] `authenticateToken`: return type eksplisit, tidak ada implicit `any` dari `jwt.verify`
- [ ] `requireAdmin`: gunakan `req.user` dari augmented types

#### [Task 2.4] `middlewares/errorHandler.middleware.ts`
**File:** `backend-finger/src/middlewares/errorHandler.middleware.ts`
- [ ] Handle `AppError` subclasses secara typed
- [ ] Response envelope standar: `{ error: { code, message, details } }`

**Definition of Done:**
- [ ] Semua utils & middlewares: 0 TypeScript errors
- [ ] Error responses seragam di semua endpoint

---

### Sprint 3 — Services Conversion

**Goal:** Business logic layer fully typed, `fingerprint.service.js` dihapus.

#### [Task 3.1] `services/attendance.service.ts`
**File:** `backend-finger/src/services/attendance.service.ts`
- [ ] Konversi dari `attendanceService.js`
- [ ] Interface: `AttendanceSummaryFilters`, `AttendanceSummaryResult`, `EmployeeSummary`
- [ ] Tidak ada bare `object` di parameter/return

#### [Task 3.2] `services/attendance.import.service.ts`
**File:** `backend-finger/src/services/attendance.import.service.ts`
- [ ] Konversi dari `attendance.import.service.js`
- [ ] Type semua field CSV/Excel parser

#### [Task 3.3] `services/email.service.ts` & `services/export.service.ts`
- [ ] Konversi, tambah return types eksplisit
- [ ] `emailService`: parameter typed, bukan bare `object`

#### [Task 3.4] Hapus `fingerprint.service.js`
- [ ] Delete file
- [ ] Grep dan pastikan tidak ada referensi tertinggal: `grep -r "fingerprint.service" src/`

**Definition of Done:**
- [ ] `npm run type-check` clean setelah hapus `fingerprint.service.js`
- [ ] Tidak ada `require('zklib-js')` atau `require('node-zklib')` di luar `infrastructure/`

---

### Sprint 4 — Controllers Conversion + Device Controller Implementation

**Goal:** Semua controller typed, `device.controller.ts` fully implemented (zero 501).

#### [Task 4.1] Konversi semua controllers
**Files:** `admin`, `attendance`, `auth`, `dashboard`, `export` controllers  
> ⚠️ `adms.controller` tidak dikonversi — dihapus dari project (tidak digunakan)
- [ ] Semua method signature: `(req: Request, res: Response): Promise<void>`
- [ ] Gunakan `AppError` classes — tidak ada manual `res.status(500)` inline
- [ ] Hapus `adms.controller.js` dan `adms.routes.js` dari `src/`

#### [Task 4.2] Implement `device.controller.ts` — semua 6 method
**File:** `backend-finger/src/controllers/device.controller.ts`
- [ ] `getDevices()` — list active devices dari Prisma
- [ ] `getDeviceById(id)` — find single, throw `NotFoundError` jika tidak ada
- [ ] `createDevice()` — validate input, hash api_key, insert
- [ ] `updateDevice(id)` — partial update, validate field
- [ ] `deleteDevice(id)` — soft delete (`is_active = false`)
- [ ] `syncDevice(id)` — trigger `ZkDeviceClient.start()` jika device match, return status

**Definition of Done:**
- [ ] Semua 6 endpoint `/api/device/*` respond dengan benar
- [ ] Tidak ada 501 response tersisa di seluruh codebase

---

### Sprint 5 — Wiring Final, Server, Build

**Goal:** Entry point selesai, `ZkSyncService` aktif saat server start, Docker build clean.

#### [Task 5.1] Konversi `app.ts` dan `server.ts`
**File:** `backend-finger/src/app.ts`, `backend-finger/src/server.ts`
- [ ] Konversi semua import ke TypeScript
- [ ] `server.ts`: instantiate `ZkDeviceClient` + `ZkSyncService`, panggil `zkSync.start()` setelah `prisma.$connect()`
- [ ] Graceful shutdown: `zkClient.stop()` → `prisma.$disconnect()`

#### [Task 5.2] Update `.env.example`
**File:** `backend-finger/.env.example`
```env
# --- ZKTeco Device ---
FINGERPRINT_IP=192.168.137.15
FINGERPRINT_PORT=4370
FINGERPRINT_TIMEOUT=10000
POLLING_INTERVAL_MS=5000
RECONNECT_DELAY_MS=8000
```

#### [Task 5.3] Update Health Endpoint
**File:** `backend-finger/src/routes/health.routes.ts`
- [ ] Tambah `deviceStatus: zkClient.getStatus()` ke response `/health`
- [ ] Tambah `lastSyncCount: zkClient.getLastSyncCount()`

#### [Task 5.4] Update Dockerfile
**File:** `backend-finger/Dockerfile`
- [ ] Build stage: `npm run build`
- [ ] Run stage: `CMD ["node", "dist/server.js"]`

**Definition of Done:**
- [ ] `npm run build` → `dist/` bersih tanpa error
- [ ] Server start → ZkDeviceClient mulai polling otomatis
- [ ] `/health` menampilkan `deviceStatus`
- [ ] Docker image build sukses

---

## 6. Risk Register

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| `node-zklib` tidak punya `@types` | Tinggi | Medium | Buat `src/types/node-zklib.d.ts` manual dengan `declare module` |
| Idempotency upsert collision | Medium | Tinggi | Tambah `@@unique([deviceUserId, recordTime])` di Prisma schema, gunakan `prisma.attendance.upsert` |
| Singleton ZkDeviceClient double-start | Medium | Medium | Guard `isRunning` flag sudah ada — pastikan `server.ts` hanya panggil `start()` sekali |
| JS files tertinggal di `dist/` lama | Low | Low | Tambah `rimraf dist` sebelum `tsc` di script `build` |
| Redis disabled → token blacklist tidak jalan | Tinggi | Tinggi | `tokenBlacklist.ts` fallback gracefully ke in-memory `Map` jika Redis tidak tersedia |

---

## 7. File Rename Map (JS → TS)

| From (JS) | To (TS) | Catatan |
|---|---|---|
| `src/app.js` | `src/app.ts` | |
| `src/server.js` | `src/server.ts` | + ZkSyncService wiring |
| `src/config/env.js` | `src/config/env.ts` | + FINGERPRINT_* vars |
| `src/config/prisma.js` | `src/config/prisma.ts` | |
| `src/services/fingerprint.service.js` | **HAPUS** | Diganti zk-sync.service.ts |
| `src/services/attendanceService.js` | `src/services/attendance.service.ts` | |
| _(tidak ada)_ | `src/services/zk-sync.service.ts` | **BARU** |
| _(tidak ada)_ | `src/infrastructure/zk-client.ts` | **BARU** (dari test-connect-x100c) |
| _(tidak ada)_ | `src/types/express.d.ts` | **BARU** |
| _(tidak ada)_ | `src/types/attendance.types.ts` | **BARU** |
| _(tidak ada)_ | `src/types/device.types.ts` | **BARU** |
| Semua `*.js` lainnya di `src/` | `*.ts` (nama sama) | |

---

## 8. Migration Checklist (Sebelum Production)

- [ ] `npm run type-check` exit 0 — zero error
- [ ] `npm run build` menghasilkan `dist/` valid
- [ ] Semua 501 endpoints sudah diimplementasi
- [ ] `ZkSyncService` upsert attendance log dari device real ke DB
- [ ] `/health` menampilkan `deviceStatus` dan `lastSyncCount`
- [ ] `node-zklib` hanya di-import di `src/infrastructure/zk-client.ts` — tidak ada tempat lain
- [ ] Tidak ada sisa file `adms.controller.js` atau `adms.routes.js` di `src/`
- [ ] Tidak ada `zklib-js` di `package.json`
- [ ] `.env.example` mencerminkan semua env vars yang dibutuhkan
- [ ] Prisma migration untuk `@@unique([deviceUserId, recordTime])` di tabel `attendance`
- [ ] Docker image build dan run dengan `CMD ["node", "dist/server.js"]`
