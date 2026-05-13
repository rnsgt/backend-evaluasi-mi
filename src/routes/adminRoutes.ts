import express from 'express';
const router = express.Router();
import { prisma } from '../config/database.js';
import { authMiddleware, adminMiddleware } from '../middleware/authMiddleware.js';

// All routes require admin access
router.use(authMiddleware, adminMiddleware);

// Helper to safely convert BigInt to Number for JSON serialization in Prisma 7
const serialize = (obj: any): any => {
  return JSON.parse(
    JSON.stringify(obj, (key, value) =>
      typeof value === 'bigint' ? Number(value) : value
    )
  );
};

// Dashboard statistics
router.get('/dashboard', async (req, res) => {
  try {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      todayDosen, todayFasilitas,
      weekDosen, weekFasilitas,
      monthDosen, monthFasilitas,
      totalDosenEval, totalFasilitasEval,
      totalDosen, totalFasilitas,
      totalMahasiswa
    ] = await Promise.all([
      prisma.evaluasi_dosen.count({ where: { submitted_at: { gte: startOfToday } } }),
      prisma.evaluasi_fasilitas.count({ where: { submitted_at: { gte: startOfToday } } }),
      prisma.evaluasi_dosen.count({ where: { submitted_at: { gte: startOfWeek } } }),
      prisma.evaluasi_fasilitas.count({ where: { submitted_at: { gte: startOfWeek } } }),
      prisma.evaluasi_dosen.count({ where: { submitted_at: { gte: startOfMonth } } }),
      prisma.evaluasi_fasilitas.count({ where: { submitted_at: { gte: startOfMonth } } }),
      prisma.evaluasi_dosen.count(),
      prisma.evaluasi_fasilitas.count(),
      prisma.dosen.count(),
      prisma.fasilitas.count(),
      prisma.users.count({ where: { role: 'mahasiswa' } })
    ]);

    const activePeriode = await prisma.periode_evaluasi.findFirst({
      where: { status: 'aktif' },
      select: { id: true, nama: true }
    });

    let uniqueMahasiswaCount = 0;
    if (activePeriode) {
      const uniqueResult = await prisma.$queryRaw`
        SELECT COUNT(DISTINCT user_id)::int as total FROM (
          SELECT user_id FROM evaluasi_dosen WHERE periode_id = ${activePeriode.id}
          UNION
          SELECT user_id FROM evaluasi_fasilitas WHERE periode_id = ${activePeriode.id}
        ) as combined
      `;
      uniqueMahasiswaCount = (uniqueResult as any)[0]?.total || 0;
    } else {
      const uniqueResult = await prisma.$queryRaw`
        SELECT COUNT(DISTINCT user_id)::int as total FROM (
          SELECT user_id FROM evaluasi_dosen
          UNION
          SELECT user_id FROM evaluasi_fasilitas
        ) as combined
      `;
      uniqueMahasiswaCount = (uniqueResult as any)[0]?.total || 0;
    }

    const partisipasiPersen = totalMahasiswa > 0 ? ((uniqueMahasiswaCount / totalMahasiswa) * 100).toFixed(1) : 0;

    const topDosenResult = await prisma.$queryRaw`
      SELECT 
        d.id, d.nama, d.nip,
        COUNT(DISTINCT ed.id)::int as jumlah_evaluasi,
        COALESCE(ROUND(AVG(detail.nilai)::numeric, 2)::float, 0) as rata_rata
      FROM dosen d
      JOIN evaluasi_dosen ed ON d.id = ed.dosen_id
      JOIN evaluasi_detail detail ON ed.id = detail.evaluasi_dosen_id
      GROUP BY d.id, d.nama, d.nip
      ORDER BY rata_rata DESC
      LIMIT 5
    `;

    const overallFasilitasScoreResult = await prisma.$queryRaw`
      SELECT 
        COALESCE(ROUND(AVG(detail.nilai)::numeric, 2)::float, 0) as rata_rata
      FROM evaluasi_fasilitas ef
      JOIN evaluasi_detail detail ON ef.id = detail.evaluasi_fasilitas_id
    `;

    const fasilitasPerluPerbaikanResult = await prisma.$queryRaw`
      SELECT 
        f.id, f.nama, f.kategori, f.lokasi,
        COUNT(DISTINCT ef.id)::int as jumlah_evaluasi,
        COALESCE(ROUND(AVG(detail.nilai)::numeric, 2)::float, 0) as rata_rata
      FROM fasilitas f
      JOIN evaluasi_fasilitas ef ON f.id = ef.fasilitas_id
      JOIN evaluasi_detail detail ON ef.id = detail.evaluasi_fasilitas_id
      GROUP BY f.id, f.nama, f.kategori, f.lokasi
      HAVING AVG(detail.nilai) < 3.5
      ORDER BY rata_rata ASC
      LIMIT 5
    `;

    res.json(serialize({
      success: true,
      data: {
        evaluasiHariIni: todayDosen + todayFasilitas,
        evaluasiMingguIni: weekDosen + weekFasilitas,
        evaluasiBulanIni: monthDosen + monthFasilitas,
        totalEvaluasi: totalDosenEval + totalFasilitasEval,
        totalDosen,
        totalFasilitas,
        totalMahasiswa,
        evaluasiDosen: totalDosenEval,
        evaluasiFasilitas: totalFasilitasEval,
        partisipasi: {
          uniqueMahasiswa: uniqueMahasiswaCount,
          totalMahasiswa,
          persentase: parseFloat(String(partisipasiPersen)),
          periodeId: activePeriode?.id || null,
          periodeNama: activePeriode?.nama || null
        },
        topDosen: topDosenResult,
        fasilitasPerluPerbaikan: fasilitasPerluPerbaikanResult,
        overallFasilitasScore: (overallFasilitasScoreResult as any)[0]?.rata_rata || 0
      }
    }));
  } catch (error: any) {
    console.error('Dashboard Error:', error);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server dashboard', error: error.message });
  }
});

