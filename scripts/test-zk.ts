import { ZkDeviceClient } from '../src/infrastructure/zk-client';
import { env } from '../src/config/env';

async function run() {
  console.log(`Connecting to ${env.FINGERPRINT_IP}:${env.FINGERPRINT_PORT}...`);
  const zk = ZkDeviceClient.getInstance();
  
  zk.on('attendance', (records) => {
    console.log('Received attendance records:', records.length);
    const atiekRecords = records.filter(r => r.deviceUserId === '7' || r.deviceUserId === '15' || r.deviceUserId === '11');
    console.log('Atiek records:', atiekRecords);
  });
  
  zk.on('error', (err) => {
    console.error('ZK Error:', err);
  });
  
  await zk.start();
  
  // wait 5 seconds to let it pull data
  setTimeout(async () => {
    const users = zk.getCachedUsers();
    console.log(`Total users in cache: ${users.length}`);
    const atiek = users.filter(u => u.name.toLowerCase().includes('atiek'));
    console.log('Found Atiek on device:', atiek);
    
    await zk.stop();
    process.exit(0);
  }, 15000);
}
run().catch(console.error);
