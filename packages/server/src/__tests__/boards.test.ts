import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../index';

let emailCounter = 0;
let customerCounter = 0;

function nextTestEmail(prefix = 'test') {
  emailCounter += 1;
  return `${prefix}-${emailCounter}@example.com`;
}

// Mock Stripe
vi.mock('stripe', () => {
  const StripeMock = vi.fn(function StripeMock() {
    return {
      customers: {
        create: vi.fn().mockImplementation(async () => {
          customerCounter += 1;
          return { id: `cus_test_${customerCounter}` };
        }),
      },
      checkout: { sessions: { create: vi.fn() } },
      webhooks: { constructEvent: vi.fn() },
    };
  });

  return {
    default: StripeMock,
  };
});

async function createAuthenticatedUser(userData?: Partial<{ email: string; password: string; displayName: string }>) {
  const basePassword = userData?.password ?? 'password123';
  const baseDisplayName = userData?.displayName ?? 'Test User';

  for (let attempt = 0; attempt < 5; attempt++) {
    const candidateEmail =
      attempt === 0 && userData?.email
        ? userData.email
        : nextTestEmail('retry');

    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: candidateEmail,
        password: basePassword,
        displayName: baseDisplayName,
      });

    if (registerRes.status === 201) {
      const registerCookie = registerRes.headers['set-cookie'];
      const normalizedRegisterCookie = Array.isArray(registerCookie)
        ? registerCookie
        : registerCookie
          ? [registerCookie]
          : [];

      return { user: registerRes.body, cookie: normalizedRegisterCookie };
    }

    if (registerRes.status !== 409) {
      throw new Error(`Unexpected register status: ${registerRes.status}`);
    }
  }

  throw new Error('Failed to create unique authenticated test user after retries');
}

describe('Board endpoints', () => {
  let cookie: string[];

  beforeEach(async () => {
    const auth = await createAuthenticatedUser();
    cookie = auth.cookie;
  });

  describe('POST /api/boards', () => {
    it('creates a new board', async () => {
      const res = await request(app)
        .post('/api/boards')
        .set('Cookie', cookie)
        .send({ title: 'Test Board' })
        .expect(201);

      expect(res.body.title).toBe('Test Board');
      expect(res.body.id).toBeDefined();
    });
  });

  describe('GET /api/boards', () => {
    it('lists user boards', async () => {
      await request(app)
        .post('/api/boards')
        .set('Cookie', cookie)
        .send({ title: 'Board 1' });

      const res = await request(app)
        .get('/api/boards')
        .set('Cookie', cookie)
        .expect(200);

      expect(res.body).toHaveLength(2);
      expect(res.body.map((b: { title: string }) => b.title)).toContain('Board 1');
    });

    it('isolates boards between users', async () => {
      await request(app)
        .post('/api/boards')
        .set('Cookie', cookie)
        .send({ title: 'User 1 Board' });

      const auth2 = await createAuthenticatedUser({ email: nextTestEmail('user2') });

      const res = await request(app)
        .get('/api/boards')
        .set('Cookie', auth2.cookie)
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].title).toBe('My Board');
    });
  });

  describe('Card CRUD', () => {
    let boardId: string;

    beforeEach(async () => {
      const boardRes = await request(app)
        .post('/api/boards')
        .set('Cookie', cookie)
        .send({ title: 'Test Board' });
      boardId = boardRes.body.id;
    });

    it('creates a card', async () => {
      const res = await request(app)
        .post(`/api/boards/${boardId}/cards`)
        .set('Cookie', cookie)
        .send({
          title: 'Test Card',
          description: 'A test',
          category: 'Work',
          priority: 'high',
          dueDate: null,
          tags: ['test'],
          columnId: 'todo',
        })
        .expect(201);

      expect(res.body.title).toBe('Test Card');
    });

    it('deletes a card', async () => {
      const cardRes = await request(app)
        .post(`/api/boards/${boardId}/cards`)
        .set('Cookie', cookie)
        .send({ title: 'To Delete', columnId: 'todo' });

      await request(app)
        .delete(`/api/boards/${boardId}/cards/${cardRes.body.id}`)
        .set('Cookie', cookie)
        .expect(200);
    });
  });

  describe('Account-wide card limits', () => {
    it('blocks the 11th card across multiple boards', async () => {
      // Create 2 boards
      const board1Res = await request(app)
        .post('/api/boards')
        .set('Cookie', cookie)
        .send({ title: 'Board A' });
      const board2Res = await request(app)
        .post('/api/boards')
        .set('Cookie', cookie)
        .send({ title: 'Board B' });

      // Add 5 cards to each board (10 total)
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post(`/api/boards/${board1Res.body.id}/cards`)
          .set('Cookie', cookie)
          .send({ title: `Card A${i}`, columnId: 'todo' });
      }
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post(`/api/boards/${board2Res.body.id}/cards`)
          .set('Cookie', cookie)
          .send({ title: `Card B${i}`, columnId: 'todo' });
      }

      // 11th card should fail
      const res = await request(app)
        .post(`/api/boards/${board1Res.body.id}/cards`)
        .set('Cookie', cookie)
        .send({ title: 'Card 11', columnId: 'todo' })
        .expect(403);

      expect(res.body.code).toBe('CARD_LIMIT_EXCEEDED');
      expect(res.body.limit).toBe(10);
      expect(res.body.currentCount).toBe(10);
    });
  });
});
