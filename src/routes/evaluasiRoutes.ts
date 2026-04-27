import express from 'express';
const router = express.Router();
import { prisma } from '../config/database.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const toInt = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const validateJawaban = (jawaban) => {
  if (!Array.isArray(jawaban) || jawaban.length === 0) {
    return 'Jawaban wajib diisi';
  }

  for (const item of jawaban) {
    if (!item || item.pernyataan_id === undefined || item.nilai === undefined) {
      return 'Setiap jawaban harus memiliki pernyataan_id dan nilai';
    }

    const pernyataanId = toInt(item.pernyataan_id);
    const nilai = toInt(item.nilai);

    if (pernyataanId === null || nilai === null) {
      return 'pernyataan_id dan nilai harus berupa angka';
    }

    if (nilai < 1 || nilai > 5) {
      return 'Nilai harus antara 1 sampai 5';
    }
  }

  return null;
};

// Get pernyataan dosen
router.get('/pernyataan/dosen', authMiddleware, async (req, res) => {
  try {
    const data = await prisma.pernyataan_dosen.findMany({
      orderBy: { urutan: 'asc' }
    });

    res.json({ success: true, data });
  } catch (error) {
    console.error('Get pernyataan dosen error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan pada server'
    });
  }
});

// Get pernyataan fasilitas
router.get('/pernyataan/fasilitas', authMiddleware, async (req, res) => {
  try {
    const data = await prisma.pernyataan_fasilitas.findMany({
      orderBy: { urutan: 'asc' }
    });

    res.json({ success: true, data });
  } catch (error) {
    console.error('Get pernyataan fasilitas error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan pada server'
    });
  }
});

