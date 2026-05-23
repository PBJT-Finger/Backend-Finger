import dotenv from 'dotenv';
dotenv.config();

import { ZkTcpClient } from '../src/infrastructure/zklib';

// All device configuration MUST come from .env — no fallback IPs allowed.
// Missing env vars will throw immediately to prevent silent misconfiguration.
if (!process.env.FINGERPRINT_IP) {
  console.error('[FATAL] FINGERPRINT_IP is not set in .env');
  process.exit(1);
}
const DEVICE_IP = process.env.FINGERPRINT_IP;
const DEVICE_PORT = parseInt(process.env.FINGERPRINT_PORT ?? '4370', 10);
const CONNECTION_TIMEOUT_MS = parseInt(process.env.FINGERPRINT_TIMEOUT ?? '10000', 10);

async function runConnectionProbe(): Promise<void> {
    console.log(`[INFO] Initializing connection to ${DEVICE_IP}:${DEVICE_PORT}...`);
    
    const zkInstance = new ZkTcpClient(DEVICE_IP, DEVICE_PORT, CONNECTION_TIMEOUT_MS);

    try {
        console.log('[INFO] Attempting to create socket...');
        await zkInstance.createSocket();
        await zkInstance.connect();
        console.log('[SUCCESS] Socket successfully established and session connected.');

        // Test 1: Device Info
        try {
            console.log('\n[1/3] Fetching device info...');
            const deviceInfo = await zkInstance.getInfo();
            console.log('[DATA] Device Info:', deviceInfo);
        } catch (e) {
            console.error('[ERROR] Failed to fetch device info:', e);
        }

        // Test 2: Users
        try {
            console.log('\n[2/3] Fetching users (Master Data)...');
            const users = await zkInstance.getUsers();
            console.log(`[DATA] Found ${users?.data?.length || 0} users.`);
            if (users?.data && users.data.length > 0) {
                console.log('[DATA] Sample Users:', users.data.slice(0, 5));
            }
        } catch (e) {
            console.error('[ERROR] Failed to fetch users:', e);
        }

        // Test 3: Attendances
        try {
            console.log('\n[3/3] Fetching recent attendance logs (Clock-ins)...');
            const attendances = await zkInstance.getAttendances();
            console.log(`[DATA] Found ${attendances?.data?.length || 0} attendance records.`);
            if (attendances?.data && attendances.data.length > 0) {
                console.log('[DATA] Sample Attendances:', attendances.data.slice(0, 5));
            }
        } catch (e) {
            console.error('[ERROR] Failed to fetch attendances. Machine buffer might still be empty or reading issue.', e);
        }

    } catch (error) {
        console.error('[ERROR] Probe failed to communicate with the edge device:', error);
    } finally {
        console.log('\n[INFO] Closing socket connection...');
        try {
            await zkInstance.disconnect();
            console.log('[SUCCESS] Connection cleanly disconnected.');
        } catch (disconnectError) {
            // Abaikan error disconnect agar exit code tetap 0
        }
    }
}

runConnectionProbe();
