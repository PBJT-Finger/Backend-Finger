# Prisma Migration - Quick Guide

## ✅ FILES CREATED

### Migration Scripts (Prisma-based)
1. **[`scripts/migrate-legacy-employees.js`](file:///C:/Users/user/Downloads/Finger/Backend-Finger/scripts/migrate-legacy-employees.js)** - Import 23 employees
2. **[`scripts/seed-device-mapping.js`](file:///C:/Users/user/Downloads/Finger/Backend-Finger/scripts/seed-device-mapping.js)** - Create device mapping table
3. **[`scripts/verify-migration.js`](file:///C:/Users/user/Downloads/Finger/Backend-Finger/scripts/verify-migration.js)** - Verify migration results

### NPM Scripts Added
```json
"migrate:legacy": "node scripts/migrate-legacy-employees.js"
"seed:device-mapping": "node scripts/seed-device-mapping.js"
"verify:migration": "node scripts/verify-migration.js"
```

---

## 🚀 CARA MENJALANKAN

### Option 1: NPM Scripts (Recommended)

```bash
# 1. Import employees
npm run migrate:legacy

# 2. Create device mapping
npm run seed:device-mapping

# 3. Verify results
npm run verify:migration
```

### Option 2: Direct Node.js

```bash
node scripts/migrate-legacy-employees.js
node scripts/seed-device-mapping.js
node scripts/verify-migration.js
```

### Option 3: Batch File

```cmd
# From Command Prompt (NOT PowerShell)
cd C:\Users\user\Downloads\Finger\Backend-Finger\seeds
run_migration.bat
```

---

## ✨ KEUNTUNGAN PRISMA vs RAW SQL

| Aspect | Prisma | Raw SQL |
|--------|--------|---------|
| **Type Safety** | ✅ Full TypeScript support | ❌ No type checking |
| **Error Handling** | ✅ Try-catch per employee | ❌ All-or-nothing |
| **Duplicate Handling** | ✅ Smart skip with logging | ⚠️ Silent ignore |
| **Verification** | ✅ Built-in count/groupBy | ❌ Manual queries |
| **Logging** | ✅ Detailed per-record | ⚠️ Limited |
| **Rollback** | ✅ Transaction support | ❌ Manual |

---

## 📊 DATA SUMMARY

**Total:** 23 pegawai
- **DOSEN:** 21 orang
  - NIP: 850019763 - 850020813, 1018-1020
- **KARYAWAN:** 2 orang
  - Dede Harisma (NIP: 1021)
  - Danil Firmansyah (NIP: 1022)

**Device Mapping:**
- PIN Range: 1000-1022
- User ID Range: 1-23

---

## 🔍 VERIFICATION QUERIES

After migration, check results:

```bash
# Quick verify
npm run verify:migration

# Manual check
node -e "const {PrismaClient} = require('@prisma/client'); const p = new PrismaClient(); p.employees.count().then(c => console.log('Total:', c))"
```

### Expected Output:
```
✅ Success: 23 employees imported
✅ Jabatan mapping correct (21 DOSEN + 2 KARYAWAN)
✅ All device mappings created
```

---

## 🛠 TROUBLESHOOTING

### Error: "Cannot find module '@prisma/client'"
```bash
npm install
npx prisma generate
```

### Error: "Employee already exists"
✅ **This is OK!** Script will skip duplicates automatically.

### Want to Re-import?
```bash
# Delete old data first
node -e "const {PrismaClient} = require('@prisma/client'); const p = new PrismaClient(); p.employees.deleteMany({where: {tanggal_masuk: new Date('2024-10-03')}}).then(() => console.log('Deleted')).finally(() => p.\$disconnect())"

# Then re-run
npm run migrate:legacy
```

---

## 📄 SCRIPT FEATURES

### migrate-legacy-employees.js
- ✅ Skip duplicates (checks NIP uniqueness)
- ✅ Detailed logging per employee  
- ✅ Error collection for failed imports
- ✅ Final verification with count by jabatan
- ✅ Shows all imported employees

### seed-device-mapping.js
- ✅ Creates table if not exists
- ✅ Upsert logic (insert or update)
- ✅ Validates employee exists before mapping
- ✅ Sample output with jabatan grouping

### verify-migration.js
- ✅ Checks total employee count
- ✅ Verifies Dede & Danil as KARYAWAN
- ✅ Confirms device PIN mappings
- ✅ Lists all imported employees
- ✅ Comprehensive summary report

---

**Created:** 2026-02-08  
**Status:** Ready to run
