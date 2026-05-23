import dotenv from 'dotenv';
dotenv.config();

// @ts-ignore
import ZKLib from 'node-zklib';

if (!process.env.FINGERPRINT_IP) {
  console.error('[FATAL] FINGERPRINT_IP is not set in .env');
  process.exit(1);
}
const DEVICE_IP = process.env.FINGERPRINT_IP;
const DEVICE_PORT = parseInt(process.env.FINGERPRINT_PORT ?? '4370', 10);
const CONNECTION_TIMEOUT_MS = parseInt(process.env.FINGERPRINT_TIMEOUT ?? '10000', 10);
const IN_PORT_TIMEOUT_MS = parseInt(process.env.IN_PORT_TIMEOUT_MS ?? '4000', 10);

async function seedUser(): Promise<void> {
    console.log(`[INFO] Connecting to ${DEVICE_IP}:${DEVICE_PORT}...`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const zkInstance: any = new (ZKLib as any)(DEVICE_IP, DEVICE_PORT, CONNECTION_TIMEOUT_MS, IN_PORT_TIMEOUT_MS);

    try {
        await zkInstance.createSocket();
        console.log('[SUCCESS] Connected to device.');

        console.log('[INFO] Injecting dummy user (ID: 100, Name: User Node, PIN: 12345)...');
        // Parameter node-zklib v1.3.0 setUser: (uid, userid, name, password, role = 0, cardno = 0)
        // uid (integer internal mesin), userid (string ID karyawan)
        await zkInstance.setUser(100, '100', 'User Node', '12345', 0, 0);
        console.log('[SUCCESS] User injected to device.');

        console.log('[INFO] Fetching all users from device to verify...');
        const users = await zkInstance.getUsers();
        console.log('[DATA] Users currently in device:', users?.data);

    } catch (error) {
        console.error('[ERROR] Failed to execute seed:', error);
    } finally {
        console.log('[INFO] Disconnecting...');
        try {
            await zkInstance.disconnect();
        } catch (e) {
            // Abaikan error disconnect dari library
        }
    }
}

seedUser();
