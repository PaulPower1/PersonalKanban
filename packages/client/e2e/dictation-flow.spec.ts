import { test, expect } from '@playwright/test';
import { resetTestData, registerAndLogin } from './helpers/auth';

test.beforeEach(async ({ page }) => {
  await resetTestData();
  await registerAndLogin(page);
  // Create a board
  await page.click('.sidebar__add-btn');
  await page.waitForTimeout(500);
});

async function injectTranscript(page: import('@playwright/test').Page, transcript: string) {
  await page.evaluate((t) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__testInjectTranscript(t);
  }, transcript);
}

function getModalField(page: import('@playwright/test').Page, label: string) {
  return page.locator('.modal__field').filter({ has: page.locator(`.modal__label`, { hasText: label }) });
}

test.describe('Voice dictation → Card modal flow', () => {
  test('title only — no keywords', async ({ page }) => {
    await injectTranscript(page, 'Buy groceries');

    const modal = page.locator('.modal');
    await expect(modal).toBeVisible();

    const titleInput = getModalField(page, 'Title').locator('input');
    await expect(titleInput).toHaveValue('Buy groceries');

    const descTextarea = getModalField(page, 'Description').locator('textarea');
    await expect(descTextarea).toHaveValue('');

    const prioritySelect = getModalField(page, 'Priority').locator('select');
    await expect(prioritySelect).toHaveValue('medium');
  });

  test('partial fields — title + priority only', async ({ page }) => {
    await injectTranscript(page, 'Fix the sink priority urgent');

    const modal = page.locator('.modal');
    await expect(modal).toBeVisible();

    const titleInput = getModalField(page, 'Title').locator('input');
    await expect(titleInput).toHaveValue('Fix the sink');

    const prioritySelect = getModalField(page, 'Priority').locator('select');
    await expect(prioritySelect).toHaveValue('urgent');
  });

  test('column specification', async ({ page }) => {
    await injectTranscript(page, 'Review notes column backlog');

    const modal = page.locator('.modal');
    await expect(modal).toBeVisible();

    const titleInput = getModalField(page, 'Title').locator('input');
    await expect(titleInput).toHaveValue('Review notes');

    const columnSelect = getModalField(page, 'Column').locator('select');
    await expect(columnSelect).toHaveValue('backlog');
  });

  test('submit dictated card and verify it appears on board', async ({ page }) => {
    await injectTranscript(
      page,
      'Walk the dog description take rover to the park priority medium'
    );

    const modal = page.locator('.modal');
    await expect(modal).toBeVisible();

    // Submit the card
    await modal.locator('button', { hasText: 'Add Card' }).click();

    // Wait for modal to close (card save is async)
    await expect(modal).not.toBeVisible({ timeout: 5000 });

    // Card should appear on the board (default column is "todo")
    const cardTitle = page.locator('.kanban-card__title', { hasText: 'Walk the dog' });
    await expect(cardTitle).toBeVisible();
  });
});
