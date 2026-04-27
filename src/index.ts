import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import cors from 'cors';
import os from 'os';
import { checkEnvVars } from './config/env.js';
import { testConnection, isDatabaseConnected } from './config/database.js';
import { helmetMiddleware, limiter, authLimiter, registrationLimiter } from './middleware/securityMiddleware.js';

// 🔐 Validate environment variables first
checkEnvVars();

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = String(process.env.HOST || '0.0.0.0');

// Test database connection
testConnection();

// 🔐 Security Middleware - Apply first
app.use(helmetMiddleware);

// Body parser with size limits
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// CORS - Restrict to known origins
app.use(cors({
  origin: function (origin, callback) {
    const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3002').split(',');
    if (!origin || allowedOrigins.some(o => o.trim() === (origin || ''))) {
      callback(null, true);
    } else {
      callback(new Error('CORS policy: Origin not allowed'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// General rate limiter
app.use(limiter);

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Evaluasi MI API Server',
    version: '1.0.0',
    status: 'running',
    database: isDatabaseConnected() ? 'connected' : 'disconnected'
  });
});

// API Routes
import authRoutes from './routes/authRoutes.js';
import dosenRoutes from './routes/dosenRoutes.js';
import fasilitasRoutes from './routes/fasilitasRoutes.js';
import periodeRoutes from './routes/periodeRoutes.js';
import evaluasiRoutes from './routes/evaluasiRoutes.js';
import adminRoutes from './routes/adminRoutes.js';

// Auth routes with stricter rate limiting
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', registrationLimiter);
app.use('/api/auth', authRoutes);

// Other API routes
app.use('/api/dosen', dosenRoutes);
app.use('/api/fasilitas', fasilitasRoutes);
app.use('/api/periode', periodeRoutes);
app.use('/api/evaluasi', evaluasiRoutes);
app.use('/api/admin', adminRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Start server only if not running in Vercel Serverless
if (!process.env.VERCEL) {
  app.listen(PORT, HOST, () => {
    const lanIp = Object.values(os.networkInterfaces())
      .flat()
      .find((iface) => iface && iface.family === 'IPv4' && !iface.internal)?.address;

    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📍 Environment: ${process.env.NODE_ENV}`);
    console.log(`🔗 API URL (local): http://localhost:${PORT}`);
    if (lanIp) {
      console.log(`🔗 API URL (LAN): http://${lanIp}:${PORT}`);
    }
  });
}

export default app;
