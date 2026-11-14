// Checks WCAG AA contrast of the design tokens in src/index.css for both themes.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const css = readFileSync(fileURLToPath(new URL('../index.css', import.meta.url)), 'utf8');

function tokens(block: string): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  for (const m of block.matchAll(/--([a-z0-9-]+):\s*(\d+)\s+(\d+)\s+(\d+)/g)) out[m[1]] = [+m[2], +m[3], +m[4]];
  return out;
}
const dawn = tokens(css.slice(css.indexOf(':root {'), css.indexOf('@media (prefers-color-scheme: dark)')));
const dusk = tokens(css.slice(css.indexOf(':root[data-theme="dark"]'), css.indexOf(':root[data-theme="cloud"]')));
const cloud = tokens(css.slice(css.indexOf(':root[data-theme="cloud"]'), css.indexOf('@tailwind base')));
// The same Dusk values, as applied for "System" on a dark device.
const duskSystem = tokens(css.slice(css.indexOf('@media (prefers-color-scheme: dark)'), css.indexOf(':root[data-theme="dark"]')));

const lum = (c: number[]) => {
  const [r, g, b] = c.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: number[], b: number[]) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const mix = (a: number[], b: number[], t: number) => a.map((v, i) => Math.round(v * (1 - t) + b[i] * t));

describe.each([['Dawn', dawn], ['Dusk', dusk], ['Cloud', cloud]] as const)('%s theme', (_name, t) => {
  it('defines every token', () => {
    for (const k of ['bg', 'sidebar', 'surface', 'surface2', 'elevated', 'hover', 'line', 'fg', 'muted', 'icon', 'onart', 'onart-shadow',
      'btn2', 'btn2fg', 'accent', 'accent-ink', 'accentfg',
      'interactive', 'selected', 'ok-ink', 'warn-ink', 'bad-ink', 'hot-ink', 'none-ink', 'scrim', 'backdrop',
      'headline-a', 'headline-b', 'ring-a', 'ring-b']) expect(t[k], k).toBeTruthy();
  });

  it('body and muted text pass AA on background, sidebar, cards, raised surfaces and hovered items', () => {
    for (const bg of ['bg', 'sidebar', 'surface', 'surface2', 'elevated', 'hover']) {
      expect(ratio(t.fg, t[bg]), `fg on ${bg}`).toBeGreaterThanOrEqual(4.5);
      expect(ratio(t.muted, t[bg]), `muted on ${bg}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('links pass AA wherever they sit: page, sidebar, cards, and a hovered row (hover/60 over a card)', () => {
    for (const bg of ['bg', 'sidebar', 'surface']) expect(ratio(t['accent-ink'], t[bg]), `accent-ink on ${bg}`).toBeGreaterThanOrEqual(4.5);
    expect(ratio(t['accent-ink'], mix(t.surface, t.hover, 0.6)), 'accent-ink on a hovered row').toBeGreaterThanOrEqual(4.5);
  });

  it('selected labels pass AA on the accent tint; status text passes AA on cards, page and its own 15% tint', () => {
    expect(ratio(t.selected, mix(t.surface, t.accent, 0.15)), 'selected on accent/15').toBeGreaterThanOrEqual(4.5);
    expect(ratio(t.selected, mix(t.sidebar, t.accent, 0.15)), 'selected on accent/15 in the sidebar').toBeGreaterThanOrEqual(4.5);
    for (const k of ['ok', 'warn', 'bad', 'hot', 'none']) {
      const ink = t[`${k}-ink`], fill = t[k] ?? ink;
      for (const bg of ['surface', 'bg']) expect(ratio(ink, t[bg]), `${k}-ink on ${bg}`).toBeGreaterThanOrEqual(4.5);
      expect(ratio(ink, mix(t.surface, fill, 0.15)), `${k}-ink on ${k}/15`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('button text passes AA on primary and secondary buttons', () => {
    expect(ratio(t.accentfg, t.accent), 'primary').toBeGreaterThanOrEqual(4.5);
    expect(ratio(t.btn2fg, t.btn2), 'secondary').toBeGreaterThanOrEqual(4.5);
  });

  it('interactive marks, icons and the headline highlight are visible (3:1 for graphics and large text)', () => {
    for (const bg of ['surface', 'sidebar', 'bg']) expect(ratio(t.interactive, t[bg]), `interactive on ${bg}`).toBeGreaterThanOrEqual(3);
    expect(ratio(t.icon, t.surface), 'icon on surface').toBeGreaterThanOrEqual(3);
    expect(ratio(t['headline-a'], t.scrim), 'headline highlight on the scrim').toBeGreaterThanOrEqual(3);
    expect(ratio(t.onart, t.scrim), 'text over artwork on the scrim').toBeGreaterThanOrEqual(4.5);
  });
});

describe('Dusk', () => {
  it('has identical values for System-dark and the explicit Dusk choice', () => {
    expect(duskSystem).toEqual(dusk);
  });
});
