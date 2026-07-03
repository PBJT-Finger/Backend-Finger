import prisma from '../config/prisma';

export class HolidayRepository {
  public async findHolidaysInRange(startDate: Date | null, endDate: Date | null) {
    const where: any = {};
    if (startDate || endDate) {
      where.tanggal = {};
      if (startDate) where.tanggal.gte = startDate;
      if (endDate) where.tanggal.lte = endDate;
    }
    return prisma.holidays.findMany({
      where,
      select: { tanggal: true },
    });
  }
}
