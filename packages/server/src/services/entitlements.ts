import { Tier } from '@prisma/client';
import { prisma } from '../db';
import { TIER_LIMITS } from '../config';

export async function getUserTier(userId: string): Promise<Tier> {
  const upgrade = await prisma.accountUpgrade.findUnique({ where: { userId } });
  return upgrade?.tier ?? 'FREE';
}

export async function getCardLimit(userId: string): Promise<number> {
  return TIER_LIMITS[await getUserTier(userId)];
}

export async function canAddCard(userId: string): Promise<{
  allowed: boolean;
  tier: Tier;
  limit: number;
  currentCount: number;
}> {
  const tier = await getUserTier(userId);
  const limit = TIER_LIMITS[tier];
  const currentCount = await prisma.card.count({
    where: { board: { userId } },
  });

  return {
    allowed: currentCount < limit,
    tier,
    limit,
    currentCount,
  };
}
