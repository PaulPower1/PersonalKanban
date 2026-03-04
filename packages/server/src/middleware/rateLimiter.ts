import rateLimit from 'express-rate-limit';
import { env } from '../config';

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per window per IP
  message: { error: 'Too many attempts. Try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.NODE_ENV === 'test' || process.env.VITEST === 'true',
});
