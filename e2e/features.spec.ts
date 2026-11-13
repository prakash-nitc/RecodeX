import { test, expect } from '@playwright/test';
import { freshImport, stored, go, quickRate, collectErrors } from './helpers';

test.describe('Focus reasons, week in review, focus-mode notes, history export', () => {
  test('explains the queue, reviews the week, edits notes in focus mode and exports history', async ({ page }) => {
    const errors = collectErrors(page);
    await freshImport(page);

    // Every focus row says which rule put it there
    await expect(page.getByText(/ on \d+ \w{3} · \d+-day interval · due /).first()).toBeVisible();

    // Rating something shows up in the week in review
    await expect(page.getByRole('heading', { name: 'Week in review' })).toBeVisible();
    await quickRate(page, 'green');
    await expect(page.getByText(/^(Improved|Mastered|Slipped) · [1-9]/).first()).toBeVisible();

    // Notes can be written from focus mode and are saved on the problem
    await go(page, 'today');
    await page.getByRole('button', { name: /Start focus mode/ }).click();
    const name = (await page.getByRole('heading', { level: 1 }).textContent())!.trim();
    const add = page.getByRole('button', { name: /Add notes for this problem|Show last weakness and notes/ });
    await add.click();
    const edit = page.getByRole('button', { name: /Edit notes|Add notes$/ });
    if (await edit.isVisible()) await edit.click();
    await page.getByLabel('Problem notes').fill('Sort first, then two pointers from both ends.');
    await page.getByRole('button', { name: 'Save notes' }).click();
    await expect(page.getByText('Sort first, then two pointers from both ends.')).toBeVisible();
    const data = await stored(page);
    expect(Object.values<any>(data.problems).find(p => p.name === name).notes).toBe('Sort first, then two pointers from both ends.');
    await page.getByRole('button', { name: 'Exit focus mode' }).click();
    await page.getByRole('button', { name: 'Leave' }).click();

    // Revision history exports as its own CSV
    await go(page, 'bank');
    await page.getByRole('button', { name: 'Export CSV' }).click();
    await page.getByRole('radio', { name: /Revision history/ }).click();
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Save CSV file' }).click()]);
    expect(dl.suggestedFilename()).toMatch(/^recodex-revision-history-\d{4}-\d{2}-\d{2}\.csv$/);
    const csv = await (await dl.createReadStream()).toArray().then(c => Buffer.concat(c).toString('utf8'));
    expect(csv.split('\n')[0]).toBe('date,time,problem_id,problem,pattern,rating,phase,time_min,independent,mistake,notes,source,next_review,session_id');
    expect(csv.trim().split('\n')).toHaveLength(1 + 30); // 29 imported + 1 rated above
    expect(errors).toEqual([]);
  });
});
