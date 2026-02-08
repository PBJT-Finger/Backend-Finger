// scripts/add-new-employee.js
// Helper script untuk menambah pegawai baru
// Usage: node scripts/add-new-employee.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(query) {
    return new Promise(resolve => rl.question(query, resolve));
}

async function getNextAvailableIds() {
    // Get next User ID
    const lastMapping = await prisma.$queryRaw`
    SELECT MAX(CAST(device_user_id AS UNSIGNED)) as max_id 
    FROM employee_device_mapping
  `;
    const nextUserId = (lastMapping[0]?.max_id || 0) + 1;

    // Get next PIN
    const lastPin = await prisma.$queryRaw`
    SELECT MAX(CAST(device_pin AS UNSIGNED)) as max_pin 
    FROM employee_device_mapping
  `;
    const nextPin = (lastPin[0]?.max_pin || 999) + 1;

    return { nextUserId, nextPin };
}

async function main() {
    console.log('═══════════════════════════════════════');
    console.log('    TAMBAH PEGAWAI BARU - WIZARD');
    console.log('═══════════════════════════════════════\n');

    try {
        // Get next available IDs
        const { nextUserId, nextPin } = await getNextAvailableIds();
        console.log(`📊 Next available User ID: ${nextUserId}`);
        console.log(`📊 Next available PIN: ${nextPin}\n`);

        // Collect data
        const nip = await question('NIP (contoh: 850024789): ');
        const nama = await question('Nama Lengkap (contoh: Melinda, M.Kom): ');
        const jabatanInput = await question('Jabatan (1=DOSEN, 2=KARYAWAN): ');
        const jabatan = jabatanInput === '1' ? 'DOSEN' : 'KARYAWAN';

        const userIdInput = await question(`User ID [${nextUserId}]: `);
        const userId = userIdInput || String(nextUserId);

        const pinInput = await question(`PIN [${nextPin}]: `);
        const pin = pinInput || String(nextPin);

        const shiftIdInput = await question('Shift ID (kosongkan jika DOSEN, 1-3 untuk KARYAWAN): ');
        const shiftId = shiftIdInput ? parseInt(shiftIdInput) : null;

        // Confirm
        console.log('\n═══════════════════════════════════════');
        console.log('📝 DATA YANG AKAN DITAMBAHKAN:');
        console.log('═══════════════════════════════════════');
        console.log(`NIP           : ${nip}`);
        console.log(`Nama          : ${nama}`);
        console.log(`Jabatan       : ${jabatan}`);
        console.log(`Shift ID      : ${shiftId || 'NULL'}`);
        console.log(`User ID       : ${userId}`);
        console.log(`PIN           : ${pin}`);
        console.log(`Status        : AKTIF`);
        console.log(`Tanggal Masuk : ${new Date().toISOString().split('T')[0]}`);
        console.log('═══════════════════════════════════════\n');

        const confirm = await question('Lanjutkan? (y/n): ');
        if (confirm.toLowerCase() !== 'y') {
            console.log('❌ Dibatalkan');
            rl.close();
            return;
        }

        // Check if NIP already exists
        const existing = await prisma.employees.findUnique({
            where: { nip }
        });

        if (existing) {
            console.log(`❌ ERROR: NIP ${nip} sudah terdaftar atas nama ${existing.nama}`);
            rl.close();
            return;
        }

        // Insert employee
        console.log('\n🔄 Menambahkan ke database...');

        const employee = await prisma.employees.create({
            data: {
                nip,
                nama,
                jabatan,
                shift_id: shiftId,
                status: 'AKTIF',
                tanggal_masuk: new Date(),
                is_active: true
            }
        });

        console.log(`✅ Employee created: ${employee.nama} (ID: ${employee.id})`);

        // Insert device mapping
        await prisma.$executeRaw`
      INSERT INTO employee_device_mapping (nip, device_user_id, device_pin)
      VALUES (${nip}, ${userId}, ${pin})
    `;

        console.log(`✅ Device mapping created: User ID ${userId}, PIN ${pin}`);

        // Print registration slip
        console.log('\n╔════════════════════════════════════════╗');
        console.log('║     SLIP REGISTRASI FINGERPRINT        ║');
        console.log('╠════════════════════════════════════════╣');
        console.log(`║ Nama      : ${nama.padEnd(27)}║`);
        console.log(`║ NIP       : ${nip.padEnd(27)}║`);
        console.log(`║ Jabatan   : ${jabatan.padEnd(27)}║`);
        console.log('╠════════════════════════════════════════╣');
        console.log(`║ User ID   : ${userId.padEnd(27)}║`);
        console.log(`║ PIN       : ${pin.padEnd(27)}║`);
        console.log('╠════════════════════════════════════════╣');
        console.log('║ LANGKAH REGISTRASI:                    ║');
        console.log('║ 1. Pergi ke device FingerBaja          ║');
        console.log('║ 2. Menu → User Mgmt → Add New User     ║');
        console.log('║ 3. Masukkan User ID dan PIN di atas    ║');
        console.log('║ 4. Enroll 2 fingerprint (jempol)       ║');
        console.log('║ 5. Test scan untuk verifikasi          ║');
        console.log('╚════════════════════════════════════════╝\n');

        console.log('✅ Pegawai berhasil ditambahkan!');
        console.log('📌 Silakan print slip di atas untuk registrasi fingerprint\n');

    } catch (error) {
        console.error('❌ ERROR:', error.message);
    } finally {
        rl.close();
        await prisma.$disconnect();
    }
}

main();
