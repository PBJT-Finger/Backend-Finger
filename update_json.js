const fs = require('fs');

let b = fs.readFileSync('fingerprint_db.sql');
let sql = (b[0]===0xff && b[1]===0xfe) ? b.toString('utf16le') : b.toString('utf8');

const matches = [...sql.matchAll(/\((\d+),'([^']+)','([^']*)','(DOSEN|KARYAWAN)'/g)];
const users = new Map();

matches.forEach(m => {
  let id = m[2];
  let name = m[3].trim();
  if(name) {
    users.set(name, id);
  }
});

users.set("Ahmad Rifa'i", "99");

const jsonArray = Array.from(users.entries()).map(([name, userId]) => ({ userId, name }));

fs.writeFileSync('seeds/employees_from_device.json', JSON.stringify(jsonArray, null, 2));
console.log('success. Total users:', jsonArray.length);
