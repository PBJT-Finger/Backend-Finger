// Try zklib-js first, fallback to node-zklib
let ZKLib;
try {
    ZKLib = require('zklib-js');
} catch (e) {
    try {
        ZKLib = require('node-zklib');
    } catch (e2) {
        console.error('No ZKLib package found. Please install: npm install zklib-js');
        ZKLib = null;
    }
}

class FingerprintService {
    constructor() {
        if (!ZKLib) {
            throw new Error('ZKLib not available - fingerprint functionality disabled');
        }
        this.zkInstance = new ZKLib(
            process.env.FINGERPRINT_IP || '192.168.1.201',
            parseInt(process.env.FINGERPRINT_PORT) || 4370,
            parseInt(process.env.FINGERPRINT_TIMEOUT) || 5000,
            4000
        );
    }

    async connect() {
        try {
            await this.zkInstance.createSocket();
            console.log('✅ Connected to Fingerspot device');
            return true;
        } catch (error) {
            console.error('❌ Failed to connect to Fingerspot:', error.message);
            throw error;
        }
    }

    async disconnect() {
        await this.zkInstance.disconnect();
    }

    async getAttendanceLogs() {
        try {
            await this.connect();
            const logs = await this.zkInstance.getAttendances();
            await this.disconnect();
            return logs;
        } catch (error) {
            console.error('Error fetching attendance logs:', error);
            throw error;
        }
    }

    async getUsers() {
        try {
            await this.connect();
            const users = await this.zkInstance.getUsers();
            await this.disconnect();
            return users;
        } catch (error) {
            console.error('Error fetching users:', error);
            throw error;
        }
    }

    async clearAttendanceLogs() {
        try {
            await this.connect();
            await this.zkInstance.clearAttendanceLog();
            await this.disconnect();
            return true;
        } catch (error) {
            console.error('Error clearing logs:', error);
            throw error;
        }
    }
}

module.exports = new FingerprintService();