// Laporan evaluasi with detailed results (Full Restoration)
router.get('/laporan', async (req, res) => {
  try {
    const { periode_id, tipe } = req.query as any;
    const validPeriodeId = periode_id ? parseInt(periode_id) : null;

    let laporanDosen: any[] = [];
    let laporanFasilitas: any[] = [];

    // Detailed Laporan Dosen
    if (!tipe || tipe === 'dosen' || tipe === 'semua') {
      const dosenList = await prisma.dosen.findMany({
        select: { id: true, nama: true, nip: true }
      });

      const allPernyataan = await prisma.pernyataan_dosen.findMany();
      const pernyataanMap = new Map(allPernyataan.map(p => [p.id, p.kategori]));

      for (const dosen of dosenList) {
        const evaluasiList = await prisma.evaluasi_dosen.findMany({
          where: {
            dosen_id: dosen.id,
            ...(validPeriodeId && { periode_id: validPeriodeId })
          },
          include: { evaluasi_detail: true, mata_kuliah: true }
        });

        if (evaluasiList.length === 0) continue;

        const allNilai = evaluasiList.flatMap(ev => ev.evaluasi_detail.map(d => d.nilai));
        const avgRating = allNilai.length > 0 ? Number((allNilai.reduce((a, b) => a + b, 0) / allNilai.length).toFixed(2)) : 0;

        // Group by category
        const kategoriStats: Record<string, { sum: number, count: number }> = {};
        evaluasiList.forEach(ev => {
          ev.evaluasi_detail.forEach(det => {
            const kategori = pernyataanMap.get(det.pernyataan_dosen_id!);
            if (kategori) {
              if (!kategoriStats[kategori]) kategoriStats[kategori] = { sum: 0, count: 0 };
              kategoriStats[kategori].sum += det.nilai;
              kategoriStats[kategori].count += 1;
            }
          });
        });

        const detailKategori = Object.entries(kategoriStats).map(([kat, stats]) => ({
          kategori: kat,
          rata_rata: Number((stats.sum / stats.count).toFixed(2)),
          total_jawaban: stats.count
        }));

        const detailEvaluasi = evaluasiList.map(ev => {
          const evKategoriStats: Record<string, { sum: number, count: number }> = {};
          ev.evaluasi_detail.forEach(det => {
            const kategori = pernyataanMap.get(det.pernyataan_dosen_id!);
            if (kategori) {
              if (!evKategoriStats[kategori]) evKategoriStats[kategori] = { sum: 0, count: 0 };
              evKategoriStats[kategori].sum += det.nilai;
              evKategoriStats[kategori].count += 1;
            }
          });

          const evDetailKategori = Object.entries(evKategoriStats).map(([kat, stats]) => ({
            kategori: kat,
            rata_rata: Number((stats.sum / stats.count).toFixed(2)),
            total_jawaban: stats.count
          }));

          return {
            id: ev.id,
            submitted_at: ev.submitted_at,
            komentar: ev.komentar || '',
            mata_kuliah: (ev as any).mata_kuliah?.nama || 'Umum',
            rata_rata: ev.evaluasi_detail.length > 0 ? Number((ev.evaluasi_detail.reduce((sum, d) => sum + d.nilai, 0) / ev.evaluasi_detail.length).toFixed(2)) : 0,
            jumlah_jawaban: ev.evaluasi_detail.length,
            detail_kategori: evDetailKategori
          };
        });

        laporanDosen.push({
          id: dosen.id,
          nama: dosen.nama,
          nip: dosen.nip,
          jumlah_evaluasi: evaluasiList.length,
          rata_rata: avgRating,
          total_jawaban: allNilai.length,
          komentar_list: evaluasiList.filter(ev => ev.komentar).map(ev => ({ komentar: ev.komentar, submitted_at: ev.submitted_at })),
          detail_kategori: detailKategori,
          detail_evaluasi: detailEvaluasi
        });
      }
    }

    // Detailed Laporan Fasilitas
    if (!tipe || tipe === 'fasilitas' || tipe === 'semua') {
      const fasilitasList = await prisma.fasilitas.findMany();
      const allPernyataanFas = await prisma.pernyataan_fasilitas.findMany();
      const pernyataanFasMap = new Map(allPernyataanFas.map(p => [p.id, p.kategori]));

      for (const fasilitas of fasilitasList) {
        const evaluasiList = await prisma.evaluasi_fasilitas.findMany({
          where: {
            fasilitas_id: fasilitas.id,
            ...(validPeriodeId && { periode_id: validPeriodeId })
          },
          include: { evaluasi_detail: true }
        });

        if (evaluasiList.length === 0) continue;

        const allNilai = evaluasiList.flatMap(ev => ev.evaluasi_detail.map(d => d.nilai));
        const avgRating = allNilai.length > 0 ? Number((allNilai.reduce((a, b) => a + b, 0) / allNilai.length).toFixed(2)) : 0;

        const kategoriStats: Record<string, { sum: number, count: number }> = {};
        evaluasiList.forEach(ev => {
          ev.evaluasi_detail.forEach(det => {
            const kategori = pernyataanFasMap.get(det.pernyataan_fasilitas_id!);
            if (kategori) {
              if (!kategoriStats[kategori]) kategoriStats[kategori] = { sum: 0, count: 0 };
              kategoriStats[kategori].sum += det.nilai;
              kategoriStats[kategori].count += 1;
            }
          });
        });

        laporanFasilitas.push({
          id: fasilitas.id,
          nama: fasilitas.nama,
          kode: fasilitas.kode,
          kategori: fasilitas.kategori,
          lokasi: fasilitas.lokasi,
          jumlah_evaluasi: evaluasiList.length,
          rata_rata: avgRating,
          total_jawaban: allNilai.length,
          komentar_list: evaluasiList.filter(ev => ev.komentar).map(ev => ({ komentar: ev.komentar, submitted_at: ev.submitted_at })),
          detail_kategori: Object.entries(kategoriStats).map(([kat, stats]) => ({ kategori: kat, rata_rata: Number((stats.sum / stats.count).toFixed(2)), total_jawaban: stats.count })),
          detail_evaluasi: evaluasiList.map(ev => {
            const evKategoriStats: Record<string, { sum: number, count: number }> = {};
            ev.evaluasi_detail.forEach(det => {
              const kategori = pernyataanFasMap.get(det.pernyataan_fasilitas_id!);
              if (kategori) {
                if (!evKategoriStats[kategori]) evKategoriStats[kategori] = { sum: 0, count: 0 };
                evKategoriStats[kategori].sum += det.nilai;
                evKategoriStats[kategori].count += 1;
              }
            });

            const evDetailKategori = Object.entries(evKategoriStats).map(([kat, stats]) => ({
              kategori: kat,
              rata_rata: Number((stats.sum / stats.count).toFixed(2)),
              total_jawaban: stats.count
            }));

            return {
              id: ev.id,
              submitted_at: ev.submitted_at,
              komentar: ev.komentar || '',
              rata_rata: ev.evaluasi_detail.length > 0 ? Number((ev.evaluasi_detail.reduce((sum, d) => sum + d.nilai, 0) / ev.evaluasi_detail.length).toFixed(2)) : 0,
              jumlah_jawaban: ev.evaluasi_detail.length,
              detail_kategori: evDetailKategori
            };
          })
        });
      }
    }

    res.json(serialize({ success: true, data: { dosen: laporanDosen, fasilitas: laporanFasilitas } }));
  } catch (error: any) {
    console.error('Laporan Error:', error);
    res.status(500).json({ success: false, message: 'Gagal memuat laporan', error: error.message });
  }
});

