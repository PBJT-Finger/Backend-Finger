# Prisma Migration Guide

**Guide untuk migrating controllers dan services dari Sequelize ke Prisma ORM**

---

## 📋 Overview

Migration ini dilakukan secara **incremental** untuk meminimalisir breaking changes:
1. **Phase 8**: Setup Prisma config dan export di models/index.js ✅ 
2. **Phase 9**: Migrate controllers satu per satu
3. **Phase 10**: Remove Sequelize dependencies

---

## 🔧 Import Changes

### Before (Sequelize):
```javascript
const { Employee, Attendance, Shift } = require('../models');
```

### After (Prisma):
```javascript
const { prisma } = require('../models');
// or
const prisma = require('../config/prisma');
```

---

## 📊 Query Conversion Examples

### 1. Find All Records

**Sequelize:**
```javascript
const employees = await Employee.findAll({
  where: { is_active: true },
  include: [{ model: Shift, as: 'shift' }]
});
```

**Prisma:**
```javascript
const employees = await prisma.employees.findMany({
  where: { is_active: true },
  include: { shifts: true }
});
```

### 2. Find One Record

**Sequelize:**
```javascript
const employee = await Employee.findOne({
  where: { nip: '198805121234561001' }
});
```

**Prisma:**
```javascript
const employee = await prisma.employees.findUnique({
  where: { nip: '198805121234561001' }
});
```

### 3. Create Record

**Sequelize:**
```javascript
const newEmployee = await Employee.create({
  nip: '199012345678901234',
  nama: 'John Doe',
  jabatan: 'DOSEN',
  status: 'AKTIF'
});
```

**Prisma:**
```javascript
const newEmployee = await prisma.employees.create({
  data: {
    nip: '199012345678901234',
    nama: 'John Doe',
    jabatan: 'DOSEN',
    status: 'AKTIF'
  }
});
```

### 4. Update Record

**Sequelize:**
```javascript
await Employee.update(
  { status: 'NON_AKTIF' },
  { where: { nip: '198805121234561001' } }
);
```

**Prisma:**
```javascript
await prisma.employees.update({
  where: { nip: '198805121234561001' },
  data: { status: 'NON_AKTIF' }
});
```

### 5. Delete Record

**Sequelize:**
```javascript
await Employee.destroy({
  where: { nip: '198805121234561001' }
});
```

**Prisma:**
```javascript
await prisma.employees.delete({
  where: { nip: '198805121234561001' }
});
```

### 6. Count Records

**Sequelize:**
```javascript
const count = await Attendance.count({
  where: { 
    jabatan: 'KARYAWAN',
    status: 'TERLAMBAT'
  }
});
```

**Prisma:**
```javascript
const count = await prisma.attendance.count({
  where: { 
    jabatan: 'KARYAWAN',
    status: 'TERLAMBAT'
  }
});
```

### 7. Aggregate Queries

**Sequelize:**
```javascript
const result = await Attendance.findAll({
  attributes: [
    'nama',
    [sequelize.fn('COUNT', sequelize.col('id')), 'total']
  ],
  where: { jabatan: 'KARYAWAN' },
  group: ['nama']
});
```

**Prisma:**
```javascript
const result = await prisma.attendance.groupBy({
  by: ['nama'],
  where: { jabatan: 'KARYAWAN' },
  _count: { id: true }
});
```

---

## ⚠️ Important Differences

### 1. Model Names
- **Sequelize**: PascalCase (e.g., `Employee`, `Attendance`)
- **Prisma**: lowercase plural (e.g., `employees`, `attendance`)

### 2. Relations
- **Sequelize**: Uses `include` with `model` and `as`
- **Prisma**: Uses `include` with relation name from schema

### 3. TIME Fields
- **Prisma** returns TIME fields as DateTime objects
- Use `formatTime()` helper from `prismaHelpers.js`:
  ```javascript
  const { formatTime } = require('../utils/prismaHelpers');
  const timeString = formatTime(shift.jam_masuk); // "08:00:00"
  ```

### 4. Enums
- **Sequelize**: String values
- **Prisma**: Enum types, but can be compared as strings

---

## 🧪 Testing Checklist

Before removing Sequelize code:
- [ ] Test all CRUD operations
- [ ] Verify foreign key relationships work
- [ ] Test pagination and filtering
- [ ] Verify TIME/DATE field formatting
- [ ] Check enum value handling
- [ ] Test transaction support if needed
- [ ] Verify error handling

---

## 📝 Controller Migration Steps

1. **Import Prisma** instead of Sequelize models
2. **Convert queries** using examples above
3. **Test endpoint** thoroughly
4. **Update error handling** (Prisma has different error types)
5. **Remove Sequelize imports** after verification

---

## ✅ Benefits of Prisma

- **Type Safety**: Auto-generated types for TypeScript
- **Better Performance**: Optimized queries
- **Cleaner Syntax**: More intuitive query builder
- **Better Logging**: Built-in query logging
- **Migration Tools**: Prisma Migrate for schema changes

---

## 📚 Resources

- [Prisma Docs](https://www.prisma.io/docs)
- [Prisma Query Examples](https://www.prisma.io/docs/concepts/components/prisma-client/crud)
- [Sequelize to Prisma Guide](https://www.prisma.io/docs/guides/migrate-to-prisma/migrate-from-sequelize)
