import dotenv from 'dotenv';
dotenv.config();

import { ZkTcpClient } from '../src/infrastructure/zklib';
import prisma from '../src/config/prisma';

if (!process.env.FINGERPRINT_IP) {
  console.error('[FATAL] FINGERPRINT_IP is not set in .env');
  process.exit(1);
}

const DEVICE_IP = process.env.FINGERPRINT_IP;
const DEVICE_PORT = parseInt(process.env.FINGERPRINT_PORT ?? '4370', 10);
const CONNECTION_TIMEOUT_MS = parseInt(process.env.FINGERPRINT_TIMEOUT ?? '10000', 10);

async function syncDeviceUsers(): Promise<void> {
  console.log(`[INFO] Connecting to device ${DEVICE_IP}:${DEVICE_PORT}...`);
  const zkInstance = new ZkTcpClient(DEVICE_IP, DEVICE_PORT, CONNECTION_TIMEOUT_MS);

  try {
    await zkInstance.createSocket();
    await zkInstance.connect();
    console.log('[SUCCESS] Connected to device and initialized session.');

    console.log('[INFO] Fetching master users from device...');
    const usersResponse = await zkInstance.getUsers();
    const rawUsers: any[] = usersResponse?.data || [];
    
    console.log(`[INFO] Found ${rawUsers.length} users on the device.`);

    for (const u of rawUsers) {
      const user_id = String(u.userId || u.uid);
      const nama = u.name || user_id;
      
      console.log(`[INFO] Upserting Employee -> User ID: ${user_id}, Name: ${nama}`);
      
      await prisma.employees.upsert({
        where: { user_id: user_id },
        update: {
          nama: nama,
          shift_id: 1
        },
        create: {
          user_id: user_id,
          nama: nama,
          jabatan: 'KARYAWAN', // default required by enum
          shift_id: 1,
          is_active: true
        }
      });
    }

    console.log('[SUCCESS] All users have been synced to the database.');
  } catch (error) {
    console.error('[ERROR] Failed to execute sync:', error);
  } finally {
    console.log('[INFO] Disconnecting from device & database...');
    try {
      await zkInstance.disconnect();
    } catch (e) {
      // Ignore
    }
    await prisma.$disconnect();
  }
}

syncDeviceUsers();
