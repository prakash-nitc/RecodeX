import { useEffect, useState } from 'react';

export type ThemeMode = 'system' | 'light' | 'dark' | 'cloud';
/** Display names: light is "Dawn", dark is "Dusk", cloud is "Cloud". */
export const THEME_LABEL: Record<ThemeMode, string> = { system: 'System', light: 'Dawn', dark: 'Dusk', cloud: 'Cloud' };
/** Browser/phone status-bar colour per palette (the page background). */
const BAR: Record<Palette, string> = { dawn: '#F6F4FB', dusk: '#06141B', cloud: '#E1E5EA' };

export function applyTheme(mode: ThemeMode) {
  const el = document.documentElement;
  if (mode === 'system') el.removeAttribute('data-theme');
  else el.setAttribute('data-theme', mode);
  try { localStorage.setItem('recodex-theme', mode); } catch { /* ignore */ }
  document.querySelectorAll('meta[name="theme-color"]').forEach(m => m.setAttribute('content', BAR[currentPalette()]));
  window.dispatchEvent(new Event('recodex-theme'));
}

/** The palette on screen right now: an explicit choice, or System resolved through the device setting. */
export type Palette = 'dawn' | 'dusk' | 'cloud';
export function currentPalette(): Palette {
  const a = document.documentElement.getAttribute('data-theme');
  if (a === 'cloud') return 'cloud';
  if (a === 'dark') return 'dusk';
  if (a === 'light') return 'dawn';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dusk' : 'dawn';
}
/** True when the Dusk (dark) palette is showing, explicitly or through System. */
export function isDusk(): boolean { return currentPalette() === 'dusk'; }

/** The current palette; updates live when the theme or the device setting changes. */
export function usePalette(): Palette {
  const [p, setP] = useState(currentPalette);
  useEffect(() => {
    const update = () => setP(currentPalette());
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener?.('change', update);
    window.addEventListener('recodex-theme', update);
    const mo = new MutationObserver(update);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => { mq.removeEventListener?.('change', update); window.removeEventListener('recodex-theme', update); mo.disconnect(); };
  }, []);
  return p;
}
export function useDusk(): boolean { return usePalette() === 'dusk'; }
