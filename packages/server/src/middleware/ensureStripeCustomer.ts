import { Request, Response, NextFunction } from 'express';
import Stripe from 'stripe';
import { env } from '../config';
import { prisma } from '../db';
import { AuthUser } from './auth';

const stripe = new Stripe(env.STRIPE_SECRET_KEY);

export async function ensureStripeCustomer(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = req.user as AuthUser | undefined;
    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!user.stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.displayName,
      });

      await prisma.user.update({
        where: { id: user.id },
        data: { stripeCustomerId: customer.id },
      });

      user.stripeCustomerId = customer.id;
    }

    next();
  } catch (err) {
    next(err);
  }
}
