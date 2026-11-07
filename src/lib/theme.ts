import { useEffect, useState } from 'react';

export type ThemeMode = 'system' | 'light' | 'dark';
/** Display names: light is "Dawn", dark is "Dusk". */
export const THEME_LABEL: Record<ThemeMode, string> = { system: 'System', light: 'Dawn', dark: 'Dusk' };

export function applyTheme(mode: ThemeMode) {
  const el = document.documentElement;
  if (mode === 'system') el.removeAttribute('data-theme');
  else el.setAttribute('data-theme', mode);
  try { localStorage.setItem('recodex-theme', mode); } catch { /* ignore */ }
  const dark = mode === 'dark' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelectorAll('meta[name="theme-color"]').forEach(m => m.setAttribute('content', dark ? '#0B1020' : '#F6F4FB'));
  window.dispatchEvent(new Event('recodex-theme'));
}

/** True when the Dusk palette is showing (explicitly or through System). */
export function isDusk(): boolean {
  const a = document.documentElement.getAttribute('data-theme');
  if (a === 'dark') return true;
  if (a === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

const TOKENS = ['bg', 'surface', 'surface2', 'line', 'fg', 'muted', 'accent', 'accent-ink', 'ok', 'warn', 'bad', 'none', 'hot', 'ok-ink', 'warn-ink', 'bad-ink', 'hot-ink'] as const;
export type Palette = Record<(typeof TOKENS)[number], string> & { dusk: boolean };

function read(): Palette {
  const cs = getComputedStyle(document.documentElement);
  const out = { dusk: isDusk() } as Palette;
  for (const t of TOKENS) {
    const v = cs.getPropertyValue(`--${t}`).trim().split(/\s+/).join(',');
    (out as any)[t] = v ? `rgb(${v})` : '#888';
  }
  return out;
}

/** Resolved token colours for SVG and chart attributes; re-reads when the theme changes. */
export function usePalette(): Palette {
  const [p, setP] = useState<Palette>(() => read());
  useEffect(() => {
    const update = () => requestAnimationFrame(() => setP(read()));
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener?.('change', update);
    window.addEventListener('recodex-theme', update);
    const mo = new MutationObserver(update);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => { mq.removeEventListener?.('change', update); window.removeEventListener('recodex-theme', update); mo.disconnect(); };
  }, []);
  return p;
}

/** Shared Recharts styling so every chart reads as one system. */
export function chartTheme(pal: Palette) {
  return {
    grid: { stroke: pal.line, strokeDasharray: '3 4', vertical: false },
    axis: { tick: { fill: pal.muted, fontSize: 11 }, axisLine: false, tickLine: false },
    tooltip: {
      contentStyle: { background: pal.surface, border: `1px solid ${pal.line}`, borderRadius: 12, color: pal.fg, fontSize: 12, boxShadow: '0 12px 28px -12px rgba(0,0,0,.25)' },
      labelStyle: { color: pal.muted, fontWeight: 600, marginBottom: 2 },
      itemStyle: { color: pal.fg },
      cursor: { fill: pal.surface2 },
    },
  };
}
