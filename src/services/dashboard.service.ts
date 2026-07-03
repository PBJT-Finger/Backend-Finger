// src/services/dashboard.service.ts
import { AttendanceRepository } from '../repositories/attendance.repository';

export class DashboardService {
  private attendanceRepo: AttendanceRepository;

  constructor() {
    this.attendanceRepo = new AttendanceRepository();
  }

  public async getDashboardSummary() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // 1. Ambil data absen hari ini
    const todayAttendance = await this.attendanceRepo.findRecordsByPeriod(today, tomorrow);

    // 2. Ambil total karyawan, dosen, device
    const counts = await this.attendanceRepo.getEmployeeCounts();

    const stats: Record<string, any> = {
      today: {
        total_attendance: todayAttendance.length,
        unique_employees: new Set(todayAttendance.map((a) => a.user_id)).size,
        hadir: todayAttendance.filter((a) => a.jam_masuk !== null).length,
        terlambat: todayAttendance.filter((a) => a.status === 'TERLAMBAT').length,
        dosen: todayAttendance.filter((a) => a.jabatan === 'DOSEN').length,
        karyawan: todayAttendance.filter((a) => a.jabatan === 'KARYAWAN' || !a.jabatan).length,
      },
      total: {
        employees: counts.dosenCount + counts.karyawanCount,
        dosen: counts.dosenCount,
        karyawan: counts.karyawanCount,
        devices: counts.deviceCount,
      }
    };

    stats['today'].attendance_percentage =
      stats['total'].employees > 0
        ? Math.round((stats['today'].unique_employees / stats['total'].employees) * 100)
        : 0;

    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const firstDayOfNextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

    const monthlyCount = await this.attendanceRepo.countByPeriod(firstDayOfMonth, firstDayOfNextMonth);
    stats['monthly'] = { total_attendance: monthlyCount };

    // 3. Ambil tren mingguan (7 hari terakhir)
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

    const weekAttendance = await this.attendanceRepo.findRecordsByPeriod(sevenDaysAgo, tomorrow);

    const dailyStatsMap = new Map<string, any>();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0] as string;
      dailyStatsMap.set(dateStr, {
        date: dateStr,
        total: 0,
        hadir: 0,
        terlambat: 0,
        dosen: 0,
        karyawan: 0
      });
    }

    weekAttendance.forEach((a) => {
      const dateStr = new Date(a.tanggal).toISOString().split('T')[0] as string;
      if (dailyStatsMap.has(dateStr)) {
        const stat = dailyStatsMap.get(dateStr)!;
        stat.total += 1;
        if (a.jam_masuk) stat.hadir += 1;
        if (a.status === 'TERLAMBAT') stat.terlambat += 1;
        if (a.jabatan === 'DOSEN') stat.dosen += 1;
        else stat.karyawan += 1;
      }
    });

    const recentRaw = await this.attendanceRepo.getRecentAttendance(10);
    const recent = recentRaw.map(record => ({
      ...record,
      // Fallback null to undefined for type safety in strictly typed environments
      jam_masuk: record.jam_masuk || undefined,
      jam_keluar: record.jam_keluar || undefined
    }));

    return {
      stats,
      trend: Array.from(dailyStatsMap.values()),
      recent
    };
  }
}
