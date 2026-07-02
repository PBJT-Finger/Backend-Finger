import { ZkDeviceClient } from '../src/infrastructure/zk-client';

async function main() {
    const client = ZkDeviceClient.getInstance();
    console.log("Starting client connection to device...");
    await client.start();

    // Wait 10 seconds for the first device poll to finish fetching users
    await new Promise(r => setTimeout(r, 10000));

    const users = client.getCachedUsers();
    console.log("Found device users:", users.length);

    const melinda = users.find((u: any) => u.name && u.name.toLowerCase().includes('melinda'));
    if (melinda) {
        console.log("MELINDA DETECTED IN HARDWARE MEMORY:");
        console.log(JSON.stringify(melinda, null, 2));
    } else {
        console.log("Melinda not found in hardware memory by that name.");
        if (users.length > 0) {
            console.log("Here are some sample IDs:");
            console.log(JSON.stringify(users.slice(0, 5), null, 2));
        }
    }
    await client.stop();
}

main().catch(console.error).finally(() => process.exit(0));
