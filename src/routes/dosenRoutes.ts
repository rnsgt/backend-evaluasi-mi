import express from 'express';
const router = express.Router();
// Last sync: 2026-05-13 03:06
import { prisma } from '../config/database.js';
import { authMiddleware, adminMiddleware } from '../middleware/authMiddleware.js';

const normalizeMataKuliahInput = (mataKuliah) => {
  if (!Array.isArray(mataKuliah)) {
    return [];
  }

  return mataKuliah
    .filter(item => item !== null && item !== undefined)
    .map((item) => {
      if (typeof item === 'object') {
        return String(item.nama || item.kode || '').trim();
      }
      return String(item).trim();
    })
    .filter(Boolean);
};

const buildDosenPayload = (dosen) => ({
  id: dosen.id,
  nip: dosen.nip,
  nama: dosen.nama,
  email: dosen.email,
  status: 'aktif',
  bio: '',
  mata_kuliah: (dosen.mata_kuliah || []).map((mk) => ({
    id: mk.id,
    kode: mk.kode,
    nama: mk.nama,
  })),
  created_at: dosen.created_at,
  updated_at: dosen.updated_at,
});

// Get all dosen with mata kuliah
router.get('/', authMiddleware, async (req, res) => {
  try {
    const data = await prisma.dosen.findMany({
      include: {
        mata_kuliah: {
          select: {
            id: true,
            kode: true,
            nama: true,
          }
        }
      },
      orderBy: {
        nama: 'asc'
      }
    });

    res.json({
      success: true,
      data: data.map(buildDosenPayload)
    });
  } catch (error) {
    console.error('Get dosen error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan pada server'
    });
  }
});

// Get dosen by ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const dosen = await prisma.dosen.findUnique({
      where: { id: parseInt(id as any) },
      include: {
        mata_kuliah: {
          select: {
            id: true,
            kode: true,
            nama: true,
          }
        }
      }
    });

    if (!dosen) {
      return res.status(404).json({
        success: false,
        message: 'Dosen tidak ditemukan'
      });
    }

    res.json({
      success: true,
      data: buildDosenPayload(dosen)
    });
  } catch (error) {
    console.error('Get dosen by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan pada server'
    });
  }
});

// Create dosen (Admin only)
router.post('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { nip, nama, mata_kuliah } = req.body;

    if (!nip || !nama) {
      return res.status(400).json({
        success: false,
        message: 'NIP dan nama wajib diisi'
      });
    }

    const existing = await prisma.dosen.findFirst({
      where: {
        nip: String(nip).trim()
      }
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'NIP dosen sudah digunakan'
      });
    }

    const mataKuliahList = normalizeMataKuliahInput(mata_kuliah);

    const created = await prisma.$transaction(async (tx) => {
      const dosen = await tx.dosen.create({
        data: {
          nip: String(nip).trim(),
          nama: String(nama).trim(),
        }
      });

      if (mataKuliahList.length > 0) {
        for (const [index, mk] of mataKuliahList.entries()) {
          await tx.mata_kuliah.create({
            data: {
              kode: `MK${dosen.id}${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
              nama: mk,
              dosen_id: dosen.id,
            }
          });
        }
      }

      return tx.dosen.findUnique({
        where: { id: dosen.id },
        include: {
          mata_kuliah: {
            select: {
              id: true,
              kode: true,
              nama: true
            }
          }
        }
      });
    });

    return res.status(201).json({
      success: true,
      message: 'Dosen berhasil ditambahkan',
      data: buildDosenPayload(created)
    });
  } catch (error) {
    console.error('Create dosen error:', error);
    if (error.code === 'P2002') {
      return res.status(409).json({
        success: false,
        message: 'NIP atau email dosen sudah digunakan'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan pada server'
    });
  }
});

// Update dosen (Admin only)
router.put('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const dosenId = parseInt(id as any, 10);
    const { nip, nama, email, mata_kuliah } = req.body;

    const existing = await prisma.dosen.findUnique({
      where: { id: dosenId }
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Dosen tidak ditemukan'
      });
    }

    const mataKuliahList = normalizeMataKuliahInput(mata_kuliah);

    const updated = await prisma.$transaction(async (tx) => {
      console.log('UPDATING DOSEN:', dosenId);
      await tx.dosen.update({
        where: { id: dosenId },
        data: {
          ...(nip && { nip: String(nip).trim() }),
          ...(nama && { nama: String(nama).trim() }),
          ...(email && { email: String(email).trim() }),
        }
      });

      console.log('UPDATING MK LIST:', mataKuliahList);
      // Optional: If we want to preserve evaluations, we should only delete MKs that are not used.
      // But for now, we follow the current logic but with better error handling.
      try {
        await tx.mata_kuliah.deleteMany({
          where: { dosen_id: dosenId }
        });

        if (mataKuliahList.length > 0) {
          for (const [index, mk] of mataKuliahList.entries()) {
            await tx.mata_kuliah.create({
              data: {
                kode: `MK${dosenId}${Math.random().toString(36).substring(2, 7).toUpperCase()}`, // Even shorter unique code
                nama: mk,
                dosen_id: dosenId,
              }
            });
          }
        }
      } catch (mkError) {
        console.error('Mata Kuliah update error inside transaction:', mkError);
        throw mkError;
      }

      return tx.dosen.findUnique({
        where: { id: dosenId },
        include: {
          mata_kuliah: {
            select: { id: true, kode: true, nama: true }
          }
        }
      });
    });

    res.json({
      success: true,
      message: 'Dosen berhasil diperbarui',
      data: buildDosenPayload(updated)
    });
  } catch (error) {
    console.error('Update dosen error:', error);
    if (error.code === 'P2002') {
      return res.status(409).json({
        success: false,
        message: 'NIP, email, atau kode mata kuliah sudah digunakan'
      });
    }
    res.status(500).json({
      success: false,
      message: `Terjadi kesalahan pada server: ${error.message || 'Internal Server Error'}`
    });
  }
});

// Delete dosen (Admin only)
router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const dosen = await prisma.dosen.delete({
      where: { id: parseInt(id as any) }
    });

    res.json({
      success: true,
      message: `Dosen "${dosen.nama}" berhasil dihapus`,
      data: dosen
    });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Dosen tidak ditemukan'
      });
    }
    console.error('Delete dosen error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan pada server'
    });
  }
});

export default router;
