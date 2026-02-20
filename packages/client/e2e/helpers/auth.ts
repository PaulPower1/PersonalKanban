import { Page } from '@playwright/test';

const API_URL = 'http://localhost:3001';

export async function resetTestData(page?: Page) {
  // Clear browser cookies to prevent stale JWT tokens from interfering
  if (page) {
    await page.context().clearCookies();
  }
  await fetch(`${API_URL}/api/test/reset`, { method: 'DELETE' });
}

export async function registerAndLogin(
  page: Page,
  userData?: { email?: string; password?: string; displayName?: string }
) {
  const email = userData?.email ?? `test-${Date.now()}@example.com`;
  const password = userData?.password ?? 'password123';
  const displayName = userData?.displayName ?? 'Test User';

  // Clear cookies before registering to avoid stale session interference
  await page.context().clearCookies();

  // Navigate to register
  await page.goto('/register');
  await page.fill('input[type="text"]', displayName);
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('.auth-card__submit');

  // Wait for redirect to main app
  await page.waitForURL('/');
}

export async function loginExistingUser(
  page: Page,
  email: string,
  password: string
) {
  await page.goto('/login');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('.auth-card__submit');
  await page.waitForURL('/');
}
