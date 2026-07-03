import prisma from '../config/prisma';
import { RawAttendanceRecord } from '../utils/attendanceTransformer';

export class ExportRepository {
  public static async getGroupedAttendance(startDate: string, endDate: string, jabatan?: string, userId?: string) {
    let sql = `
      SELECT a.tanggal, a.user_id, a.nama, a.jabatan,
             MIN(a.jam_masuk) AS jam_masuk,
             MAX(a.jam_keluar) AS jam_keluar,
             MAX(a.status) AS status
      FROM attendance a
      WHERE a.tanggal >= ? AND a.tanggal <= ? AND a.is_deleted = 0
    `;

    const params: any[] = [startDate, endDate];

    if (jabatan) {
      sql += ' AND a.jabatan = ?';
      params.push(jabatan);
    }

    if (userId) {
      sql += ' AND a.user_id = ?';
      params.push(userId);
    }

    sql += ' GROUP BY a.tanggal, a.user_id, a.nama, a.jabatan';
    sql += ' ORDER BY a.tanggal DESC, jam_masuk ASC';

    return prisma.$queryRawUnsafe<RawAttendanceRecord[]>(sql, ...params);
  }

  public static async getHolidays(startDate: string, endDate: string) {
    return prisma.holidays.findMany({
      where: {
        tanggal: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      },
    });
  }
}
