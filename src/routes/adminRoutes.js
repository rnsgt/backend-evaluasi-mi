import express from 'express';
const router = express.Router();
import { prisma } from '../config/database.js';
import { authMiddleware, adminMiddleware } from '../middleware/authMiddleware.js';

// All routes require admin access
router.use(authMiddleware, adminMiddleware);

// Helper to handle BigInt serialization (Prisma 7 safety)
const serialize = (data) => {
    return JSON.parse(JSON.stringify(data, (key, value) =>
        typeof value === 'bigint' ? Number(value) : value
    ));
};

// Dashboard statistics
router.get('/dashboard', async (req, res) => {
    try {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        
        const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        // Counts using Prisma API
        const [
            todayDosen, todayFasilitas,
            weekDosen, weekFasilitas,
            monthDosen, monthFasilitas,
            totalDosen, totalFasilitas,
            totalMahasiswa
        ] = await Promise.all([
            prisma.evaluasi_dosen.count({ where: { submitted_at: { gte: startOfToday, lte: endOfToday } } }),
            prisma.evaluasi_fasilitas.count({ where: { submitted_at: { gte: startOfToday, lte: endOfToday } } }),
            prisma.evaluasi_dosen.count({ where: { submitted_at: { gte: startOfWeek } } }),
            prisma.evaluasi_fasilitas.count({ where: { submitted_at: { gte: startOfWeek } } }),
            prisma.evaluasi_dosen.count({ where: { submitted_at: { gte: startOfMonth } } }),
            prisma.evaluasi_fasilitas.count({ where: { submitted_at: { gte: startOfMonth } } }),
            prisma.evaluasi_dosen.count(),
            prisma.evaluasi_fasilitas.count(),
            prisma.users.count({ where: { role: 'mahasiswa' } })
        ]);

        // Get active periode
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
            uniqueMahasiswaCount = uniqueResult[0]?.total || 0;
        } else {
            const uniqueResult = await prisma.$queryRaw`
                SELECT COUNT(DISTINCT user_id)::int as total FROM (
                    SELECT user_id FROM evaluasi_dosen
                    UNION
                    SELECT user_id FROM evaluasi_fasilitas
                ) as combined
            `;
            uniqueMahasiswaCount = uniqueResult[0]?.total || 0;
        }

        const partisipasiPersen = totalMahasiswa > 0 ? ((uniqueMahasiswaCount / totalMahasiswa) * 100).toFixed(1) : 0;

        // Top 5 Dosen
        const topDosenResult = await prisma.$queryRaw`
            SELECT 
                d.id, d.nama,
                COUNT(DISTINCT ed.id)::int as jumlah_evaluasi,
                COALESCE(ROUND(AVG(detail.nilai)::numeric, 2)::float, 0) as rata_rata
            FROM dosen d
            JOIN evaluasi_dosen ed ON d.id = ed.dosen_id
            JOIN evaluasi_detail detail ON ed.id = detail.evaluasi_dosen_id
            GROUP BY d.id, d.nama
            ORDER BY rata_rata DESC
            LIMIT 5
        `;

        // Overall Score
        const overallFasilitasScoreResult = await prisma.$queryRaw`
            SELECT 
                COALESCE(ROUND(AVG(detail.nilai)::numeric, 2)::float, 0) as rata_rata
            FROM evaluasi_fasilitas ef
            JOIN evaluasi_detail detail ON ef.id = detail.evaluasi_fasilitas_id
        `;

        // Perbaikan Fasilitas
        const fasilitasPerluPerbaikanResult = await prisma.$queryRaw`
            SELECT 
                f.id, f.nama, f.kategori,
                COUNT(DISTINCT ef.id)::int as jumlah_evaluasi,
                COALESCE(ROUND(AVG(detail.nilai)::numeric, 2)::float, 0) as rata_rata
            FROM fasilitas f
            JOIN evaluasi_fasilitas ef ON f.id = ef.fasilitas_id
            JOIN evaluasi_detail detail ON ef.id = detail.evaluasi_fasilitas_id
            GROUP BY f.id, f.nama, f.kategori
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
                totalEvaluasi: totalDosen + totalFasilitas,
                evaluasiDosen: totalDosen,
                evaluasiFasilitas: totalFasilitas,
                partisipasi: {
                    uniqueMahasiswa: uniqueMahasiswaCount,
                    totalMahasiswa,
                    persentase: parseFloat(String(partisipasiPersen)),
                    periodeId: activePeriode?.id || null,
                    periodeNama: activePeriode?.nama || null
                },
                topDosen: topDosenResult,
                fasilitasPerluPerbaikan: fasilitasPerluPerbaikanResult,
                overallFasilitasScore: overallFasilitasScoreResult[0]?.rata_rata || 0
            }
        }));
    } catch (error) {
        console.error('Dashboard Error:', error);
        res.status(500).json({
            success: false,
            message: 'Terjadi kesalahan pada server dashboard',
            error: error.message
        });
    }
});

// Daily trend data
router.get('/daily-trend', async (req, res) => {
    try {
        const { days = 7 } = req.query;
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

        const labels = [];
        const totalSeries = [];
        const dosenSeries = [];
        const fasilitasSeries = [];

        // Fill missing dates
        for (let i = daysCount; i >= 0; i--) {
            const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
            const dStr = d.toISOString().split('T')[0];
            const found = dailyData.find(item => {
                const itemDate = new Date(item.tanggal).toISOString().split('T')[0];
                return itemDate === dStr;
            });

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
    } catch (error) {
        console.error('Daily Trend Error:', error);
        res.status(500).json({ success: false, message: 'Gagal memuat tren harian', error: error.message });
    }
});

// Simplified Laporan (re-implementing properly)
router.get('/laporan', async (req, res) => {
    try {
        const { periode_id } = req.query;
        const validPeriodeId = periode_id ? parseInt(periode_id) : null;

        const [dosenList, fasilitasList] = await Promise.all([
            prisma.dosen.findMany({
                include: {
                    evaluasi_dosen: {
                        where: validPeriodeId ? { periode_id: validPeriodeId } : undefined,
                        include: { evaluasi_detail: true }
                    }
                }
            }),
            prisma.fasilitas.findMany({
                include: {
                    evaluasi_fasilitas: {
                        where: validPeriodeId ? { periode_id: validPeriodeId } : undefined,
                        include: { evaluasi_detail: true }
                    }
                }
            })
        ]);

        const laporanDosen = dosenList.map(d => {
            const allNilai = d.evaluasi_dosen.flatMap(ev => ev.evaluasi_detail.map(det => det.nilai));
            const avg = allNilai.length > 0 ? (allNilai.reduce((a, b) => a + b, 0) / allNilai.length).toFixed(2) : 0;
            return {
                id: d.id,
                nama: d.nama,
                nip: d.nip,
                jumlah_evaluasi: d.evaluasi_dosen.length,
                rata_rata: parseFloat(avg)
            };
        });

        const laporanFasilitas = fasilitasList.map(f => {
            const allNilai = f.evaluasi_fasilitas.flatMap(ev => ev.evaluasi_detail.map(det => det.nilai));
            const avg = allNilai.length > 0 ? (allNilai.reduce((a, b) => a + b, 0) / allNilai.length).toFixed(2) : 0;
            return {
                id: f.id,
                nama: f.nama,
                kode: f.kode,
                jumlah_evaluasi: f.evaluasi_fasilitas.length,
                rata_rata: parseFloat(avg)
            };
        });

        res.json(serialize({
            success: true,
            data: { dosen: laporanDosen, fasilitas: laporanFasilitas }
        }));
    } catch (error) {
        console.error('Laporan Error:', error);
        res.status(500).json({ success: false, message: 'Gagal memuat laporan', error: error.message });
    }
});

export default router;
