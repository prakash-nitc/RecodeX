import { test, expect } from '@playwright/test';
import { freshImport, stored, go, collectErrors } from './helpers';

test.describe('Mixed Practice', () => {
  test('presets, options, generate, reroll, remove, run to summary, recent sessions', async ({ page }) => {
    const errors = collectErrors(page);
    await freshImport(page);
    await go(page, 'practice');
    await expect(page.getByRole('heading', { name: 'Mixed Practice' })).toBeVisible();

    // Every preset is selectable
    for (const name of ['Daily Mixed Revision', 'Weakness Challenge', 'Overdue Recovery']) {
      await page.getByRole('button', { name: new RegExp(name) }).click();
      await expect(page.getByRole('button', { name: new RegExp(name) })).toHaveAttribute('aria-pressed', 'true');
    }
    await expect(page.getByRole('button', { name: /Interview Simulation|Random Recall|Pattern Mastery/ })).toHaveCount(0);

    // A custom session: start from a fresh page so no preset is selected
    await go(page, 'dashboard');
    await go(page, 'practice');
    await page.getByRole('radio', { name: '5', exact: true }).first().click();
    await page.getByRole('radio', { name: 'Easy+Med' }).click();
    await page.getByLabel('Selection strategy').selectOption('weakest');
    await page.getByRole('checkbox', { name: 'Never-reviewed problems' }).check();
    await page.getByRole('button', { name: 'Two Pointers', exact: true }).click();
    await page.getByRole('button', { name: 'Sliding Window', exact: true }).click();
    await page.getByRole('button', { name: 'Reconstruction', exact: true }).click();
    await page.getByRole('button', { name: /Generate session/ }).click();
    await expect(page.getByText(/5 problems from 2 patterns/)).toBeVisible();
    await page.getByRole('button', { name: 'Reroll' }).click();
    await page.getByRole('button', { name: 'Remove from session' }).first().click();
    await expect(page.getByText(/4 problems from/)).toBeVisible();

    // Run it to the end
    await page.getByRole('button', { name: /Enter the arena · 4/ }).click();
    for (let i = 0; i < 4; i++) {
      await expect(page.getByText(`Problem ${i + 1} of 4`)).toBeVisible();
      await page.keyboard.press(i % 2 ? '2' : '1');
      await page.keyboard.press('Enter');
    }
    await expect(page.getByText('Session complete')).toBeVisible();
    const data = await stored(page);
    const sess = Object.values<any>(data.sessions)[0];
    expect(sess.status).toBe('completed');
    expect(sess.kind).toBe('custom');
    expect(sess.results).toHaveLength(4);

    // Recent sessions
    await go(page, 'practice');
    await page.getByRole('radio', { name: /Recent sessions \(1\)/ }).click();
    await expect(page.getByRole('cell', { name: 'Custom Mixed Practice' })).toBeVisible();
    expect(errors).toEqual([]);
  });
});
