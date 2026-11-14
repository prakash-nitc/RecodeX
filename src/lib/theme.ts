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
  document.querySelectorAll('meta[name="theme-color"]').forEach(m => m.setAttribute('content', dark ? '#06141B' : '#F6F4FB'));
  window.dispatchEvent(new Event('recodex-theme'));
}

/** True when the Dusk (dark) palette is showing, explicitly or through System. Updates live. */
export function isDusk(): boolean {
  const a = document.documentElement.getAttribute('data-theme');
  if (a === 'dark') return true;
  if (a === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}
export function useDusk(): boolean {
  const [dusk, setDusk] = useState(isDusk);
  useEffect(() => {
    const update = () => setDusk(isDusk());
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener?.('change', update);
    window.addEventListener('recodex-theme', update);
    const mo = new MutationObserver(update);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => { mq.removeEventListener?.('change', update); window.removeEventListener('recodex-theme', update); mo.disconnect(); };
  }, []);
  return dusk;
}
