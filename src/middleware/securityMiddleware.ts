import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';

// Security Headers with Helmet
const helmetMiddleware = (helmet as any)({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
  hsts: { maxAge: 31536000 }, // 1 year HSTS
  frameguard: { action: 'deny' },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
});

// General Rate Limiter
const limiter = (rateLimit as any)({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Max 100 requests per windowMs
  message: {
    success: false,
    message: 'Terlalu banyak permintaan, silakan coba lagi nanti',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health check
    return req.path === '/';
  },
});

// Stricter Rate Limiter for Auth Endpoints
const authLimiter = (rateLimit as any)({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Max 5 login attempts per 15 minutes
  message: {
    success: false,
    message: 'Terlalu banyak percobaan login, coba lagi dalam 15 menit',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
});

// Strict Rate Limiter for Registration
const registrationLimiter = (rateLimit as any)({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Max 3 registration attempts per hour
  message: {
    success: false,
    message: 'Terlalu banyak percobaan pendaftaran, coba lagi dalam 1 jam',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export { 
  helmetMiddleware, 
  limiter, 
  authLimiter, 
  registrationLimiter 
};