// Daily trend data (evaluasi per hari)
router.get('/daily-trend', async (req, res) => {
  try {
    const { days = 7 } = req.query as any;
    const daysCount = parseInt(days) || 7;
    const now = new Date();
    const startDate = new Date(now.getTime() - daysCount * 24 * 60 * 60 * 1000);
    startDate.setHours(0,0,0,0);

    const dailyData = await prisma.$queryRaw`
      SELECT 
        DATE(created_at) as tanggal,
        COUNT(*)::int as total_evaluasi,
        SUM(CASE WHEN evaluasi_dosen_id IS NOT NULL THEN 1 ELSE 0 END)::int as evaluasi_dosen,
        SUM(CASE WHEN evaluasi_fasilitas_id IS NOT NULL THEN 1 ELSE 0 END)::int as evaluasi_fasilitas
      FROM evaluasi_detail
      WHERE created_at >= ${startDate}
      GROUP BY DATE(created_at)
      ORDER BY DATE(created_at) ASC
    `;

    const labels: string[] = [];
    const totalSeries: number[] = [];
    const dosenSeries: number[] = [];
    const fasilitasSeries: number[] = [];

    for (let i = daysCount; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dStr = d.toISOString().split('T')[0];
      const found = (dailyData as any[]).find(item => new Date(item.tanggal).toISOString().split('T')[0] === dStr);
      labels.push(`${d.getDate()}/${d.getMonth() + 1}`);
      totalSeries.push(found ? found.total_evaluasi : 0);
      dosenSeries.push(found ? found.evaluasi_dosen : 0);
      fasilitasSeries.push(found ? found.evaluasi_fasilitas : 0);
    }

    res.json(serialize({
      success: true,
      data: {
        labels,
        datasets: [
          { data: totalSeries, label: 'Total', color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})` },
          { data: dosenSeries, label: 'Dosen', color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})` },
          { data: fasilitasSeries, label: 'Fasilitas', color: (opacity = 1) => `rgba(245, 158, 11, ${opacity})` }
        ]
      }
    }));
  } catch (error: any) {
    console.error('Daily Trend Error:', error);
    res.status(500).json({ success: false, message: 'Gagal memuat tren harian', error: error.message });
  }
});

