import { expect, type Page } from '@playwright/test';

/** Fresh local-mode account with the seed import finalized. */
export async function freshImport(page: Page) {
  await page.goto('/');
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('recodex-local-note', '1'); });
  await page.reload();
  await page.getByRole('button', { name: 'Finalize import' }).click();
  await expect(page.getByText('Lifetime mastery')).toBeVisible();
}

export async function stored(page: Page) {
  // LocalBackend writes after a short debounce.
  await page.waitForTimeout(400);
  return page.evaluate(() => JSON.parse(localStorage.getItem('recodex-v1') || '{}'));
}

export async function go(page: Page, route: string) {
  await page.evaluate(r => { location.hash = r; }, route);
  await page.waitForTimeout(150);
}

/** Rates the first visible problem with a quick-rate dot and saves the dialog. */
export async function quickRate(page: Page, rating: 'green' | 'yellow' | 'red') {
  await page.getByRole('button', { name: `Rate ${rating}` }).first().click();
  await page.getByRole('button', { name: 'Save revision' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

export function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !m.text().includes('Warning:')) errors.push(m.text()); });
  return errors;
}
