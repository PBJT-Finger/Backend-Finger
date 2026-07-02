const { ZKLib } = require('zklib-js'); // Assuming zklib-js is used. Wait, we have zklib-client
const { ZkDeviceClient } = require('./src/infrastructure/zk-client');

async function main() {
    console.log("Testing ZK Device Cache directly...");
    // Using direct connection to 175.17.5.50 to see users
    let zkInstance = new ZKLib('175.17.5.50', 4370, 5200, 5000);
    try {
        await zkInstance.createSocket();
    } catch (e) {
        console.log("Error socket", e);
    }

    try {
        const users = await zkInstance.getUsers();
        console.log(`Found ${users.data.length} users on device.`);
        const melindas = users.data.filter(u => u.name && u.name.includes('Melinda'));
        console.log("Melindas on device:", melindas);
        console.log("User where ID is 1:", users.data.filter(u => String(u.userId).trim() === '1'));
    } catch (e) {
        console.error(e);
    } finally {
        await zkInstance.disconnect();
    }
}

main().catch(console.error);
