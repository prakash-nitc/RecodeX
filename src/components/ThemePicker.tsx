// Theme picker: one card per theme with a miniature of its interface, the active one checked.
// Selecting applies the theme immediately (applyTheme) and saves it with the other settings.
import React from 'react';
import { Check } from 'lucide-react';
import { THEMES, SYSTEM_PREVIEWS, type ThemeMode, type ThemePreview } from '../lib/theme';
import { cx } from './ui';

/** A tiny app: sidebar with an active item, a card with text lines and a primary button. */
function Mini({ p, className, style }: { p: ThemePreview; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={cx('flex h-full w-full', className)} style={{ background: p.bg, ...style }}>
      <div className="flex w-[26%] flex-col gap-1 px-1 py-1.5" style={{ background: p.sidebar, borderRight: `1px solid ${p.line}` }}>
        <span className="h-1 w-3/4 rounded-full" style={{ background: p.fg, opacity: 0.85 }} />
        <span className="relative mt-0.5 h-1.5 rounded-sm" style={{ background: p.line }}>
          <span className="absolute inset-y-0 left-0 w-[2px] rounded-full" style={{ background: p.mark }} />
        </span>
        <span className="h-1 w-2/3 rounded-full" style={{ background: p.muted, opacity: 0.6 }} />
        <span className="h-1 w-1/2 rounded-full" style={{ background: p.muted, opacity: 0.6 }} />
      </div>
      <div className="flex-1 p-1.5">
        <div className="flex h-full flex-col justify-between rounded-[5px] p-1.5" style={{ background: p.card, border: `1px solid ${p.line}` }}>
          <div className="flex flex-col gap-1">
            <span className="h-1.5 w-4/5 rounded-full" style={{ background: p.fg }} />
            <span className="h-1 w-3/5 rounded-full" style={{ background: p.muted }} />
          </div>
          <div className="flex items-center gap-1">
            <span className="h-2.5 w-8 rounded-[3px]" style={{ background: p.button }} />
            <span className="h-1 flex-1 rounded-full" style={{ background: p.line }}>
              <span className="block h-full w-1/2 rounded-full" style={{ background: p.mark }} />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ThemePicker({ value, onChange }: { value: ThemeMode; onChange: (v: ThemeMode) => void }) {
  return (
    <div role="radiogroup" aria-label="Theme" className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-5">
      {THEMES.map(t => {
        const on = t.id === value;
        return (
          <button key={t.id} type="button" role="radio" aria-checked={on} aria-label={t.name} title={t.blurb} onClick={() => onChange(t.id)}
            className={cx('group flex flex-col overflow-hidden rounded-xl border text-left transition-[border-color,box-shadow]',
              on ? 'border-interactive ring-2 ring-interactive/30' : 'border-line hover:border-muted/50')}>
            <div className="relative h-16 w-full overflow-hidden" aria-hidden>
              {t.preview ? <Mini p={t.preview} /> : (
                <>
                  <Mini p={SYSTEM_PREVIEWS[0]} className="absolute inset-0" style={{ clipPath: 'polygon(0 0, 100% 0, 0 100%)' }} />
                  <Mini p={SYSTEM_PREVIEWS[1]} className="absolute inset-0" style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 100%)' }} />
                </>
              )}
              {on && <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-interactive text-bg shadow"><Check size={11} strokeWidth={3} /></span>}
            </div>
            <div className="border-t border-line bg-surface px-2.5 py-2">
              <div className={cx('text-[13px] font-semibold leading-tight', on ? 'text-fg' : 'text-fg/85')}>{t.name}</div>
              <div className="mt-0.5 text-[11px] leading-snug text-muted">{t.blurb}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
