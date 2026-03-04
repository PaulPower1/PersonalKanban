import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../index';
import { prisma } from '../db';

const { mockConstructEvent } = vi.hoisted(() => ({
  mockConstructEvent: vi.fn(),
}));

// Mock Stripe
vi.mock('stripe', () => {
  const StripeMock = vi.fn(function StripeMock() {
    return {
      customers: {
        create: vi.fn().mockResolvedValue({ id: 'cus_test_webhook' }),
      },
      checkout: { sessions: { create: vi.fn() } },
      webhooks: { constructEvent: mockConstructEvent },
    };
  });

  return {
    default: StripeMock,
  };
});

describe('Stripe webhook', () => {
  let userId: string;

  beforeEach(async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'webhook@example.com',
        password: 'password123',
        displayName: 'Webhook User',
      });
    userId = res.body.id;
  });

  it('upgrades account on checkout.session.completed', async () => {
    const session = {
      id: 'cs_test_123',
      payment_intent: 'pi_test_123',
      amount_total: 500,
      metadata: { userId, tier: 'STARTER' },
    };

    mockConstructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: { object: session },
    });

    await request(app)
      .post('/api/stripe/webhook')
      .set('stripe-signature', 'test_sig')
      .send(JSON.stringify(session))
      .expect(200);

    const upgrade = await prisma.accountUpgrade.findUnique({ where: { userId } });
    expect(upgrade?.tier).toBe('STARTER');
    expect(upgrade?.stripeSessionId).toBe('cs_test_123');
  });

  it('is idempotent — same session twice creates one record', async () => {
    const session = {
      id: 'cs_test_456',
      payment_intent: 'pi_test_456',
      amount_total: 1000,
      metadata: { userId, tier: 'PRO' },
    };

    mockConstructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: { object: session },
    });

    // First call
    await request(app)
      .post('/api/stripe/webhook')
      .set('stripe-signature', 'test_sig')
      .send(JSON.stringify(session))
      .expect(200);

    // Second call (idempotent)
    await request(app)
      .post('/api/stripe/webhook')
      .set('stripe-signature', 'test_sig')
      .send(JSON.stringify(session))
      .expect(200);

    const upgrades = await prisma.accountUpgrade.findMany({ where: { userId } });
    expect(upgrades).toHaveLength(1);
    expect(upgrades[0].tier).toBe('PRO');
  });
});