// Other statements routes... (keeping them from previous version)
router.get('/pernyataan/dosen', async (req, res) => {
  try {
    const data = await prisma.pernyataan_dosen.findMany({ orderBy: { urutan: 'asc' } });
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Gagal mengambil data' });
  }
});

router.post('/pernyataan/dosen', async (req, res) => {
  try {
    const { kategori, pernyataan, urutan } = req.body;
    const data = await prisma.pernyataan_dosen.create({ data: { kategori, pernyataan, urutan: parseInt(urutan) || 0 } });
    res.json({ success: true, message: 'Pertanyaan berhasil ditambahkan', data });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Gagal menambahkan data' });
  }
});

router.put('/pernyataan/dosen/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { kategori, pernyataan, urutan } = req.body;
    const data = await prisma.pernyataan_dosen.update({ where: { id: parseInt(id) }, data: { kategori, pernyataan, urutan: parseInt(urutan) } });
    res.json({ success: true, message: 'Pertanyaan berhasil diperbarui', data });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Gagal memperbarui data' });
  }
});

router.delete('/pernyataan/dosen/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.pernyataan_dosen.delete({ where: { id: parseInt(id) } });
    res.json({ success: true, message: 'Pertanyaan berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Gagal menghapus data' });
  }
});

router.get('/pernyataan/fasilitas', async (req, res) => {
  try {
    const data = await prisma.pernyataan_fasilitas.findMany({ orderBy: { urutan: 'asc' } });
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Gagal mengambil data' });
  }
});

router.post('/pernyataan/fasilitas', async (req, res) => {
  try {
    const { kategori, pernyataan, urutan } = req.body;
    const data = await prisma.pernyataan_fasilitas.create({ data: { kategori, pernyataan, urutan: parseInt(urutan) || 0 } });
    res.json({ success: true, message: 'Pertanyaan berhasil ditambahkan', data });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Gagal menambahkan data' });
  }
});

router.put('/pernyataan/fasilitas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { kategori, pernyataan, urutan } = req.body;
    const data = await prisma.pernyataan_fasilitas.update({ where: { id: parseInt(id) }, data: { kategori, pernyataan, urutan: parseInt(urutan) } });
    res.json({ success: true, message: 'Pertanyaan berhasil diperbarui', data });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Gagal memperbarui data' });
  }
});

router.delete('/pernyataan/fasilitas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.pernyataan_fasilitas.delete({ where: { id: parseInt(id) } });
    res.json({ success: true, message: 'Pertanyaan berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Gagal menghapus data' });
  }
});

export default router;
