import express from 'express';
const router = express.Router();
import { prisma } from '../config/database.js';
import { authMiddleware, adminMiddleware } from '../middleware/authMiddleware.js';

// Get active periode
router.get('/active', authMiddleware, async (req, res) => {
  try {
    const periode = await prisma.periode_evaluasi.findFirst({
      where: { status: 'aktif' }
    });

    if (!periode) {
      return res.status(404).json({
        success: false,
        message: 'Tidak ada periode evaluasi aktif'
      });
    }

    res.json({
      success: true,
      data: periode
    });
  } catch (error) {
    console.error('Get active periode error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan pada server'
    });
  }
});

// Get all periode (Admin only)
router.get('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const data = await prisma.periode_evaluasi.findMany({
      orderBy: {
        tanggal_mulai: 'desc'
      }
    });

    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Get periode error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan pada server'
    });
  }
});

// Create periode (Admin only)
router.post('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { nama, tahun_ajaran, semester, tanggal_mulai, tanggal_akhir, batas_evaluasi, keterangan } = req.body;

    const periode = await prisma.periode_evaluasi.create({
      data: {
        nama,
        tahun_ajaran,
        semester,
        tanggal_mulai: new Date(tanggal_mulai),
        tanggal_akhir: new Date(tanggal_akhir),
        batas_evaluasi: batas_evaluasi ? new Date(batas_evaluasi) : null,
        keterangan: keterangan || null
      }
    });

    res.status(201).json({
      success: true,
      message: 'Periode berhasil dibuat',
      data: periode
    });
  } catch (error) {
    console.error('Create periode error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan pada server'
    });
  }
});

// Update periode (Admin only)
router.put('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { nama, tahun_ajaran, semester, tanggal_mulai, tanggal_akhir, batas_evaluasi, keterangan, status } = req.body;

    const periode = await prisma.periode_evaluasi.update({
      where: { id: parseInt(id) },
      data: {
        ...(nama && { nama }),
        ...(tahun_ajaran && { tahun_ajaran }),
        ...(semester && { semester }),
        ...(tanggal_mulai && { tanggal_mulai: new Date(tanggal_mulai) }),
        ...(tanggal_akhir && { tanggal_akhir: new Date(tanggal_akhir) }),
        ...(batas_evaluasi && { batas_evaluasi: new Date(batas_evaluasi) }),
        ...(keterangan && { keterangan }),
        ...(status && { status })
      }
    });

    res.json({
      success: true,
      message: 'Periode berhasil diupdate',
      data: periode
    });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Periode tidak ditemukan'
      });
    }
    console.error('Update periode error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan pada server'
    });
  }
});

// Activate periode (Admin only)
router.put('/:id/activate', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // Use Prisma transaction
    const result = await prisma.$transaction(async (tx) => {
      // Deactivate all other periods first
      await tx.periode_evaluasi.updateMany({
        data: { status: 'tidak_aktif' }
      });

      // Activate selected period
      const updated = await tx.periode_evaluasi.update({
        where: { id: parseInt(id) },
        data: { status: 'aktif' }
      });

      return updated;
    });

    res.json({
      success: true,
      message: 'Periode berhasil diaktifkan',
      data: result
    });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Periode tidak ditemukan'
      });
    }
    console.error('Activate periode error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan pada server'
    });
  }
});

// Delete periode (Admin only)
router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if it's active
    const periode = await prisma.periode_evaluasi.findUnique({
      where: { id: parseInt(id) }
    });

    if (!periode) {
      return res.status(404).json({
        success: false,
        message: 'Periode tidak ditemukan'
      });
    }

    if (periode.status === 'aktif') {
      return res.status(400).json({
        success: false,
        message: 'Tidak dapat menghapus periode yang sedang aktif'
      });
    }

    await prisma.periode_evaluasi.delete({
      where: { id: parseInt(id) }
    });

    res.json({
      success: true,
      message: 'Periode berhasil dihapus'
    });
  } catch (error) {
    console.error('Delete periode error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan pada server'
    });
  }
});

export default router;
