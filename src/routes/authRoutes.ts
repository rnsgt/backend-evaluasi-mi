import express from 'express';
const router = express.Router();
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import { prisma } from '../config/database.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

// Register - Mahasiswa
router.post('/register', [
  body('nim').notEmpty().withMessage('NIM harus diisi'),
  body('nama').notEmpty().withMessage('Nama harus diisi'),
  body('email').isEmail().withMessage('Email tidak valid'),
  body('password').isLength({ min: 6 }).withMessage('Password minimal 6 karakter'),
  body('prodi').notEmpty().withMessage('Program studi harus diisi'),
  body('angkatan').notEmpty().withMessage('Angkatan harus diisi'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: errors.array()[0].msg
      });
    }

    const { nim, nama, email, password, prodi, angkatan } = req.body;

    // Check if user already exists
    const existingUser = await prisma.users.findFirst({
      where: {
        OR: [{ email }, { nim }]
      }
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email atau NIM sudah terdaftar'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.users.create({
      data: {
        nim,
        nama,
        email,
        password: hashedPassword,
        prodi,
        angkatan,
        role: 'mahasiswa'
      },
      select: {
        id: true,
        nim: true,
        nama: true,
        email: true,
        prodi: true,
        angkatan: true,
        role: true
      }
    });

    // Generate token
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as any }
    );

    res.status(201).json({
      success: true,
      message: 'Registrasi berhasil',
      data: {
        user,
        token
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan pada server'
    });
  }
});

// Login
router.post('/login', [
  body('identifier')
    .optional()
    .isString()
    .withMessage('Identifier tidak valid'),
  body('nim')
    .optional()
    .isString()
    .withMessage('NIM tidak valid'),
  body('email')
    .optional()
    .isString()
    .withMessage('Email tidak valid'),
  body('password').notEmpty().withMessage('Password harus diisi'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: errors.array()[0].msg
      });
    }

    const { password } = req.body;
    const rawIdentifier = req.body.identifier ?? req.body.nim ?? req.body.email;
    const normalizedIdentifier = String(rawIdentifier || '').trim();

    if (!normalizedIdentifier) {
      return res.status(400).json({
        success: false,
        message: 'NIM/Email harus diisi'
      });
    }

    const isEmail = normalizedIdentifier.includes('@');

    // Find user by NIM or Email
    const user = await prisma.users.findFirst({
      where: isEmail
        ? {
            email: {
              equals: normalizedIdentifier.toLowerCase(),
              mode: 'insensitive'
            }
          }
        : {
            nim: normalizedIdentifier
          }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'NIM/Email atau password salah'
      });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'NIM/Email atau password salah'
      });
    }

    // Generate token
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as any }
    );

    // Remove password from response
    delete user.password;

    res.json({
      success: true,
      message: 'Login berhasil',
      data: {
        user,
        token
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan pada server'
    });
  }
});

// Get Profile
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const user = await prisma.users.findUnique({
      where: { id: req.user?.id },
      select: {
        id: true,
        nim: true,
        nama: true,
        email: true,
        prodi: true,
        angkatan: true,
        role: true,
        created_at: true
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User tidak ditemukan'
      });
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan pada server'
    });
  }
});

// Change Password
router.put('/change-password', [
  authMiddleware,
  body('oldPassword').notEmpty().withMessage('Password lama harus diisi'),
  body('newPassword').isLength({ min: 6 }).withMessage('Password baru minimal 6 karakter'),
  body('newPasswordConfirmation').notEmpty().withMessage('Konfirmasi password harus diisi'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: errors.array()[0].msg
      });
    }

    const { oldPassword, newPassword, newPasswordConfirmation } = req.body;

    // Validate passwords match
    if (newPassword !== newPasswordConfirmation) {
      return res.status(400).json({
        success: false,
        message: 'Konfirmasi password tidak sesuai'
      });
    }

    // Get current user
    const user = await prisma.users.findUnique({
      where: { id: req.user?.id }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User tidak ditemukan'
      });
    }

    // Verify old password
    const isPasswordValid = await bcrypt.compare(oldPassword, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Password lama tidak sesuai'
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await prisma.users.update({
      where: { id: req.user?.id },
      data: {
        password: hashedPassword
      }
    });

    res.json({
      success: true,
      message: 'Password berhasil diubah'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan pada server'
    });
  }
});

// Forgot Password - Check User
router.post('/forgot-password', [
  body('identifier').notEmpty().withMessage('NIM atau Email harus diisi'),
], async (req, res) => {
  try {
    const rawIdentifier = req.body.identifier;
    const identifier = String(rawIdentifier || '').trim();

    const user = await prisma.users.findFirst({
      where: {
        OR: [
          { email: { equals: identifier.toLowerCase(), mode: 'insensitive' } },
          { nim: { equals: identifier, mode: 'insensitive' } }
        ]
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Pengguna dengan NIM/Email tersebut tidak ditemukan'
      });
    }

    res.json({
      success: true,
      message: 'Pengguna ditemukan',
      data: {
        nama: user.nama,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan pada server'
    });
  }
});

// Reset Password
router.post('/reset-password', [
  body('identifier').notEmpty().withMessage('NIM atau Email harus diisi'),
  body('newPassword').isLength({ min: 6 }).withMessage('Password baru minimal 6 karakter'),
], async (req, res) => {
  try {
    const { newPassword } = req.body;
    const identifier = String(req.body.identifier || '').trim();
    const user = await prisma.users.findFirst({
      where: {
        OR: [
          { email: { equals: identifier.toLowerCase(), mode: 'insensitive' } },
          { nim: { equals: identifier, mode: 'insensitive' } }
        ]
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Gagal mereset password. Pengguna tidak ditemukan.'
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.users.update({
      where: { id: user.id },
      data: { password: hashedPassword }
    });

    res.json({
      success: true,
      message: 'Password berhasil diperbarui. Silakan login kembali.'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan pada server'
    });
  }
});

export default router;
