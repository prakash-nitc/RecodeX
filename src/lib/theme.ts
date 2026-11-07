import { useEffect, useState } from 'react';

const hostTheme = typeof document !== 'undefined' ? document.documentElement.getAttribute('data-theme') : null;

export function applyTheme(mode: 'system' | 'light' | 'dark') {
  const el = document.documentElement;
  if (mode === 'system') { if (hostTheme) el.setAttribute('data-theme', hostTheme); else el.removeAttribute('data-theme'); }
  else el.setAttribute('data-theme', mode);
  window.dispatchEvent(new Event('dsa-theme'));
}

const TOKENS = ['bg', 'surface', 'surface2', 'line', 'fg', 'muted', 'accent', 'ok', 'warn', 'bad', 'none', 'hot'] as const;
export type Palette = Record<(typeof TOKENS)[number], string>;

function read(): Palette {
  const cs = getComputedStyle(document.documentElement);
  const out = {} as Palette;
  for (const t of TOKENS) {
    const v = cs.getPropertyValue(`--${t}`).trim().split(/\s+/).join(',');
    out[t] = v ? `rgb(${v})` : '#888';
  }
  return out;
}

/** Resolved token colors for SVG chart attributes; re-reads when the theme changes. */
export function usePalette(): Palette {
  const [p, setP] = useState<Palette>(() => read());
  useEffect(() => {
    const update = () => requestAnimationFrame(() => setP(read()));
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener?.('change', update);
    window.addEventListener('dsa-theme', update);
    const mo = new MutationObserver(update);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => { mq.removeEventListener?.('change', update); window.removeEventListener('dsa-theme', update); mo.disconnect(); };
  }, []);
  return p;
}
