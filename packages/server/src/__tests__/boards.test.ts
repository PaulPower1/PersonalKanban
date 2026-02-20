import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../index';

// Mock Stripe
vi.mock('stripe', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      customers: {
        create: vi.fn().mockResolvedValue({ id: 'cus_test_' + Math.random().toString(36).slice(2) }),
      },
      checkout: { sessions: { create: vi.fn() } },
      webhooks: { constructEvent: vi.fn() },
    })),
  };
});

async function createAuthenticatedUser(userData?: Partial<{ email: string; password: string; displayName: string }>) {
  const user = {
    email: userData?.email ?? `test-${Date.now()}@example.com`,
    password: userData?.password ?? 'password123',
    displayName: userData?.displayName ?? 'Test User',
  };
  const res = await request(app).post('/api/auth/register').send(user);
  const cookie = res.headers['set-cookie'];
  return { user: res.body, cookie: Array.isArray(cookie) ? cookie : cookie ? [cookie] : [] };
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

      expect(res.body).toHaveLength(1);
      expect(res.body[0].title).toBe('Board 1');
    });

    it('isolates boards between users', async () => {
      await request(app)
        .post('/api/boards')
        .set('Cookie', cookie)
        .send({ title: 'User 1 Board' });

      const auth2 = await createAuthenticatedUser({ email: 'user2@example.com' });

      const res = await request(app)
        .get('/api/boards')
        .set('Cookie', auth2.cookie)
        .expect(200);

      expect(res.body).toHaveLength(0);
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
