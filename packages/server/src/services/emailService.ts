import { Resend } from 'resend';
import { Tier } from '@prisma/client';
import { env, TIER_LIMITS } from '../config';
import { prisma } from '../db';

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

export async function maybeSendLimitEmail(userId: string, tier: Tier): Promise<void> {
  const upgrade = await prisma.accountUpgrade.findUnique({ where: { userId } });
  if (!upgrade || upgrade.limitEmailSentAt) return;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;

  const limit = TIER_LIMITS[tier];

  if (resend) {
    try {
      await resend.emails.send({
        from: 'Personal Kanban <noreply@personalkanban.app>',
        to: user.email,
        subject: `You've reached your ${tier} plan card limit`,
        html: `
          <h2>Card limit reached</h2>
          <p>You've used all ${limit} cards in your ${tier} plan.</p>
          <p>Upgrade your plan to add more cards across all your boards.</p>
          <p><a href="${env.CLIENT_URL}/billing">Upgrade Now</a></p>
        `,
      });
    } catch (err) {
      console.error('Failed to send limit email:', err);
    }
  }

  await prisma.accountUpgrade.update({
    where: { userId },
    data: { limitEmailSentAt: new Date() },
  });
}
