import { test, expect } from '@playwright/test';
import { freshImport, stored, go, quickRate, collectErrors } from './helpers';

test.describe('Problem Bank', () => {
  test('filters, search, sort, quick rating, side panel, bulk actions, CSV', async ({ page }) => {
    const errors = collectErrors(page);
    await freshImport(page);
    await go(page, 'bank');
    await expect(page.getByRole('heading', { name: 'Problem Bank' })).toBeVisible();
    await expect(page.getByText('Showing 1–50 of 195')).toBeVisible();

    // Quick status filter
    const overdue = page.getByRole('group', { name: 'Quick status filters' }).getByRole('button', { name: /Overdue/ });
    await overdue.click();
    await expect(page.getByText(/Showing 1–\d+ of 29/)).toBeVisible();
    await overdue.click();

    // Search
    await page.getByRole('searchbox', { name: /Search by name/ }).fill('two sum');
    await expect(page.getByText(/of [1-9]$/)).toBeVisible();
    await page.getByRole('searchbox', { name: /Search by name/ }).fill('');

    // Filter panel + rating filter
    await page.getByRole('button', { name: /^Filters/ }).click();
    await page.getByLabel('Rating', { exact: true }).selectOption('none');
    await expect(page.getByText(/of 166$/)).toBeVisible();
    await page.getByRole('button', { name: /Clear 1/ }).click();
    await expect(page.getByText('of 195')).toBeVisible();

    // Sort and page size
    await page.getByLabel('Sort', { exact: true }).selectOption('num');
    await page.getByLabel('Rows per page').selectOption('200');
    await expect(page.getByText('Showing 1–195 of 195')).toBeVisible();

    // Quick rating
    await quickRate(page, 'green');
    let data = await stored(page);
    expect(Object.keys(data.revisions).length).toBe(30);

    // Side panel
    await page.locator('tbody tr').first().click();
    await expect(page.getByRole('button', { name: 'Record revision' })).toBeVisible();
    await page.keyboard.press('Escape');

    // Bulk reschedule. Priority follows the rating by default, so it has no bulk action.
    await page.locator('tbody tr').nth(1).getByRole('checkbox').check();
    await page.locator('tbody tr').nth(2).getByRole('checkbox').check();
    await expect(page.getByText('2 selected')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Priority', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Reschedule', exact: true }).click();
    await page.getByLabel('Next review date').fill('2030-01-15');
    await page.getByRole('button', { name: 'Apply' }).click();
    await expect(page.getByText('Updated 2 problems')).toBeVisible();
    data = await stored(page);
    expect(Object.values<any>(data.problems).filter(p => p.nextReview === '2030-01-15')).toHaveLength(2);

    // CSV export downloads a file
    await page.getByRole('button', { name: 'Export CSV' }).click();
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Save CSV file' }).click()]);
    expect(dl.suggestedFilename()).toMatch(/^recodex-problem-bank-\d{4}-\d{2}-\d{2}\.csv$/);

    // CSV import adds a problem
    await page.getByRole('button', { name: 'Import CSV' }).click();
    await page.getByLabel('CSV text').fill('name,pattern,difficulty\nBrand New Problem,Two Pointers,Hard\n');
    await page.getByRole('button', { name: /Import 1 rows/ }).click();
    await expect(page.getByText(/1 added/)).toBeVisible();
    data = await stored(page);
    expect(Object.keys(data.problems).length).toBe(196);

    // Hand-set priorities: turning autoPriority off brings the priority controls back
    await go(page, 'prefs');
    await page.getByRole('switch', { name: /Set priority from the rating/ }).click();
    await go(page, 'bank');
    const firstRow = page.locator('tbody tr').first();
    const target = (await firstRow.locator('td').nth(1).textContent())!.trim(); // the problem number
    const before = Object.values<any>((await stored(page)).problems).find(p => String(p.num) === target).priority;
    const pick = before === 'High' ? 'Low' : 'High';
    await firstRow.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Priority', exact: true }).click();
    await page.getByRole('radio', { name: pick }).click();
    await page.getByRole('button', { name: 'Apply' }).click();
    await expect(page.getByText('Updated 1 problem')).toBeVisible();
    data = await stored(page);
    expect(Object.values<any>(data.problems).find(p => String(p.num) === target).priority).toBe(pick);
    expect(errors).toEqual([]);
  });

  test('stays responsive with 5,000 problems', async ({ page }) => {
    await freshImport(page);
    await page.evaluate(() => {
      const k = 'recodex-v1'; const d = JSON.parse(localStorage.getItem(k)!);
      const base = Object.values<any>(d.problems)[0];
      for (let i = 0; i < 5000; i++) { const id = `p-${10000 + i}`; d.problems[id] = { ...base, id, num: 10000 + i, name: `Bulk problem ${i}` }; }
      localStorage.setItem(k, JSON.stringify(d));
    });
    await page.reload();
    await go(page, 'bank');
    await expect(page.getByText('of 5195')).toBeVisible();
    const t0 = Date.now();
    await page.getByRole('searchbox', { name: /Search by name/ }).fill('bulk problem 4321');
    await expect(page.getByText('Showing 1–1 of 1')).toBeVisible();
    expect(Date.now() - t0).toBeLessThan(2000);
  });
});
