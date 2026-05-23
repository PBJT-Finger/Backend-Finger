import prisma from './src/config/prisma';

(async () => {
  try {
    const dates = ['2026-05-20', '2026-05-21', '2026-05-22'];
    for (const dateStr of dates) {
      const start = new Date(dateStr);
      const end = new Date(dateStr);
      const rows = await prisma.attendance.findMany({
        where: {
          tanggal: { gte: start, lte: end },
          jabatan: { in: ['DOSEN', 'KARYAWAN'] },
        },
        orderBy: [{ user_id: 'asc' }, { id: 'asc' }],
      });
      const uniqueUsers = new Map<string, Set<number>>();
      rows.forEach((r) => {
        if (!uniqueUsers.has(r.user_id)) uniqueUsers.set(r.user_id, new Set());
        uniqueUsers.get(r.user_id)?.add(r.id);
      });
      console.log(`DATE ${dateStr} => rows=${rows.length} uniqueUsers=${uniqueUsers.size}`);
      uniqueUsers.forEach((ids, user_id) => {
        const records = rows.filter((r) => r.user_id === user_id);
        console.log(`  user=${user_id} name=${records[0]?.nama} count=${records.length} times=[${records
          .map((r) => `${r.jam_masuk ? r.jam_masuk.toISOString() : 'M'} / ${r.jam_keluar ? r.jam_keluar.toISOString() : 'K'}`)
          .join(', ')}]`);
      });
    }
  } catch (error) {
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
})();
