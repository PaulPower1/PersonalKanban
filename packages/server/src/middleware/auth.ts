import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config';
import { prisma } from '../db';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  stripeCustomerId: string | null;
}

// Augment Express.User to match our AuthUser shape (Passport compatibility)
declare global {
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface User extends AuthUser {}
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.token;
  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as { userId: string };
    prisma.user
      .findUnique({ where: { id: payload.userId } })
      .then((user) => {
        if (!user) {
          res.status(401).json({ error: 'User not found' });
          return;
        }
        req.user = {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          stripeCustomerId: user.stripeCustomerId,
        } as Express.User;
        next();
      })
      .catch(next);
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

export function signToken(userId: string): string {
  return jwt.sign({ userId }, env.JWT_SECRET, { expiresIn: '7d' });
}
