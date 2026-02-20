import { test, expect } from '@playwright/test';
import { resetTestData, registerAndLogin } from './helpers/auth';

test.beforeEach(async ({ page }) => {
  await resetTestData();
  await registerAndLogin(page);
  // Create a board to work with
  await page.click('.sidebar__add-btn');
  await page.waitForTimeout(500);
});

test.describe('Default board smoke test', () => {
  test('renders four columns', async ({ page }) => {
    const columns = page.locator('.column');
    await expect(columns).toHaveCount(4);

    const headers = page.locator('.column__title');
    await expect(headers.nth(0)).toContainText('Backlog');
    await expect(headers.nth(1)).toContainText('To Do');
    await expect(headers.nth(2)).toContainText('In Progress');
    await expect(headers.nth(3)).toContainText('Done');
  });

  test('new board starts with zero cards', async ({ page }) => {
    const cards = page.locator('.kanban-card');
    await expect(cards).toHaveCount(0);
  });
});
