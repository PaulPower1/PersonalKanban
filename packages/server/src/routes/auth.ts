import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import Stripe from 'stripe';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { z } from 'zod';
import { prisma } from '../db';
import { env, JWT_COOKIE_OPTIONS } from '../config';
import { signToken, requireAuth } from '../middleware/auth';
import { authLimiter } from '../middleware/rateLimiter';

const stripe = new Stripe(env.STRIPE_SECRET_KEY);
const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(1).max(100),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// POST /api/auth/register
router.post('/register', authLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, displayName } = registerSchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ error: 'An account with this email already exists' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);

    let stripeCustomerId: string | null = null;
    try {
      const customer = await stripe.customers.create({ email, name: displayName });
      stripeCustomerId = customer.id;
    } catch {
      // Stripe not configured or unavailable — customer will be created lazily at checkout
    }

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email,
          passwordHash,
          displayName,
          stripeCustomerId,
        },
      });

      await tx.accountUpgrade.create({
        data: { userId: created.id },
      });

      await tx.board.create({
        data: { title: 'My Board', userId: created.id },
      });

      return created;
    });

    const token = signToken(user.id);
    res.cookie('token', token, JWT_COOKIE_OPTIONS);
    res.status(201).json({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login
router.post('/login', authLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const token = signToken(user.id);
    res.cookie('token', token, JWT_COOKIE_OPTIONS);
    res.json({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/logout
router.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie('token', JWT_COOKIE_OPTIONS);
  res.json({ ok: true });
});

// GET /api/auth/me
router.get('/me', requireAuth, (req: Request, res: Response) => {
  res.json({
    id: req.user!.id,
    email: req.user!.email,
    displayName: req.user!.displayName,
  });
});

// Google OAuth setup
if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        callbackURL: '/api/auth/google/callback',
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          if (!email) {
            done(new Error('No email from Google'));
            return;
          }

          // Check if user exists with this Google ID
          let user = await prisma.user.findUnique({
            where: { googleId: profile.id },
          });

          if (!user) {
            // Check if user exists with this email (link accounts)
            user = await prisma.user.findUnique({ where: { email } });

            if (user) {
              // Link Google to existing account
              user = await prisma.user.update({
                where: { id: user.id },
                data: { googleId: profile.id },
              });
            } else {
              // Create new user
              let stripeCustomerId: string | null = null;
              try {
                const customer = await stripe.customers.create({
                  email,
                  name: profile.displayName || email,
                });
                stripeCustomerId = customer.id;
              } catch {
                // Stripe not configured — customer will be created lazily
              }

              user = await prisma.$transaction(async (tx) => {
                const created = await tx.user.create({
                  data: {
                    email,
                    googleId: profile.id,
                    displayName: profile.displayName || email,
                    stripeCustomerId,
                  },
                });

                await tx.accountUpgrade.create({
                  data: { userId: created.id },
                });

                await tx.board.create({
                  data: { title: 'My Board', userId: created.id },
                });

                return created;
              });
            }
          }

          done(null, user);
        } catch (err) {
          done(err as Error);
        }
      }
    )
  );

  // GET /api/auth/google
  router.get(
    '/google',
    passport.authenticate('google', { scope: ['profile', 'email'], session: false })
  );

  // GET /api/auth/google/callback
  router.get(
    '/google/callback',
    passport.authenticate('google', { session: false, failureRedirect: `${env.CLIENT_URL}/login` }),
    (req: Request, res: Response) => {
      const user = req.user as { id: string };
      const token = signToken(user.id);
      res.cookie('token', token, JWT_COOKIE_OPTIONS);
      res.redirect(env.CLIENT_URL);
    }
  );
} else {
  router.get('/google', (_req: Request, res: Response) => {
    res.status(501).json({ error: 'Google OAuth is not configured' });
  });
}

// GET /api/auth/providers — public, reports available auth methods
router.get('/providers', (_req: Request, res: Response) => {
  res.json({
    google: !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
  });
});

export default router;
