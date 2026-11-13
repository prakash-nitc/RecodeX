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