// Submit evaluasi dosen
router.post('/dosen', authMiddleware, async (req, res) => {
  try {
    const user_id = req.user?.id;
    const dosen_id = toInt(req.body.dosen_id);
    const mata_kuliah_id = toInt(req.body.mata_kuliah_id);
    const mata_kuliah_nama = req.body.mata_kuliah_nama ? String(req.body.mata_kuliah_nama).trim() : '';
    const periode_id = toInt(req.body.periode_id);
    const komentar = req.body.komentar ? String(req.body.komentar).trim() : null;
    const jawaban = req.body.jawaban;

    if (!dosen_id || !periode_id || (!mata_kuliah_id && !mata_kuliah_nama)) {
      return res.status(400).json({
        success: false,
        message: 'dosen_id, mata_kuliah, dan periode_id wajib diisi'
      });
    }

    const jawabanError = validateJawaban(jawaban);
    if (jawabanError) {
      return res.status(400).json({ success: false, message: jawabanError });
    }

    const [dosen, periode] = await Promise.all([
      prisma.dosen.findUnique({ where: { id: dosen_id }, select: { id: true } }),
      prisma.periode_evaluasi.findUnique({ where: { id: periode_id }, select: { id: true, nama: true, status: true } })
    ]);

    if (!dosen) {
      return res.status(404).json({ success: false, message: `Dosen dengan ID ${dosen_id} tidak ditemukan` });
    }

    if (!periode) {
      return res.status(404).json({ success: false, message: `Periode dengan ID ${periode_id} tidak ditemukan` });
    }

    if (periode.status !== 'aktif') {
      return res.status(400).json({ success: false, message: `Periode ${periode.nama} tidak dalam status aktif` });
    }

    const pernyataanIds = jawaban.map((item) => toInt(item.pernyataan_id));
    const pernyataanCount = await prisma.pernyataan_dosen.count({
      where: { id: { in: pernyataanIds } }
    });

    if (pernyataanCount !== pernyataanIds.length) {
      return res.status(404).json({ success: false, message: 'Beberapa pernyataan dosen tidak ditemukan' });
    }

    const result = await prisma.$transaction(async (tx) => {
      let resolvedMataKuliah = null;

      if (mata_kuliah_id) {
        resolvedMataKuliah = await tx.mata_kuliah.findUnique({
          where: { id: mata_kuliah_id },
          select: { id: true, dosen_id: true, nama: true }
        });
      }

      if (!resolvedMataKuliah && mata_kuliah_nama) {
        resolvedMataKuliah = await tx.mata_kuliah.findFirst({
          where: {
            dosen_id,
            nama: {
              equals: mata_kuliah_nama,
              mode: 'insensitive'
            }
          },
          select: { id: true, dosen_id: true, nama: true }
        });
      }

      if (!resolvedMataKuliah && mata_kuliah_nama) {
        resolvedMataKuliah = await tx.mata_kuliah.create({
          data: {
            kode: `MK-${dosen_id}-${Date.now()}`,
            nama: mata_kuliah_nama,
            sks: 3,
            semester: null,
            dosen_id,
          },
          select: { id: true, dosen_id: true, nama: true }
        });
      }

      if (!resolvedMataKuliah) {
        return {
          error: 'MATA_KULIAH_TIDAK_VALID'
        };
      }

      const existing = await tx.evaluasi_dosen.findUnique({
        where: {
          user_id_dosen_id_mata_kuliah_id_periode_id: {
            user_id,
            dosen_id,
            mata_kuliah_id: resolvedMataKuliah.id,
            periode_id
          }
        }
      });

      if (existing) {
        throw new Error('DUPLICATE_DOSEN_EVALUATION');
      }

      const evaluasi = await tx.evaluasi_dosen.create({
        data: {
          user_id,
          dosen_id,
          mata_kuliah_id: resolvedMataKuliah.id,
          periode_id,
          komentar,
          status: 'submitted'
        }
      });

      await tx.evaluasi_detail.createMany({
        data: jawaban.map((item) => ({
          evaluasi_dosen_id: evaluasi.id,
          pernyataan_dosen_id: toInt(item.pernyataan_id),
          nilai: toInt(item.nilai)
        }))
      });

      return evaluasi;
    });

    if (result && 'error' in result && result.error === 'MATA_KULIAH_TIDAK_VALID') {
      return res.status(404).json({
        success: false,
        message: mata_kuliah_id
          ? `Mata kuliah dengan ID ${mata_kuliah_id} tidak ditemukan`
          : 'Mata kuliah tidak valid'
      });
    }

    res.status(201).json({
      success: true,
      message: 'Evaluasi dosen berhasil disimpan',
      data: { evaluasi_id: (result as any).id }
    });
  } catch (error) {
    console.error('Submit evaluasi dosen error:', error);

    if (error.message === 'DUPLICATE_DOSEN_EVALUATION') {
      return res.status(400).json({
        success: false,
        message: 'Anda sudah mengevaluasi dosen ini untuk mata kuliah yang sama'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan pada server'
    });
  }
});

// Submit evaluasi fasilitas
router.post('/fasilitas', authMiddleware, async (req, res) => {
  try {
    const user_id = req.user?.id;
    const fasilitas_id = toInt(req.body.fasilitas_id);
    const periode_id = toInt(req.body.periode_id);
    const komentar = req.body.komentar ? String(req.body.komentar).trim() : null;
    const jawaban = req.body.jawaban;

    if (!fasilitas_id || !periode_id) {
      return res.status(400).json({
        success: false,
        message: 'fasilitas_id dan periode_id wajib diisi'
      });
    }

    const jawabanError = validateJawaban(jawaban);
    if (jawabanError) {
      return res.status(400).json({ success: false, message: jawabanError });
    }

    const [fasilitas, periode] = await Promise.all([
      prisma.fasilitas.findUnique({ where: { id: fasilitas_id }, select: { id: true } }),
      prisma.periode_evaluasi.findUnique({ where: { id: periode_id }, select: { id: true, nama: true, status: true } })
    ]);

    if (!fasilitas) {
      return res.status(404).json({ success: false, message: `Fasilitas dengan ID ${fasilitas_id} tidak ditemukan` });
    }

    if (!periode) {
      return res.status(404).json({ success: false, message: `Periode dengan ID ${periode_id} tidak ditemukan` });
    }

    if (periode.status !== 'aktif') {
      return res.status(400).json({ success: false, message: `Periode ${periode.nama} tidak dalam status aktif` });
    }

    const pernyataanIds = jawaban.map((item) => toInt(item.pernyataan_id));
    const pernyataanCount = await prisma.pernyataan_fasilitas.count({
      where: { id: { in: pernyataanIds } }
    });

    if (pernyataanCount !== pernyataanIds.length) {
      return res.status(404).json({ success: false, message: 'Beberapa pernyataan fasilitas tidak ditemukan' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.evaluasi_fasilitas.findUnique({
        where: {
          user_id_fasilitas_id_periode_id: {
            user_id,
            fasilitas_id,
            periode_id
          }
        }
      });

      if (existing) {
        throw new Error('DUPLICATE_FASILITAS_EVALUATION');
      }

      const evaluasi = await tx.evaluasi_fasilitas.create({
        data: {
          user_id,
          fasilitas_id,
          periode_id,
          komentar,
          status: 'submitted'
        }
      });

      await tx.evaluasi_detail.createMany({
        data: jawaban.map((item) => ({
          evaluasi_fasilitas_id: evaluasi.id,
          pernyataan_fasilitas_id: toInt(item.pernyataan_id),
          nilai: toInt(item.nilai)
        }))
      });

      return evaluasi;
    });

    res.status(201).json({
      success: true,
      message: 'Evaluasi fasilitas berhasil disimpan',
      data: { evaluasi_id: result.id }
    });
  } catch (error) {
    console.error('Submit evaluasi fasilitas error:', error);

    if (error.message === 'DUPLICATE_FASILITAS_EVALUATION') {
      return res.status(400).json({
        success: false,
        message: 'Anda sudah mengevaluasi fasilitas ini'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan pada server'
    });
  }
});

// Get riwayat evaluasi mahasiswa
router.get('/riwayat', authMiddleware, async (req, res) => {
  try {
    const user_id = req.user?.id;

    const [dosenEvaluations, fasilitasEvaluations] = await Promise.all([
      prisma.evaluasi_dosen.findMany({
        where: { user_id },
        include: {
          dosen: { select: { nama: true, nip: true } },
          mata_kuliah: { select: { nama: true, kode: true } },
          periode_evaluasi: { select: { nama: true } },
          evaluasi_detail: true
        },
        orderBy: { submitted_at: 'desc' }
      }),
      prisma.evaluasi_fasilitas.findMany({
        where: { user_id },
        include: {
          fasilitas: { select: { nama: true, kode: true, kategori: true, lokasi: true } },
          periode_evaluasi: { select: { nama: true } },
          evaluasi_detail: true
        },
        orderBy: { submitted_at: 'desc' }
      })
    ]);

    const dosenData = dosenEvaluations.map((ed) => ({
      id: ed.id,
      submitted_at: ed.submitted_at,
      komentar: ed.komentar,
      status: ed.status,
      jumlah_jawaban: ed.evaluasi_detail.length,
      dosen_nama: ed.dosen.nama,
      dosen_nip: ed.dosen.nip,
      mata_kuliah_nama: ed.mata_kuliah.nama,
      mata_kuliah_kode: ed.mata_kuliah.kode,
      periode_nama: ed.periode_evaluasi.nama,
      type: 'DOSEN'
    }));

    const fasilitasData = fasilitasEvaluations.map((ef) => ({
      id: ef.id,
      submitted_at: ef.submitted_at,
      komentar: ef.komentar,
      status: ef.status,
      jumlah_jawaban: ef.evaluasi_detail.length,
      fasilitas_nama: ef.fasilitas.nama,
      fasilitas_kode: ef.fasilitas.kode,
      fasilitas_kategori: ef.fasilitas.kategori,
      fasilitas_lokasi: ef.fasilitas.lokasi,
      periode_nama: ef.periode_evaluasi.nama,
      type: 'FASILITAS'
    }));

    const allEvaluasi = [...dosenData, ...fasilitasData].sort(
      (a: any, b: any) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()
    );

    res.json({ success: true, data: allEvaluasi });
  } catch (error) {
    console.error('Get riwayat error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan pada server'
    });
  }
});

// Get statistik mahasiswa
router.get('/statistik', authMiddleware, async (req, res) => {
  try {
    const user_id = req.user?.id;

    const [dosenCount, fasilitasCount, activePeriode] = await Promise.all([
      prisma.evaluasi_dosen.count({ where: { user_id } }),
      prisma.evaluasi_fasilitas.count({ where: { user_id } }),
      prisma.periode_evaluasi.findFirst({ where: { status: 'aktif' }, select: { nama: true } })
    ]);

    const totalDosen = dosenCount;
    const totalFasilitas = fasilitasCount;
    const totalEvaluasi = totalDosen + totalFasilitas;

    let achievement = null;
    if (totalEvaluasi >= 10) {
      achievement = { text: 'Super Aktif! 🌟', icon: 'trophy', color: '#FFD700' };
    } else if (totalEvaluasi >= 5) {
      achievement = { text: 'Partisipasi Baik 👍', icon: 'medal', color: '#4CAF50' };
    } else if (totalEvaluasi > 0) {
      achievement = { text: 'Terus Tingkatkan! 💪', icon: 'star', color: '#2196F3' };
    }

    res.json({
      success: true,
      data: {
        totalEvaluasi,
        totalDosen,
        totalFasilitas,
        periodeAktif: activePeriode?.nama || 'Tidak ada periode aktif',
        achievement
      }
    });
  } catch (error) {
    console.error('Get statistik error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan pada server'
    });
  }
});

export default router;
