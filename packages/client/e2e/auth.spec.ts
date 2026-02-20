import { test, expect } from '@playwright/test';
import { resetTestData, registerAndLogin } from './helpers/auth';

test.beforeEach(async () => {
  await resetTestData();
});

test.describe('Authentication', () => {
  test('register and redirect to home', async ({ page }) => {
    await registerAndLogin(page);
    await expect(page.locator('.toolbar')).toBeVisible();
  });

  test('login with existing user', async ({ page }) => {
    const email = `login-test-${Date.now()}@example.com`;
    const password = 'password123';

    // Register first
    await registerAndLogin(page, { email, password, displayName: 'Login Test' });

    // Logout
    await page.click('button:has-text("Logout")');
    await page.waitForURL('/login');

    // Login
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('.auth-card__submit');
    await page.waitForURL('/');
    await expect(page.locator('.toolbar')).toBeVisible();
  });

  test('wrong password shows error', async ({ page }) => {
    const email = `wrong-pass-${Date.now()}@example.com`;
    await registerAndLogin(page, { email, displayName: 'Wrong Pass' });

    // Logout
    await page.click('button:has-text("Logout")');
    await page.waitForURL('/login');

    // Try wrong password
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('.auth-card__submit');

    await expect(page.locator('.auth-card__error')).toContainText('Invalid credentials');
  });

  test('unauthenticated user is redirected to /login', async ({ page }) => {
    await page.goto('/');
    await page.waitForURL('/login');
  });

  test('authenticated user visiting /login is redirected to /', async ({ page }) => {
    await registerAndLogin(page);
    await page.goto('/login');
    await page.waitForURL('/');
  });

  test('logout clears session', async ({ page }) => {
    await registerAndLogin(page);
    await page.click('button:has-text("Logout")');
    await page.waitForURL('/login');

    // Trying to go home should redirect to login
    await page.goto('/');
    await page.waitForURL('/login');
  });
});
