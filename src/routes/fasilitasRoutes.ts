import express from 'express';
const router = express.Router();
import { prisma } from '../config/database.js';
import { authMiddleware, adminMiddleware } from '../middleware/authMiddleware.js';

// Get all fasilitas
router.get('/', authMiddleware, async (req, res) => {
  try {
    const data = await prisma.fasilitas.findMany({
      orderBy: [
        { kategori: 'asc' },
        { nama: 'asc' }
      ]
    });

    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Get fasilitas error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan pada server'
    });
  }
});

// Create fasilitas (Admin only)
router.post('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { kode, nama, kategori, lokasi, kapasitas } = req.body;

    if (!kode || !nama || !kategori) {
      return res.status(400).json({
        success: false,
        message: 'Kode, nama, dan kategori wajib diisi'
      });
    }

    const fasilitas = await prisma.fasilitas.create({
      data: {
        kode: String(kode).toUpperCase().trim(),
        nama: String(nama).trim(),
        kategori: String(kategori).trim(),
        lokasi: lokasi ? String(lokasi).trim() : null,
        kapasitas: kapasitas ? parseInt(kapasitas, 10) : null
      }
    });

    res.status(201).json({
      success: true,
      message: 'Fasilitas berhasil ditambahkan',
      data: fasilitas
    });
  } catch (error) {
    console.error('Create fasilitas error:', error);

    if (error.code === 'P2002') {
      return res.status(409).json({
        success: false,
        message: 'Kode fasilitas sudah digunakan'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan pada server'
    });
  }
});

// Get fasilitas by ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const fasilitas = await prisma.fasilitas.findUnique({
      where: { id: parseInt(id) }
    });

    if (!fasilitas) {
      return res.status(404).json({
        success: false,
        message: 'Fasilitas tidak ditemukan'
      });
    }

    res.json({
      success: true,
      data: fasilitas
    });
  } catch (error) {
    console.error('Get fasilitas by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan pada server'
    });
  }
});

// Update fasilitas (Admin only)
router.put('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { kode, nama, kategori, lokasi, kapasitas } = req.body;

    const fasilitas = await prisma.fasilitas.update({
      where: { id: parseInt(id) },
      data: {
        ...(kode && { kode: String(kode).toUpperCase().trim() }),
        ...(nama && { nama: String(nama).trim() }),
        ...(kategori && { kategori: String(kategori).trim() }),
        ...(lokasi && { lokasi: String(lokasi).trim() }),
        ...(kapasitas && { kapasitas: parseInt(kapasitas, 10) })
      }
    });

    res.json({
      success: true,
      message: 'Fasilitas berhasil diperbarui',
      data: fasilitas
    });
  } catch (error) {
    console.error('Update fasilitas error:', error);

    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Fasilitas tidak ditemukan'
      });
    }

    if (error.code === 'P2002') {
      return res.status(409).json({
        success: false,
        message: 'Kode fasilitas sudah digunakan'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan pada server'
    });
  }
});

// Delete fasilitas (Admin only)
router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const fasilitas = await prisma.fasilitas.delete({
      where: { id: parseInt(id) }
    });

    res.json({
      success: true,
      message: `Fasilitas "${fasilitas.nama}" berhasil dihapus`,
      data: fasilitas
    });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Fasilitas tidak ditemukan'
      });
    }
    console.error('Delete fasilitas error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan pada server'
    });
  }
});

export default router;
