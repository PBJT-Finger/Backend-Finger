# Prisma Setup & Migration Guide

**Status:** Ready for Phase 6-10  
**Prerequisites:** Phase 1-5 Complete ✅

---

## 🚀 Phase 6: Prisma Installation & Setup

### Step 1: Install Prisma Dependencies

Open **PowerShell** di folder `Backend-Finger` dan jalankan:

```powershell
cd "c:\Users\user\Downloads\Finger\Backend-Finger"

# Install Prisma Client
bun add @prisma/client

# Install Prisma CLI (dev dependency)
bun add -D prisma
```

**Verify installation:**
```powershell
bunx prisma --version
```

---

### Step 2: Initialize Prisma

```powershell
bunx prisma init
```

This will create:
- `prisma/` folder
- `prisma/schema.prisma` file
- Update `.env` with `DATABASE_URL`

---

### Step 3: Configure Database URL

Edit `.env` file, add atau update:

```env
DATABASE_URL="mysql://root:admin@localhost:3306/finger_db"
```

**Format:**
```
DATABASE_URL="mysql://[user]:[password]@[host]:[port]/[database]"
```

---

### Step 4: Generate Prisma Schema from Existing Database

```powershell
bunx prisma db pull
```

This will:
- Connect to `finger_db` database
- Read existing table structures
- Generate `schema.prisma` automatically

---

### Step 5: Review Generated Schema

Open `prisma/schema.prisma` and verify tables:

Expected models:
- `employees`
- `shifts`
- `attendance`
- `devices`
- `admins`
- `password_resets`

---

### Step 6: Generate Prisma Client

```powershell
bunx prisma generate
```

This creates TypeScript-ready Prisma Client in `node_modules/@prisma/client`

---

### Step 7: Test Prisma Connection

Create test file `test-prisma.js`:

```javascript
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Testing Prisma connection...\n');
  
  // Test 1: Count employees
  const employeeCount = await prisma.employees.count();
  console.log(`✅ Employees: ${employeeCount} records`);
  
  // Test 2: Count attendance
  const attendanceCount = await prisma.attendance.count();
  console.log(`✅ Attendance: ${attendanceCount} records`);
  
  // Test 3: Get first employee
  const firstEmployee = await prisma.employees.findFirst();
  console.log(`✅ First employee: ${firstEmployee?.nama || 'None'}\n`);
  
  console.log('🎉 Prisma connection successful!');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Error:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
```

**Run test:**
```powershell
bun run test-prisma.js
```

**Expected output:**
```
🔍 Testing Prisma connection...

✅ Employees: 10 records
✅ Attendance: 63 records
✅ First employee: Dr. Ahmad Hidayat, M.Kom

🎉 Prisma connection successful!
```

---

## 📊 Phase 7: Database Migration

### Option A: Fresh Database (Recommended for Development)

**1. Drop existing database:**
```powershell
mysql -u root -p < delete.sql
```

**2. Create fresh database:**
```sql
CREATE DATABASE finger_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

**3. Run production schema:**
```powershell
mysql -u root -p finger_db < production.sql
```

**4. Load sample data:**
```powershell
mysql -u root -p finger_db < dummy.sql
```

**5. Pull schema to Prisma:**
```powershell
bunx prisma db pull
bunx prisma generate
```

---

### Option B: Keep Existing Data (Production)

If you have important data:

**1. Backup first:**
```powershell
mysqldump -u root -p finger_db > backup_$(Get-Date -Format 'yyyyMMdd_HHmmss').sql
```

**2. Create migration SQL:**

Create `migration_to_v4.sql`:

```sql
USE finger_db;

-- Add missing columns to attendance
ALTER TABLE attendance 
  ADD COLUMN IF NOT EXISTS nip VARCHAR(50) AFTER user_id,
  ADD COLUMN IF NOT EXISTS jam_masuk TIME NULL AFTER tanggal,
  ADD COLUMN IF NOT EXISTS jam_keluar TIME NULL AFTER jam_masuk,
  MODIFY COLUMN jabatan ENUM('DOSEN', 'KARYAWAN') NOT NULL,
  DROP COLUMN IF EXISTS keterangan,
  DROP COLUMN IF EXISTS tanggal_absensi,
  DROP COLUMN IF EXISTS waktu_absensi,
  DROP COLUMN IF EXISTS tipe_absensi,
  DROP COLUMN IF EXISTS tanggal_upload;

-- Update Device table
ALTER TABLE devices
  ADD COLUMN IF NOT EXISTS device_name VARCHAR(100) AFTER id,
  CHANGE COLUMN api_key api_key_hash VARCHAR(255),
  DROP COLUMN IF EXISTS serial_number,
  DROP COLUMN IF EXISTS faculty,
  DROP COLUMN IF EXISTS last_seen;

-- Update Employee table  
ALTER TABLE employees
  DROP COLUMN IF EXISTS email,
  DROP COLUMN IF EXISTS phone;

-- Drop holiday tables if exist
DROP TABLE IF EXISTS holiday_cache;
DROP TABLE IF EXISTS holidays;
```

**3. Run migration:**
```powershell
mysql -u root -p finger_db < migration_to_v4.sql
```

**4. Update Prisma:**
```powershell
bunx prisma db pull
bunx prisma generate
```

---

## 🔧 Phase 8-10: Code Migration to Prisma

### Phase 8: Update Database Config

**1. Create new Prisma database config:**

Create `src/config/prisma.js`:

```javascript
const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

