const fs = require('fs');
const j = JSON.parse(fs.readFileSync('seeds/employees_from_device.json', 'utf8'));
let sql = "INSERT INTO employees (user_id, nama, jabatan, status, is_active) VALUES ";
const DOSEN = new Set(['Ilham_Akhsani', 'Aziz_Azindani', 'Slamet_Riyadi', 'Lily_Budinurani', 'Ria_Candra_Dewi', 'Atiek_Nurindriani', 'Agung_Nugroho', 'Ismi_Kusumaningroem', 'Robiatul_Adawiyah', 'Ayu_Ningrum_Purnamasari', 'Septian_Trikusuma', 'Wulan_Anggraini', 'Ilham_Sigit_Dwi_Arianto', 'Heru_Rohadi', 'Tri_Looke_Darwanto', 'Imam_Syafii', 'Jarot_Rudi_Hartanto', 'Ahmad_Jabidi']);

const values = j.filter(u => u.name !== "Ahmad Rifa'i").map(u => {
  return `('${u.userId}', '${u.name}', '${DOSEN.has(u.name) ? "DOSEN" : "KARYAWAN"}', 'AKTIF', 1)`;
});

sql += values.join(', ') + " ON DUPLICATE KEY UPDATE nama=VALUES(nama), jabatan=VALUES(jabatan), is_active=1;";
console.log(sql);
