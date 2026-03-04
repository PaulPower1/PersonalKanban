import { test, expect } from '@playwright/test';
import { resetTestData, registerAndLogin } from './helpers/auth';

test.beforeEach(async ({ page }) => {
  await resetTestData();
  await registerAndLogin(page);
});

test.describe('Card limits', () => {
  test('free plan blocks card 11', async ({ page }) => {
    const addCardButton = page.locator('.toolbar__btn--primary', { hasText: 'Add Card' });

    // Add 10 cards
    for (let i = 1; i <= 10; i++) {
      await addCardButton.click();
      await page.waitForSelector('.modal');
      await page.fill('.modal__input[placeholder="Card title..."]', `Card ${i}`);
      await page.click('.modal__btn--save');
      await page.waitForSelector('.modal', { state: 'detached' });
      await page.waitForTimeout(300);
    }

    // 11th card should show limit error
    await addCardButton.click();
    await page.waitForSelector('.modal');
    await page.fill('.modal__input[placeholder="Card title..."]', 'Card 11');
    await page.click('.modal__btn--save');

    // Should see the limit error inline in modal
    await expect(page.locator('.modal__limit-error')).toBeVisible();

    // Toast should appear
    await expect(page.locator('.toast')).toBeVisible();
    await expect(page.locator('.toast__action')).toContainText('Upgrade Plan');
  });
});
