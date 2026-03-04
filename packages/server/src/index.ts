import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import passport from 'passport';
import { env } from './config';
import { errorHandler } from './middleware/errorHandler';
import authRoutes from './routes/auth';
import boardRoutes from './routes/boards';
import stripeRoutes from './routes/stripe';
import { prisma } from './db';
import { authLimiter } from './middleware/rateLimiter';

const app = express();

// CORS
app.use(
  cors({
    origin: env.CLIENT_URL,
    credentials: true,
  })
);

// Stripe webhook needs raw body — register BEFORE json parser
app.use(
  '/api/stripe/webhook',
  express.raw({ type: 'application/json' })
);

// JSON parsing for all other routes
app.use(express.json());
app.use(cookieParser());
app.use(passport.initialize());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/boards', boardRoutes);
app.use('/api/stripe', stripeRoutes);

// Test reset endpoint — only in test/development
if (env.NODE_ENV === 'test' || env.NODE_ENV === 'development') {
  app.delete('/api/test/reset', async (req, res) => {
    await prisma.card.deleteMany();
    await prisma.category.deleteMany();
    await prisma.board.deleteMany();
    await prisma.accountUpgrade.deleteMany();
    await prisma.user.deleteMany();
    // Reset rate limiter so tests don't get blocked
    await authLimiter.resetKey(req.ip ?? '127.0.0.1');
    await authLimiter.resetKey('::1');
    await authLimiter.resetKey('::ffff:127.0.0.1');
    res.json({ ok: true });
  });
}

// Error handler — MUST be last
app.use(errorHandler);

if (env.NODE_ENV !== 'test' && process.env.VITEST !== 'true') {
  const port = env.PORT;
  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}

export default app;
