import { test, expect } from '@playwright/test';
import { freshImport, stored, go, quickRate, collectErrors } from './helpers';

test.describe("Today's Revision and Focus mode", () => {
  test('grouped list, inline rating, undo, focus mode with keyboard, summary', async ({ page }) => {
    const errors = collectErrors(page);
    await freshImport(page);
    await go(page, 'today');
    await expect(page.getByRole('heading', { name: "Today's Revision" })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Overdue · 29/ })).toBeVisible();

    // Inline rating from the grouped list, then undo it from the side panel
    await quickRate(page, 'yellow');
    let data = await stored(page);
    expect(Object.keys(data.revisions).length).toBe(30);
    await page.getByRole('heading', { name: /Done today/ }).waitFor();
    await page.getByRole('list').last().getByRole('button').first().click();
    await page.getByRole('button', { name: 'Undo last' }).click();
    await page.getByRole('button', { name: 'Undo revision' }).click();
    await expect(page.getByText('Revision undone')).toBeVisible();
    await page.keyboard.press('Escape');
    data = await stored(page);
    expect(Object.keys(data.revisions).length).toBe(29);

    // Focus mode: full screen, no sidebar
    await page.getByRole('button', { name: /Start focus mode/ }).click();
    await expect(page.getByRole('button', { name: 'Exit focus mode' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0);
    await expect(page.getByText('Problem 1 of 10')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Pause timer' })).toBeVisible();

    // Keyboard: 1 picks Green, Enter saves
    await page.keyboard.press('1');
    await expect(page.getByRole('button', { name: /^Green/ })).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Enter');
    await expect(page.getByText('Problem 2 of 10')).toBeVisible();

    // More details expose the full form
    await page.getByRole('button', { name: /More details/ }).click();
    await expect(page.getByLabel('Time taken (min)')).toBeVisible();
    await page.getByRole('button', { name: /^Red/ }).click();
    await page.getByLabel('Main mistake or weakness').fill('forgot the base case');
    await page.getByRole('button', { name: /Save & next/ }).click();
    await expect(page.getByText('Problem 3 of 10')).toBeVisible();

    // S skips, P pauses
    await page.keyboard.press('s');
    await expect(page.getByText('Problem 4 of 10')).toBeVisible();
    await page.keyboard.press('p');
    await expect(page.getByRole('button', { name: 'Resume timer' })).toBeVisible();

    // Exit early and see the summary
    await page.getByRole('button', { name: 'Exit focus mode' }).click();
    await page.getByRole('button', { name: 'End and see summary' }).click();
    await expect(page.getByText('Session ended early')).toBeVisible();
    await expect(page.getByRole('heading', { name: /Needs another revision · 1/ })).toBeVisible();

    data = await stored(page);
    expect(Object.keys(data.revisions).length).toBe(31);
    const sess = Object.values<any>(data.sessions)[0];
    expect(sess.status).toBe('abandoned');
    expect(sess.results.map((r: any) => r.outcome)).toEqual(['rated', 'rated', 'skipped']);
    const red = Object.values<any>(data.revisions).find(r => r.mistake === 'forgot the base case');
    expect(red.rating).toBe('red');

    // A completed session reaches the summary on its own
    await go(page, 'today');
    await page.getByRole('button', { name: /Run whole queue/ }).waitFor();
    await go(page, 'practice');
    expect(errors).toEqual([]);
  });
});
