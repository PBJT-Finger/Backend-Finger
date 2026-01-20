// One-time migration script to hash existing plaintext API keys
// Run this ONCE after deploying API key hashing changes

const { Device } = require('../src/models');
const bcrypt = require('bcrypt');

async function hashExistingApiKeys() {
    console.log('🔄 Starting API key hashing migration...\n');

    try {
        const devices = await Device.findAll();
        console.log(`Found ${devices.length} devices to check\n`);

        let hashedCount = 0;
        let skippedCount = 0;

        for (const device of devices) {
            // Check if already hashed (bcrypt hashes start with $2b$)
            if (device.api_key.startsWith('$2b$')) {
                console.log(`⏩ Skipping ${device.device_id} - already hashed`);
                skippedCount++;
                continue;
            }

            console.log(`🔐 Hashing API key for device: ${device.device_id}`);
            const plainApiKey = device.api_key;

            // Hash with 10 rounds
            const hashedApiKey = await bcrypt.hash(plainApiKey, 10);

            // Update device (bypass beforeUpdate hook to avoid double hashing)
            await device.update({ api_key: hashedApiKey }, { hooks: false });

            // Verify the hash works
            const verified = await bcrypt.compare(plainApiKey, hashedApiKey);
            if (verified) {
                console.log(`✅ Successfully hashed and verified: ${device.device_id}`);
                hashedCount++;
            } else {
                console.error(`❌ Verification failed for: ${device.device_id}`);
            }
        }

        console.log('\n' + '='.repeat(50));
        console.log(`✅ Migration complete!`);
        console.log(`   - Hashed: ${hashedCount} devices`);
        console.log(`   - Skipped (already hashed): ${skippedCount} devices`);
        console.log(`   - Total: ${devices.length} devices`);
        console.log('='.repeat(50));

    } catch (error) {
        console.error('\n❌ Migration failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Run migration
hashExistingApiKeys()
    .then(() => {
        console.log('\n✅ Safe to exit. Press Ctrl+C or wait for auto-exit.');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Unexpected error:', error);
        process.exit(1);
    });
