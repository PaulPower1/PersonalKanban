import { test, expect } from '@playwright/test';
import { resetTestData, registerAndLogin } from './helpers/auth';

test.beforeEach(async ({ page }) => {
  await resetTestData();
  await registerAndLogin(page);
});

test.describe('Billing page', () => {
  test('shows billing page with tier info', async ({ page }) => {
    await page.goto('/billing');

    // Should show the billing title
    await expect(page.locator('.billing-page__title')).toHaveText('Billing');

    // Should show usage
    await expect(page.locator('.billing-page__usage-count')).toBeVisible();

    // Should show 3 plan cards
    const plans = page.locator('.billing-plan');
    await expect(plans).toHaveCount(3);

    // Free plan should be current
    await expect(page.locator('.billing-plan__badge')).toHaveText('Current');
  });

  test('upgrade buttons are visible for higher tiers', async ({ page }) => {
    await page.goto('/billing');

    // Starter and Pro should have upgrade buttons
    const upgradeButtons = page.locator('.billing-plan__btn:not(:disabled)');
    await expect(upgradeButtons).toHaveCount(2);
  });
});
