import { test, expect } from '@playwright/test';
import { freshImport, stored, go, collectErrors } from './helpers';

test.describe('Patterns', () => {
  test('cards, detail, sub-pattern filter, tabs, reorder, edit, add, mastery session, delete', async ({ page }) => {
    const errors = collectErrors(page);
    await freshImport(page);
    await go(page, 'patterns');
    await expect(page.getByRole('heading', { name: 'Patterns', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /Two Pointers/ }).first()).toBeVisible();
    await page.getByRole('radio', { name: 'Yet to learn' }).click();
    await expect(page.getByRole('button', { name: /Two Pointers/ })).toHaveCount(0);
    await page.getByRole('radio', { name: 'All' }).click();

    // Detail
    await page.getByRole('button', { name: /Two Pointers/ }).first().click();
    await expect(page.getByRole('heading', { name: 'Two Pointers' })).toBeVisible();
    await expect(page.getByText('Completion and weak spots')).toBeVisible();
    await page.getByRole('button', { name: /^Pair Sum · / }).click();
    await expect(page.getByText(/Showing 1–\d+ of \d+/)).toBeVisible();
    await page.getByRole('radio', { name: /Revision history/ }).click();
    await page.getByRole('radio', { name: 'Notes' }).click();
    await page.getByRole('radio', { name: /Problems \(/ }).click();

    // Reorder
    const before = (await stored(page)).patterns['pt-two-pointers'].order;
    await page.getByRole('button', { name: 'Move down' }).click();
    const after = (await stored(page)).patterns['pt-two-pointers'].order;
    expect(after).toBeGreaterThan(before);

    // Edit description
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    await page.getByLabel('Description').fill('Two indices moving toward each other.');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('Two indices moving toward each other.')).toBeVisible();

    // Mastery session starts focus mode
    await page.getByRole('button', { name: 'Mastery session' }).click();
    await expect(page.getByRole('button', { name: 'Exit focus mode' })).toBeVisible();
    await page.getByRole('button', { name: 'Exit focus mode' }).click();
    await page.getByRole('button', { name: 'Leave' }).click();

    // Add and delete a pattern
    await go(page, 'patterns');
    await page.getByRole('button', { name: 'Add pattern' }).click();
    await page.getByLabel('Name').fill('Tries');
    await page.getByRole('button', { name: 'Add pattern' }).last().click();
    await expect(page.getByRole('heading', { name: 'Tries' })).toBeVisible();
    await page.getByRole('button', { name: 'Delete pattern' }).click();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Patterns', exact: true })).toBeVisible();
    expect(Object.values<any>((await stored(page)).patterns).some(p => p.name === 'Tries')).toBe(false);
    expect(errors).toEqual([]);
  });
});
