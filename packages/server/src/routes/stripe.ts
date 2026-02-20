import { Router, Request, Response, NextFunction } from 'express';
import Stripe from 'stripe';
import { z } from 'zod';
import { prisma } from '../db';
import { env, TIER_LIMITS } from '../config';
import { requireAuth, AuthUser } from '../middleware/auth';
import { ensureStripeCustomer } from '../middleware/ensureStripeCustomer';
import { getUserTier } from '../services/entitlements';

const stripe = new Stripe(env.STRIPE_SECRET_KEY);
const router = Router();

function getUser(req: Request): AuthUser {
  return req.user! as AuthUser;
}

const PRICE_TO_TIER: Record<string, 'STARTER' | 'PRO'> = {
  [env.STRIPE_STARTER_PRICE_ID]: 'STARTER',
  [env.STRIPE_PRO_PRICE_ID]: 'PRO',
};

// POST /api/stripe/create-checkout-session
const checkoutSchema = z.object({
  priceId: z.string().min(1),
});

router.post(
  '/create-checkout-session',
  requireAuth,
  ensureStripeCustomer,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = getUser(req);
      const { priceId } = checkoutSchema.parse(req.body);

      const tier = PRICE_TO_TIER[priceId];
      if (!tier) {
        res.status(400).json({ error: 'Invalid price ID' });
        return;
      }

      const session = await stripe.checkout.sessions.create({
        customer: user.stripeCustomerId!,
        mode: 'payment',
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${env.CLIENT_URL}/billing?status=success`,
        cancel_url: `${env.CLIENT_URL}/billing?status=cancelled`,
        metadata: {
          userId: user.id,
          tier,
        },
      });

      res.json({ sessionUrl: session.url });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/stripe/billing-status
router.get('/billing-status', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUser(req).id;
    const tier = await getUserTier(userId);
    const limit = TIER_LIMITS[tier];
    const cardCount = await prisma.card.count({
      where: { board: { userId } },
    });

    res.json({ tier, cardCount, cardLimit: limit });
  } catch (err) {
    next(err);
  }
});

// POST /api/stripe/webhook — raw body required, NO auth
router.post('/webhook', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    res.status(400).json({ error: 'Invalid signature' });
    return;
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.userId;
    const tier = session.metadata?.tier as 'STARTER' | 'PRO' | undefined;

    if (userId && tier) {
      await prisma.accountUpgrade.upsert({
        where: { userId },
        update: {
          tier,
          stripeSessionId: session.id,
          stripePaymentIntentId: session.payment_intent as string,
          amountCents: session.amount_total ?? 0,
          purchasedAt: new Date(),
          limitEmailSentAt: null,
        },
        create: {
          userId,
          tier,
          stripeSessionId: session.id,
          stripePaymentIntentId: session.payment_intent as string,
          amountCents: session.amount_total ?? 0,
          purchasedAt: new Date(),
        },
      });
    }
  }

  res.json({ received: true });
});

export default router;
