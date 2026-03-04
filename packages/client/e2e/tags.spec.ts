import { test, expect } from '@playwright/test';
import { resetTestData, registerAndLogin } from './helpers/auth';

test.describe('Tags feature', () => {
  test.beforeEach(async ({ page }) => {
    await resetTestData();
    await registerAndLogin(page);
    // Create a board
    await page.click('.sidebar__add-btn');
    await page.waitForTimeout(500);
  });

  test('add tags via modal', async ({ page }) => {
    await page.locator('.toolbar__btn--primary', { hasText: 'Add Card' }).click();
    await page.waitForSelector('.modal');

    await page.fill('.modal__input[placeholder="Card title..."]', 'Test tagged card');

    const tagInput = page.locator('.modal__input[placeholder="Add tags (comma-separated)..."]');
    await tagInput.fill('urgent-fix, review');
    await tagInput.press('Enter');

    await expect(page.locator('.modal__tags .tag-badge', { hasText: 'urgent-fix' })).toBeVisible();
    await expect(page.locator('.modal__tags .tag-badge', { hasText: 'review' })).toBeVisible();

    await page.click('.modal__btn--save');
    await page.waitForSelector('.modal', { state: 'detached' });

    const newCard = page.locator('.kanban-card', { hasText: 'Test tagged card' });
    await expect(newCard.locator('.tag-badge', { hasText: 'urgent-fix' })).toBeVisible();
    await expect(newCard.locator('.tag-badge', { hasText: 'review' })).toBeVisible();
  });

  test('voice dictation with tags keyword', async ({ page }) => {
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__testInjectTranscript('Buy new running shoes tags fitness shopping');
    });

    await page.waitForSelector('.modal');

    const titleInput = page.locator('.modal__input[placeholder="Card title..."]');
    await expect(titleInput).toHaveValue('Buy new running shoes');

    await expect(page.locator('.modal__tags .tag-badge', { hasText: 'fitness' })).toBeVisible();
    await expect(page.locator('.modal__tags .tag-badge', { hasText: 'shopping' })).toBeVisible();
  });
});
