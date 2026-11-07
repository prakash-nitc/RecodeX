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
const dusk = tokens(css.slice(css.indexOf(':root[data-theme="dark"]'), css.indexOf('@tailwind base')));

const lum = (c: number[]) => {
  const [r, g, b] = c.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: number[], b: number[]) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const mix = (a: number[], b: number[], t: number) => a.map((v, i) => Math.round(v * (1 - t) + b[i] * t));

describe.each([['Dawn', dawn], ['Dusk', dusk]] as const)('%s theme', (_name, t) => {
  it('defines every token', () => {
    for (const k of ['bg', 'surface', 'surface2', 'line', 'fg', 'muted', 'accent', 'accent-ink', 'accentfg', 'ok-ink', 'warn-ink', 'bad-ink', 'hot-ink', 'none-ink']) expect(t[k], k).toBeTruthy();
  });

  it('body and muted text pass AA on background, cards and raised surfaces', () => {
    for (const bg of ['bg', 'surface', 'surface2']) {
      expect(ratio(t.fg, t[bg]), `fg on ${bg}`).toBeGreaterThanOrEqual(4.5);
      expect(ratio(t.muted, t[bg]), `muted on ${bg}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('accent and semantic text pass AA on cards, background and their own 15% tint', () => {
    for (const k of ['accent', 'ok', 'warn', 'bad', 'hot', 'none']) {
      const ink = t[`${k}-ink`], fill = t[k] ?? ink;
      for (const bg of ['surface', 'bg']) expect(ratio(ink, t[bg]), `${k}-ink on ${bg}`).toBeGreaterThanOrEqual(4.5);
      expect(ratio(ink, mix(t.surface, fill, 0.15)), `${k}-ink on ${k}/15`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('button text passes AA on the accent', () => {
    expect(ratio(t.accentfg, t.accent)).toBeGreaterThanOrEqual(4.5);
  });
});
