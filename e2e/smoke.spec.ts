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
    await page.getByRole('button', { name: /Generate session/ }).click();
    await page.getByRole('button', { name: /Enter the arena/ }).click();

    // Focus mode: rate every problem Green with the keyboard (1 = Green, Enter = save) until the summary
    await expect(page.getByRole('button', { name: 'Exit focus mode' })).toBeVisible();
    const counter = await page.getByText(/Problem 1 of \d+/).textContent();
    const total = Number(/of (\d+)/.exec(counter ?? '')?.[1] ?? 0);
    expect(total).toBeGreaterThan(0);
    for (let i = 0; i < total; i++) {
      await expect(page.getByText(`Problem ${i + 1} of ${total}`)).toBeVisible();
      await page.keyboard.press('1');
      await page.keyboard.press('Enter');
    }

    // Check summary
    await expect(page.getByText('Session complete')).toBeVisible();
    await page.getByRole('button', { name: 'Back to dashboard' }).click();
    await expect(page.getByText('Lifetime mastery')).toBeVisible();

    // 4. Open Analytics
    await go(page, 'analytics');
    await expect(page.getByRole('heading', { name: 'Analytics', exact: true })).toBeVisible();
    await expect(page.getByText(/Daily revisions/i)).toBeVisible();

    // 5. Switch theme in Settings
    await go(page, 'prefs');
    await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
    await page.getByRole('radio', { name: 'Midnight Steel' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.getByRole('radio', { name: 'Dawn' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    expect(errors).toEqual([]);
  });
});
