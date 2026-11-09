import { test, expect } from '@playwright/test';
import { freshImport, stored, go, quickRate, collectErrors } from './helpers';

test.describe('Smoke test', () => {
  test('sign in / import, rate a problem, run mixed session to summary, open analytics, switch theme', async ({ page }) => {
    const errors = collectErrors(page);

    // 1. Sign in or initialize fresh import
    if (process.env.E2E_EMAIL && process.env.E2E_PASSWORD) {
      await page.goto('/');
      await page.getByLabel(/email/i).fill(process.env.E2E_EMAIL);
      await page.getByLabel(/password/i).fill(process.env.E2E_PASSWORD);
      await page.getByRole('button', { name: /sign in/i }).click();
      await expect(page.getByText(/Lifetime mastery/i)).toBeVisible();
    } else {
      await freshImport(page);
    }

    // 2. Rate a problem from the dashboard
    await expect(page.getByText('Lifetime mastery')).toBeVisible();
    await quickRate(page, 'green');

    // 3. Mixed session to summary
    await go(page, 'practice');
    await expect(page.getByRole('heading', { name: 'Mixed Practice', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Generate session' }).click();
    await page.getByRole('button', { name: 'Start session' }).click();

    // Session runner
    await expect(page.getByRole('button', { name: 'Exit focus mode' })).toBeVisible();
    // Complete or skip problems in the session until summary
    while (await page.getByRole('button', { name: 'Exit focus mode' }).isVisible().catch(() => false)) {
      const isCompleteVisible = await page.getByText('Session complete').isVisible().catch(() => false);
      if (isCompleteVisible) break;

      const skipBtn = page.getByRole('button', { name: 'Skip' });
      const rateBtn = page.getByRole('button', { name: 'Rate green' });
      if (await rateBtn.isVisible()) {
        await rateBtn.click();
        await page.getByRole('button', { name: 'Save revision' }).click();
      } else if (await skipBtn.isVisible()) {
        await skipBtn.click();
      } else {
        break;
      }
      await page.waitForTimeout(200);
    }

    // Check summary
    await expect(page.getByText(/Session complete|Practice summary/i)).toBeVisible();
    await page.getByRole('button', { name: /Leave|Done/i }).first().click();

    // 4. Open Analytics
    await go(page, 'analytics');
    await expect(page.getByRole('heading', { name: 'Analytics', exact: true })).toBeVisible();
    await expect(page.getByText(/Daily revisions/i)).toBeVisible();

    // 5. Switch theme in Settings
    await go(page, 'prefs');
    await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
    await page.getByRole('radio', { name: 'Dusk' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.getByRole('radio', { name: 'Dawn' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    expect(errors).toEqual([]);
  });
});
