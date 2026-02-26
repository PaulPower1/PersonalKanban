import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../index';

// Mock Stripe
vi.mock('stripe', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      customers: {
        create: vi.fn().mockResolvedValue({ id: 'cus_test_123' }),
      },
      checkout: { sessions: { create: vi.fn() } },
      webhooks: { constructEvent: vi.fn() },
    })),
  };
});

describe('Auth endpoints', () => {
  const testUser = {
    email: 'test@example.com',
    password: 'password123',
    displayName: 'Test User',
  };

  describe('POST /api/auth/register', () => {
    it('creates a new user and returns JWT cookie', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send(testUser)
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.email).toBe(testUser.email);
      expect(res.body.displayName).toBe(testUser.displayName);
      expect(res.headers['set-cookie']).toBeDefined();
    });

    it('creates a default board for the new user', async () => {
      const registerRes = await request(app)
        .post('/api/auth/register')
        .send({ email: 'newboard@example.com', password: 'password123', displayName: 'Board Test' })
        .expect(201);

      const cookie = registerRes.headers['set-cookie'];
      const boardsRes = await request(app)
        .get('/api/boards')
        .set('Cookie', cookie)
        .expect(200);

      expect(boardsRes.body).toHaveLength(1);
      expect(boardsRes.body[0].title).toBe('My Board');
    });

    it('rejects duplicate email', async () => {
      await request(app).post('/api/auth/register').send(testUser);

      const res = await request(app)
        .post('/api/auth/register')
        .send(testUser)
        .expect(409);

      expect(res.body.error).toContain('already exists');
    });

    it('validates email format', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ ...testUser, email: 'invalid' })
        .expect(400);

      expect(res.body.error).toBe('Validation error');
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await request(app).post('/api/auth/register').send(testUser);
    });

    it('logs in with correct credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: testUser.email, password: testUser.password })
        .expect(200);

      expect(res.body.email).toBe(testUser.email);
      expect(res.headers['set-cookie']).toBeDefined();
    });

    it('rejects wrong password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: testUser.email, password: 'wrongpassword' })
        .expect(401);

      expect(res.body.error).toBe('Invalid credentials');
    });

    it('rejects non-existent user', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nope@example.com', password: 'whatever' })
        .expect(401);

      expect(res.body.error).toBe('Invalid credentials');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('clears the token cookie', async () => {
      const res = await request(app)
        .post('/api/auth/logout')
        .expect(200);

      expect(res.body.ok).toBe(true);
    });
  });

  describe('GET /api/auth/me', () => {
    it('returns user when authenticated', async () => {
      const registerRes = await request(app)
        .post('/api/auth/register')
        .send(testUser);

      const cookie = registerRes.headers['set-cookie'];

      const res = await request(app)
        .get('/api/auth/me')
        .set('Cookie', cookie)
        .expect(200);

      expect(res.body.email).toBe(testUser.email);
    });

    it('returns 401 when not authenticated', async () => {
      await request(app)
        .get('/api/auth/me')
        .expect(401);
    });
  });

  describe('Google OAuth redirects', () => {
    it('redirects /google to Google consent screen', async () => {
      const res = await request(app)
        .get('/api/auth/google')
        .expect(302);

      expect(res.headers.location).toMatch(/^https:\/\/accounts\.google\.com/);
    });

    it('redirects to CLIENT_URL/login on auth failure', async () => {
      const res = await request(app)
        .get('/api/auth/google/callback')
        .query({ error: 'access_denied' })
        .expect(302);

      expect(res.headers.location).toMatch(/\/login$/);
      expect(res.headers.location).not.toBe('/login');
    });
  });
});
