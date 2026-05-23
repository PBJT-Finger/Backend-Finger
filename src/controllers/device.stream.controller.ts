import { Request, Response } from 'express';
import { ZkDeviceClient, type DeviceStatus, type AttendanceRecord } from '../infrastructure/zk-client';
import prisma from '../config/prisma';

/** Shape sent to the frontend for each historical/live record. */
export interface SseAttendanceRecord {
  userSn: number;
  nama: string;
  jabatan: string;
  status: string;
  statusKeluar: string;
  jamMasuk: string | null;
  jamKeluar: string | null;
  recordTime: string;
  ip: string;
  source: 'history' | 'live';
}

const HISTORY_FETCH_TIMEOUT_MS = 5_000;

/** Safely write to SSE stream — ignores errors on a closed connection. */
function sseWrite(res: Response, event: string, data: unknown): void {
  try {
    if (!res.writableEnded) {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      if (typeof (res as unknown as { flush?: () => void }).flush === 'function') {
        (res as unknown as { flush: () => void }).flush();
      }
    }
  } catch {
    // Connection already closed — ignore silently
  }
}

export const streamDeviceEvents = async (req: Request, res: Response): Promise<void> => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const client = ZkDeviceClient.getInstance();

  // 1. Send device status immediately — non-blocking
  sseWrite(res, 'status', { status: client.getStatus() });

  // 2. Send an empty init IMMEDIATELY so the frontend exits the loading state.
  sseWrite(res, 'init', { records: [] });

  // 3. Fetch DB history in the background with a timeout guard.
  const historyTimeout = setTimeout(() => {
    console.warn('[SSE] DB history fetch timed out — sending empty history');
    sseWrite(res, 'history', { records: [] });
  }, HISTORY_FETCH_TIMEOUT_MS);

  prisma.attendance.findMany({
    where: { is_deleted: false },
    orderBy: { created_at: 'desc' },
    take: 40,
    select: {
      id: true,
      user_id: true,
      nama: true,
      jabatan: true,
      status: true,
      status_keluar: true,
      jam_masuk: true,
      jam_keluar: true,
      created_at: true,
      device_id: true
    },
  }).then((recentLogs) => {
    clearTimeout(historyTimeout);
    const history: SseAttendanceRecord[] = recentLogs.map((row) => ({
      userSn: row.id,
      nama: row.nama,
      jabatan: row.jabatan,
      status: row.status ?? 'HADIR',
      statusKeluar: row.status_keluar ?? 'HADIR',
      jamMasuk: row.jam_masuk?.toISOString() ?? null,
      jamKeluar: row.jam_keluar?.toISOString() ?? null,
      recordTime: (row.jam_keluar || row.jam_masuk || row.created_at || new Date()).toISOString(),
      ip: row.device_id ?? 'DB',
      source: 'history',
    }));
    sseWrite(res, 'history', { records: history });
  }).catch((err) => {
    clearTimeout(historyTimeout);
    console.error('[SSE] DB history fetch failed:', err);
    sseWrite(res, 'history', { records: [] });
  });

  // 4. Wire live device events
  const handleStatus = (status: DeviceStatus) => sseWrite(res, 'status', { status });

  const handleAttendance = async (records: AttendanceRecord[]) => {
    try {
      const userIds = records.map((r) => String(r.deviceUserId));

      const employees = await prisma.employees.findMany({
        where: { user_id: { in: userIds }, is_active: true },
        include: { shifts: true }
      });
      const empMap = new Map(employees.map((e) => [e.user_id, e]));

      const liveRecords: SseAttendanceRecord[] = records.map((r) => {
        const user_id = String(r.deviceUserId);
        const emp = empMap.get(user_id);
        const devName = client.getDeviceUserName(r.deviceUserId);

        const resolvedName = emp?.nama ?? devName ?? `Karyawan ${r.deviceUserId}`;
        const resolvedJabatan = emp?.jabatan ?? 'KARYAWAN';

        const scanTime = r.recordTime;
        const hour = scanTime.getUTCHours();

        let jamMasuk: string | null = null;
        let jamKeluar: string | null = null;
        let status = 'HADIR';
        let statusKeluar = 'HADIR';

        if (hour < 12) {
          jamMasuk = scanTime.toISOString();
          const shiftStartHour = emp?.shifts ? new Date(emp.shifts.jam_masuk).getUTCHours() : 8;
          const shiftStartMinute = emp?.shifts ? new Date(emp.shifts.jam_masuk).getUTCMinutes() : 0;
          const scanMinutes = scanTime.getUTCHours() * 60 + scanTime.getUTCMinutes();
          const shiftMinutes = shiftStartHour * 60 + shiftStartMinute;
          status = scanMinutes > (shiftMinutes + 15) ? 'TERLAMBAT' : 'HADIR';
        } else {
          jamKeluar = scanTime.toISOString();
          const shiftEndHour = emp?.shifts ? new Date(emp.shifts.jam_keluar).getUTCHours() : 16;
          const shiftEndMinute = emp?.shifts ? new Date(emp.shifts.jam_keluar).getUTCMinutes() : 30;
          const scanMinutes = scanTime.getUTCHours() * 60 + scanTime.getUTCMinutes();
          const targetMinutes = emp?.shifts ? (shiftEndHour * 60 + shiftEndMinute) : 990;
          statusKeluar = scanMinutes < targetMinutes ? 'PULANG_CEPAT' : 'HADIR';
        }

        return {
          userSn: r.userSn,
          nama: resolvedName,
          jabatan: resolvedJabatan,
          status,
          statusKeluar,
          jamMasuk,
          jamKeluar,
          recordTime: scanTime.toISOString(),
          ip: r.ip,
          source: 'live',
        };
      });
      
      sseWrite(res, 'attendance', { records: liveRecords });
    } catch (error) {
      console.error('[SSE] Failed to enrich attendance records:', error);
    }
  };

  client.on('status', handleStatus);
  client.on('attendance', handleAttendance);

  // Keep-alive ping every 30 seconds
  const pingInterval = setInterval(() => {
    if (!res.writableEnded) res.write(': ping\n\n');
    else clearInterval(pingInterval);
  }, 30_000);

  req.on('close', () => {
    clearInterval(pingInterval);
    clearTimeout(historyTimeout);
    client.off('status', handleStatus);
    client.off('attendance', handleAttendance);
  });
};


