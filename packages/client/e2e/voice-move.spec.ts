import { test, expect } from '@playwright/test';
import { resetTestData, registerAndLogin } from './helpers/auth';

test.beforeEach(async ({ page }) => {
  await resetTestData();
  await registerAndLogin(page);
  // Create a board
  await page.click('.sidebar__add-btn');
  await page.waitForTimeout(500);

  // Add some cards for move testing
  for (const cardData of [
    { title: 'Card in todo' },
    { title: 'Another todo card' },
  ]) {
    await page.click('button:has-text("+ Add Card")');
    await page.waitForSelector('.modal');
    await page.fill('.modal__input[placeholder="Card title..."]', cardData.title);
    await page.click('.modal__btn--save');
    await page.waitForSelector('.modal', { state: 'detached' });
    await page.waitForTimeout(300);
  }
});

async function injectTranscript(page: import('@playwright/test').Page, transcript: string) {
  await page.evaluate((t) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__testInjectTranscript(t);
  }, transcript);
}

test.describe('Voice move command', () => {
  test('move card to done', async ({ page }) => {
    const todoColumn = page.locator('.column').nth(1);
    const doneColumn = page.locator('.column').nth(3);

    await expect(todoColumn.locator('.kanban-card__title', { hasText: 'Card in todo' })).toBeVisible();

    await injectTranscript(page, 'move card in todo to done');

    await expect(doneColumn.locator('.kanban-card__title', { hasText: 'Card in todo' })).toBeVisible({ timeout: 5000 });
  });

  test('non-move command falls through to card creation', async ({ page }) => {
    await injectTranscript(page, 'Buy groceries');

    const modal = page.locator('.modal');
    await expect(modal).toBeVisible();
    await expect(modal.locator('h2')).toHaveText('New Card');
  });

  test('move with no matching card is a no-op', async ({ page }) => {
    const cardsBefore = await page.locator('.kanban-card').count();

    await injectTranscript(page, 'move nonexistent card to done');

    await expect(page.locator('.modal')).not.toBeVisible();
    const cardsAfter = await page.locator('.kanban-card').count();
    expect(cardsAfter).toBe(cardsBefore);
  });
});
