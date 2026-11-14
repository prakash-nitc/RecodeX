import { useEffect, useState } from 'react';

// Themes are CSS-variable blocks in src/index.css selected by <html data-theme="…">; this file is the
// registry the Settings picker shows. Stored values are the ids below, so renaming a theme here never
// affects anyone's saved choice. The early script in index.html applies the saved id before React loads.
export type ThemeMode = 'system' | 'light' | 'dark' | 'cloud' | 'obsidian';
/** The palette on screen right now (System resolves to dawn or dusk). */
export type Palette = 'dawn' | 'dusk' | 'cloud' | 'obsidian';

/** Swatches for the picker's preview tile: page, sidebar, card, primary button, indicator, text, muted text, border. */
export interface ThemePreview { bg: string; sidebar: string; card: string; button: string; mark: string; fg: string; muted: string; line: string }
export interface ThemeInfo { id: ThemeMode; name: string; blurb: string; preview: ThemePreview | null }

const DAWN: ThemePreview = { bg: '#F6F4FB', sidebar: '#FFFFFF', card: '#FFFFFF', button: '#6A4BD1', mark: '#6A4BD1', fg: '#1A1D3A', muted: '#636887', line: '#E6E2F0' };
const STEEL: ThemePreview = { bg: '#06141B', sidebar: '#11212D', card: '#253745', button: '#4A5C6A', mark: '#60A5FA', fg: '#CCD0CF', muted: '#9BA8AB', line: '#354956' };
export const THEMES: ThemeInfo[] = [
  { id: 'system', name: 'System', blurb: 'Follows your device: Dawn or Midnight Steel', preview: null },
  { id: 'light', name: 'Dawn', blurb: 'Light · lavender and purple', preview: DAWN },
  { id: 'cloud', name: 'Cloud & Slate', blurb: 'Light · cool greys and steel', preview: { bg: '#E1E5EA', sidebar: '#CCD3DD', card: '#F7F8FA', button: '#6B737C', mark: '#4F6E8D', fg: '#202833', muted: '#4E5661', line: '#D0D6DE' } },
  { id: 'dark', name: 'Midnight Steel', blurb: 'Dark · navy, steel and silver', preview: STEEL },
  { id: 'obsidian', name: 'Obsidian Graphite', blurb: 'Dark · charcoal and warm grey', preview: { bg: '#040204', sidebar: '#1A1A18', card: '#242421', button: '#3A3A35', mark: '#8C8C7C', fg: '#F0EFEB', muted: '#A5A49D', line: '#30302D' } },
];
export const SYSTEM_PREVIEWS: [ThemePreview, ThemePreview] = [DAWN, STEEL];
export const THEME_LABEL = Object.fromEntries(THEMES.map(t => [t.id, t.name])) as Record<ThemeMode, string>;

/** Browser/phone status-bar colour per palette (the page background). */
const BAR: Record<Palette, string> = { dawn: '#F6F4FB', dusk: '#06141B', cloud: '#E1E5EA', obsidian: '#040204' };

export function applyTheme(mode: ThemeMode) {
  const el = document.documentElement;
  if (mode === 'system') el.removeAttribute('data-theme');
  else el.setAttribute('data-theme', mode);
  try { localStorage.setItem('recodex-theme', mode); } catch { /* ignore */ }
  document.querySelectorAll('meta[name="theme-color"]').forEach(m => m.setAttribute('content', BAR[currentPalette()]));
  window.dispatchEvent(new Event('recodex-theme'));
}

export function currentPalette(): Palette {
  const a = document.documentElement.getAttribute('data-theme');
  if (a === 'cloud') return 'cloud';
  if (a === 'obsidian') return 'obsidian';
  if (a === 'dark') return 'dusk';
  if (a === 'light') return 'dawn';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dusk' : 'dawn';
}
/** True when the Midnight Steel (dark) palette is showing, explicitly or through System. */
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
