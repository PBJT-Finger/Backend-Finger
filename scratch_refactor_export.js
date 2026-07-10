const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../backend-finger/src/controllers/export.controller.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Add import
if (!content.includes('ExportRepository')) {
  content = content.replace(
    "import fs from 'fs'; // Module internal Node.js untuk operasi file system",
    "import fs from 'fs';\nimport { ExportRepository } from '../repositories/export.repository';"
  );
}

// Replace SQL blocks
const sqlRegex = /let sql = `[\s\S]*?const attendance = await prisma\.\$queryRawUnsafe<RawAttendanceRecord\[\]>\(sql, \.\.\.params\);/g;

content = content.replace(sqlRegex, `const attendance = await ExportRepository.getGroupedAttendance(
        startDate,
        endDate,
        typeof jabatan === 'string' ? jabatan : undefined,
        typeof id === 'string' ? id : (typeof user_id === 'string' ? user_id : undefined)
      );`);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully refactored export.controller.ts');
