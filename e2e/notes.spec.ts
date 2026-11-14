import { test, expect } from '@playwright/test';
import { freshImport, stored, go, collectErrors } from './helpers';

const MISTAKE = [
  '**1. Confused the closest sum with the difference from the target**',
  '- Initially stored `target - sum` in the `closest` variable.',
  '- The problem asks us to return the actual sum of the three elements, not the difference.',
  '- **Prevention:** Maintain `bestSum` as the actual triplet sum. Use `Math.abs(target - sum)` only to compare candidates.',
  '',
  '**2. Ignored sums greater than the target**',
  '- Initially checked `closest > 0`, which ignored negative differences when `sum > target`.',
  '- Example: target = 5, sum = 8 gives `target - sum = -3`.',
  '- **Prevention:** Always use `Math.abs(target - sum)` so candidates on both sides of the target are considered.',
  '',
  '**3. Overwrote the closest difference instead of comparing candidates**',
  '- Initially assigned the latest difference directly to `closest`.',
  '- This loses information about the best candidate found earlier.',
  '- **Prevention:** Compare the current candidate\'s absolute difference with the best candidate\'s absolute difference. Update `bestSum` only when the current candidate is closer.',
  '',
  '**4. Did not initialise the answer with a valid triplet sum**',
  '- Initially used `closest = 0` and `res = Integer.MAX_VALUE`, neither of which represented a valid answer.',
  '- **Prevention:** Initialise `bestSum` with the sum of any three valid elements, for example `nums[0] + nums[1] + nums[2]`.',
  '',
  '**5. Initially missed the exact-match case**',
  '- Did not handle `sum == target` separately.',
  '- **Prevention:** Return immediately on an exact match: nothing can be closer.',
].join('\n');
const SHOTS = process.env.NOTES_SHOTS;   // set to a folder to save screenshots while working on the layout

test.describe('Mistakes and notes', () => {
  test('a structured mistake is stored as typed and shown as numbered mistakes with prevention lines', async ({ page }) => {
    const errors = collectErrors(page);
    await freshImport(page);
    await go(page, 'today');

    // Record a revision with a multi-line mistake and a note
    await page.getByRole('button', { name: 'Rate red' }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Main mistake or weakness').fill(MISTAKE);
    await dialog.getByLabel('Additional notes').fill('Sort first.\nInvariant: `left < right`');
    await dialog.getByRole('button', { name: 'Preview' }).first().click();
    await expect(dialog.getByRole('heading', { name: /Ignored sums greater than the target/ })).toBeVisible();
    if (SHOTS) await dialog.screenshot({ path: `${SHOTS}/dialog-preview.png` });
    await dialog.getByRole('button', { name: 'Write' }).click();
    await dialog.getByRole('button', { name: 'Save revision' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // Stored exactly as typed
    let data = await stored(page);
    const rev = Object.values<any>(data.revisions).find(r => r.mistake.startsWith('**1. Confused'));
    expect(rev.mistake).toBe(MISTAKE);
    expect(data.problems[rev.problemId].weakness).toBe(MISTAKE);

    // The done list summarises it by its titles
    await expect(page.getByText(/5 mistakes: Confused the closest sum.* · Ignored sums greater than the target/)).toBeVisible();

    // The problem panel lays it out: five numbered mistakes, prevention callouts, code, and no Markdown marks
    await page.getByText(/5 mistakes: Confused the closest sum/).click();
    const drawer = page.getByRole('dialog');
    await expect(drawer.getByText('Main weakness · 5 mistakes')).toBeVisible();
    await expect(drawer.getByRole('heading', { name: /Did not initialise the answer with a valid triplet sum/ }).first()).toBeVisible();
    await expect(drawer.getByText('Prevention').first()).toBeVisible();
    await expect(drawer.locator('code', { hasText: 'Math.abs(target - sum)' }).first()).toBeVisible();
    await expect(drawer.getByText('**')).toHaveCount(0);
    await expect(drawer.getByText('Invariant:')).toBeVisible();
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/drawer.png` });

    // The copy in the history is folded; "Show all" opens it
    if (SHOTS) {
      await drawer.getByRole('button', { name: 'Show all 5 mistakes' }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SHOTS}/drawer-folded.png` });
    }
    await drawer.getByRole('button', { name: 'Show all 5 mistakes' }).click();
    await expect(drawer.getByRole('button', { name: 'Show less' })).toBeVisible();
    if (SHOTS) {
      await drawer.getByText('Revision history').scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SHOTS}/drawer-history.png` });
      for (const theme of ['obsidian', 'dark', 'cloud']) {
        await page.evaluate(t => { document.documentElement.dataset.theme = t; }, theme);
        await page.screenshot({ path: `${SHOTS}/drawer-history-${theme}.png` });
      }
      await page.evaluate(() => { delete document.documentElement.dataset.theme; });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({ path: `${SHOTS}/drawer-phone.png` });
      await page.setViewportSize({ width: 1440, height: 900 });
    }

    // Reword it later: Enter continues the list, and the weakness follows the new wording
    await drawer.getByRole('button', { name: 'Reword the mistake and notes' }).first().click();
    const editor = drawer.getByLabel('Mistake', { exact: true });
    await editor.fill('- off by one');
    await editor.press('End');
    await editor.press('Enter');
    await editor.pressSequentially('loop ran to n');
    await expect(editor).toHaveValue('- off by one\n- loop ran to n');
    await drawer.getByRole('button', { name: 'Add a prevention line' }).click();
    await editor.pressSequentially('stop at n - 1');
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/drawer-edit.png` });
    await drawer.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('Revision updated')).toBeVisible();
    data = await stored(page);
    const reworded = '- off by one\n- loop ran to n\n- **Prevention:** stop at n - 1';
    expect(data.revisions[rev.id].mistake).toBe(reworded);
    expect(data.problems[rev.problemId].weakness).toBe(reworded);
    expect(data.revisions[rev.id].nextReview).toBe(rev.nextReview);
    expect(errors).toEqual([]);
  });
});
