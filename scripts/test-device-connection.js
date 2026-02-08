// scripts/test-device-connection.js
// Test connection to fingerprint device
// Usage: node scripts/test-device-connection.js

require('dotenv').config();
const fingerprintService = require('../src/services/fingerprint.service');

async function testConnection() {
    console.log('🔍 Testing fingerprint device connection...\n');
    console.log(`Device IP: ${process.env.FINGERPRINT_IP}`);
    console.log(`Device Port: ${process.env.FINGERPRINT_PORT}\n`);

    try {
        // Test connection
        console.log('🔌 Attempting to connect...');
        await fingerprintService.connect();
        console.log('✅ Connection successful!\n');

        // Get device info
        console.log('📊 Fetching device information...');
        const users = await fingerprintService.getUsers();
        console.log(`✅ Total users in device: ${users.length}\n`);

        console.log('📋 Sample users:');
        users.slice(0, 5).forEach(user => {
            console.log(`   - User ID: ${user.userId}, Name: ${user.name || 'N/A'}`);
        });

        // Get attendance logs
        console.log('\n📥 Fetching attendance logs...');
        const logs = await fingerprintService.getAttendanceLogs();
        console.log(`✅ Total attendance logs: ${logs.length}\n`);

        if (logs.length > 0) {
            console.log('📋 Recent logs:');
            logs.slice(-5).forEach(log => {
                console.log(`   - User ${log.deviceUserId}: ${new Date(log.recordTime).toLocaleString()}`);
            });
        }

        // Disconnect
        await fingerprintService.disconnect();
        console.log('\n✅ Test completed successfully!');
        console.log('\n🎉 Device is ready for integration!');

    } catch (error) {
        console.error('\n❌ Connection test failed!');
        console.error('Error Type:', typeof error);
        console.error('Error Message:', error?.message || 'undefined');
        console.error('Error Stack:', error?.stack || 'No stack trace');
        console.error('Full Error Object:', JSON.stringify(error, null, 2));

        console.error('\n🔧 Troubleshooting:');
        console.error('   1. Check device is powered on');
        console.error(`   2. Verify IP address in .env: FINGERPRINT_IP=${process.env.FINGERPRINT_IP}`);
        console.error(`   3. Verify PORT in .env: FINGERPRINT_PORT=${process.env.FINGERPRINT_PORT}`);
        console.error('   4. Test network: ping 172.17.2.250');
        console.error(`   5. Port ${process.env.FINGERPRINT_PORT} might not be ZKTeco protocol port`);
        console.error('   6. Check device manual for correct TCP/IP protocol port');
        console.error('   7. Common ZKTeco ports: 4370, 4380, 8080');
        process.exit(1);
    }
}

testConnection();