const prisma = new PrismaClient({
  log: [
    { level: 'query', emit: 'event' },
    { level: 'error', emit: 'stdout' },
    { level: 'warn', emit: 'stdout' },
  ],
});

// Log queries in development
if (process.env.NODE_ENV === 'development') {
  prisma.$on('query', (e) => {
    logger.debug('Prisma Query', {
      query: e.query,
      params: e.params,
      duration: `${e.duration}ms`
    });
  });
}

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

module.exports = { prisma };
```

**2. Update `src/models/index.js`:**

```javascript
// src/models/index.js - Prisma Client Export
const { prisma } = require('../config/prisma');

module.exports = {
  prisma,
  // For backward compatibility during migration
  db: prisma
};
```

---

### Phase 9: Migrate Controllers (Examples)

#### Example 1: Attendance Controller

**Before (Sequelize/Raw SQL):**
```javascript
const { query } = require('../lib/db');
const attendance = await query('SELECT * FROM attendance WHERE nip = ?', [nip]);
```

**After (Prisma):**
```javascript
const { prisma } = require('../config/prisma');
const attendance = await prisma.attendance.findMany({
  where: { nip: nip }
});
```

#### Example 2: Employee CRUD

**Before:**
```javascript
const employees = await query('SELECT * FROM employees WHERE jabatan = ?', ['DOSEN']);
```

**After:**
```javascript
const employees = await prisma.employees.findMany({
  where: { jabatan: 'DOSEN' }
});
```

#### Example 3: Complex Query with Join

**Before:**
```javascript
const result = await query(`
  SELECT a.*, e.department 
  FROM attendance a 
  LEFT JOIN employees e ON a.nip = e.nip 
  WHERE a.tanggal BETWEEN ? AND ?
`, [startDate, endDate]);
```

**After:**
```javascript
const result = await prisma.attendance.findMany({
  where: {
    tanggal: {
      gte: startDate,
      lte: endDate
    }
  },
  include: {
    employee: {
      select: {
        department: true
      }
    }
  }
});
```

---

### Phase 10: Testing & Cleanup

**1. Test all endpoints:**
```powershell
# Test auth
curl -X POST http://localhost:5000/api/auth/login -H "Content-Type: application/json" -d "{\"email\":\"admin@kampus.ac.id\",\"password\":\"Admin123\"}"

# Test attendance (dengan token)
curl -X GET "http://localhost:5000/api/attendance?start_date=2026-01-01&end_date=2026-01-31" -H "Authorization: Bearer YOUR_TOKEN"
```

**2. Remove Sequelize dependencies:**
```powershell
bun remove sequelize sequelize-cli mysql2
```

**3. Delete old config:**
```powershell
Remove-Item "src\config\database.js" -Force  # Old Sequelize config
Remove-Item "src\lib\db.js" -Force  # Old raw SQL connection (if not needed)
```

**4. Update package.json scripts:**
```json
{
  "scripts": {
    "dev": "bun run src/server.js",
    "prisma:generate": "prisma generate",
    "prisma:studio": "prisma studio",
    "prisma:migrate": "prisma migrate dev",
    "db:seed": "mysql -u root -p finger_db < dummy.sql"
  }
}
```

---

## ✅ Verification Checklist

### Database
- [ ] Database `finger_db` exists
- [ ] All 6 tables created (employees, shifts, attendance, devices, admins, password_resets)
- [ ] Sample data loaded (10 employees, ~63 attendance records)
- [ ] No holiday tables exist

### Prisma
- [ ] `@prisma/client` installed
- [ ] `prisma` dev dependency installed
- [ ] `prisma/schema.prisma` generated
- [ ] `DATABASE_URL` configured in `.env`
- [ ] Prisma Client generated (`bunx prisma generate`)
- [ ] Test connection successful

### Models
- [ ] `Employee.js` - no email/phone fields
- [ ] `Device.js` - has device_name, api_key_hash
- [ ] `Attendance.js` - no keterangan, has jam_masuk/jam_keluar
- [ ] `models/index.js` exports Prisma client

### Code Migration
- [ ] Controllers migrated to Prisma
- [ ] Services updated
- [ ] All API endpoints working
- [ ] No Sequelize imports remain

---

## 🆘 Troubleshooting

### Error: "Can't reach database server"

**Solution:**
1. Check MySQL is running
2. Verify DATABASE_URL credentials
3. Test connection: `mysql -u root -p`

### Error: "Table doesn't exist"

**Solution:**
```powershell
bunx prisma db push --force-reset
mysql -u root -p finger_db < production.sql
bunx prisma db pull
```

### Error: "Prisma Client not generated"

**Solution:**
```powershell
bunx prisma generate
```

### Error: "Module not found: @prisma/client"

**Solution:**
```powershell
bun add @prisma/client
bunx prisma generate
```

---

## 📚 Next Steps After Completion

1. **Update README.md** with Prisma instructions
2. **Create API documentation** with Prisma examples
3. **Write integration tests** using Prisma
4. **Deploy to staging** for testing
5. **Monitor performance** (Prisma vs raw SQL)

---

## 🎯 Success Metrics

When Phase 6-10 complete, you should have:

- ✅ **0 Sequelize dependencies**
- ✅ **100% Prisma-based queries**
- ✅ **Type-safe database access**
- ✅ **All tests passing**
- ✅ **Production-ready schema**

---

**Need help?** Check [Prisma Documentation](https://www.prisma.io/docs)
