// RecodeX design system: core components. Colours follow the spec's meanings:
// green = Green rating / mastered, gold = Yellow, red = Red (failed recall), grey = not reviewed,
// sunrise orange = overdue / high priority / needs attention, accent = actions, links, selection, focus.
// Colours come only from the tokens in src/index.css (Dawn and Dusk).
import React, { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react';
import { X, Check, AlertTriangle, Info, ExternalLink, Search } from 'lucide-react';
import type { Rating, Priority, Difficulty, Status, Phase } from '../types';

export const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(' ');

// ---------------------------------------------------------------------------------------------
// Buttons & inputs

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'icon';
};
export const Button = React.forwardRef<HTMLButtonElement, BtnProps>(function Button({ variant = 'secondary', size = 'md', className, ...rest }, ref) {
  return (
    <button
      ref={ref}
      {...rest}
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-xl font-semibold transition-[background-color,border-color,color,box-shadow,transform] duration-150 active:scale-[.98] disabled:opacity-45 disabled:pointer-events-none whitespace-nowrap select-none',
        size === 'sm' && 'h-8 px-3 text-[13px]',
        size === 'md' && 'h-9 px-3.5 text-sm',
        size === 'lg' && 'h-11 px-5 text-[15px]',
        size === 'xl' && 'h-14 px-7 text-base rounded-2xl',
        size === 'icon' && 'h-8 w-8 text-sm',
        variant === 'primary' && 'bg-accent text-accentfg shadow-[0_6px_16px_-6px_rgb(var(--accent)/var(--glow)),inset_0_0_0_1px_rgb(var(--btn-ring)/var(--btn-ring-a))] hover:bg-accent/90 hover:shadow-[0_8px_20px_-6px_rgb(var(--accent)/var(--glow)),0_0_0_1px_rgb(var(--interactive)/var(--edge)),inset_0_0_0_1px_rgb(var(--btn-ring)/var(--btn-ring-a))]',
        variant === 'secondary' && 'bg-btn2 text-btn2fg hover:bg-line/70 border border-line',
        variant === 'outline' && 'border border-line bg-surface text-fg hover:border-interactive/50 hover:bg-hover',
        variant === 'ghost' && 'text-muted hover:text-fg hover:bg-hover',
        variant === 'danger' && 'bg-bad text-white hover:bg-bad/90',
        className,
      )}
    />
  );
});

const field = 'w-full rounded-xl border border-line bg-surface text-sm text-fg placeholder:text-muted/70 transition-colors hover:border-muted/40 focus:outline-none focus:ring-2 focus:ring-focus/40 focus:border-focus disabled:opacity-50';
export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx('h-10 px-3', field, props.className)} />;
}
export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx('px-3 py-2 resize-y min-h-[72px]', field, props.className)} />;
}
export function Select({ className, children, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...rest} className={cx(field, '!w-auto max-w-full h-10 pl-3 pr-8 appearance-none bg-no-repeat bg-[right_0.7rem_center] bg-[length:12px] select-caret', className)}>
      {children}
    </select>
  );
}
export function Field({ label, hint, children, htmlFor, className }: { label: string; hint?: React.ReactNode; children: React.ReactNode; htmlFor?: string; className?: string }) {
  return (
    <div className={cx('flex flex-col gap-1.5 min-w-0', className)}>
      <label htmlFor={htmlFor} className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">{label}</label>
      {children}
      {hint && <div className="text-xs text-muted leading-relaxed">{hint}</div>}
    </div>
  );
}
export function Checkbox({ checked, onChange, label, id, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: React.ReactNode; id?: string; disabled?: boolean }) {
  return (
    <label className={cx('inline-flex items-center gap-2 text-sm select-none', disabled ? 'opacity-50' : 'cursor-pointer')}>
      <input id={id} type="checkbox" disabled={disabled} checked={checked} onChange={e => onChange(e.target.checked)} className="h-4 w-4 rounded border-line accent-[rgb(var(--interactive))] cursor-pointer" />
      {label}
    </label>
  );
}
export function Toggle({ checked, onChange, label, id, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; id: string; hint?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <label htmlFor={id} className="min-w-0 cursor-pointer">
        <div className="text-sm font-semibold text-fg">{label}</div>
        {hint && <div className="text-xs text-muted mt-0.5 leading-relaxed">{hint}</div>}
      </label>
      <button id={id} role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        className={cx('relative shrink-0 h-6 w-11 rounded-full transition-colors', checked ? 'bg-interactive' : 'bg-muted/35')}>
        <span className={cx('absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-[22px]' : 'translate-x-0.5')} />
      </button>
    </div>
  );
}
export function Segmented<T extends string | number>({ value, options, onChange, size = 'md', ariaLabel }: { value: T; options: { value: T; label: React.ReactNode }[]; onChange: (v: T) => void; size?: 'sm' | 'md'; ariaLabel?: string }) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="inline-flex flex-wrap rounded-xl border border-line bg-surface2 p-0.5 gap-0.5">
      {options.map(o => (
        <button key={String(o.value)} role="radio" aria-checked={o.value === value} onClick={() => onChange(o.value)}
          className={cx('rounded-[10px] font-semibold transition-colors', size === 'sm' ? 'px-2.5 h-7 text-xs' : 'px-3 h-8 text-[13px]',
            o.value === value ? 'bg-accent text-accentfg shadow-sm ring-1 ring-inset ring-[rgb(var(--btn-ring)/var(--btn-ring-a))]' : 'text-muted hover:text-fg hover:bg-surface')}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
export function SearchInput({ value, onChange, placeholder, id }: { value: string; onChange: (v: string) => void; placeholder?: string; id?: string }) {
  return (
    <div className="relative min-w-0 flex-1 basis-full sm:basis-0">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" size={15} />
      <Input id={id} type="search" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} className="pl-9" />
    </div>
  );
}
/** Selectable chip (pattern filters, phase filters). Selection uses the accent. */
export function Chip({ on, onClick, children, className }: { on: boolean; onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button onClick={onClick} aria-pressed={on}
      className={cx('rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors', on ? 'border-interactive bg-accent/12 text-selected' : 'border-line text-muted hover:text-fg hover:border-muted/50', className)}>
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------------------------
// Surfaces

/** A card. `elevated` lifts featured cards onto the elevated surface (white in Cloud; the same as a card in Dawn and Dusk). */
export function Card({ className, children, elevated, ...rest }: React.HTMLAttributes<HTMLDivElement> & { elevated?: boolean }) {
  return <div {...rest} className={cx('rounded-2xl border border-line shadow-card', elevated ? 'bg-elevated' : 'bg-surface', className)}>{children}</div>;
}
export function CardHeader({ title, sub, right, icon }: { title: React.ReactNode; sub?: React.ReactNode; right?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3 sm:px-5">
      <div className="flex items-start gap-2.5 min-w-0">
        {icon && <div className="mt-0.5 text-icon shrink-0">{icon}</div>}
        <div className="min-w-0">
          <h2 className="font-display text-[17px] font-semibold text-fg leading-tight">{title}</h2>
          {sub && <div className="text-xs text-muted mt-1">{sub}</div>}
        </div>
      </div>
      {right && <div className="shrink-0 flex items-center gap-2">{right}</div>}
    </div>
  );
}
export function PageHeader({ title, sub, right, eyebrow }: { title: string; sub?: React.ReactNode; right?: React.ReactNode; eyebrow?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-muted">{eyebrow}</div>}
        <h1 className="font-display text-[28px] sm:text-3xl font-semibold tracking-tight text-fg text-balance leading-tight">{title}</h1>
        {sub && <p className="text-sm text-muted mt-1.5 max-w-2xl">{sub}</p>}
      </div>
      {right && <div className="flex flex-wrap items-center gap-2">{right}</div>}
    </div>
  );
}
export function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h2 className={cx('text-[11px] font-bold uppercase tracking-[0.12em] text-muted mb-2.5', className)}>{children}</h2>;
}
export function Empty({ icon, title, body, action, art }: { icon?: React.ReactNode; title: string; body?: React.ReactNode; action?: React.ReactNode; art?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center text-center px-6 py-10 gap-2">
      {art && <div className="mb-2 w-full max-w-[280px] overflow-hidden rounded-2xl">{art}</div>}
      {icon && !art && <div className="text-muted mb-1">{icon}</div>}
      <div className="font-display text-lg font-semibold text-fg">{title}</div>
      {body && <div className="text-sm text-muted max-w-sm leading-relaxed">{body}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
export function Spinner({ size = 18 }: { size?: number }) {
  return <span className="inline-block animate-spin rounded-full border-2 border-line border-t-interactive" style={{ width: size, height: size }} aria-label="Loading" role="status" />;
}

// ---------------------------------------------------------------------------------------------
// Semantic pills

const R_CLS: Record<Rating, string> = { green: 'bg-ok/15 text-ok-ink', yellow: 'bg-warn/20 text-warn-ink', red: 'bg-bad/12 text-bad-ink' };
const R_DOT: Record<Rating, string> = { green: 'bg-ok', yellow: 'bg-warn', red: 'bg-bad' };
export function RatingDot({ r, size = 8 }: { r: Rating | null; size?: number }) {
  return <span className={cx('inline-block rounded-full shrink-0', r ? R_DOT[r] : 'bg-idle/60')} style={{ width: size, height: size }} />;
}
export function RatingPill({ r }: { r: Rating | null }) {
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-xs font-semibold whitespace-nowrap', r ? R_CLS[r] : 'bg-idle/15 text-idle-ink')}>
      <RatingDot r={r} size={7} />{r ? r[0].toUpperCase() + r.slice(1) : 'Not reviewed'}
    </span>
  );
}
/** Difficulty is not a colour meaning, so it is shown in neutral tones with a 1–3 bar glyph. */
export function DiffPill({ d }: { d: Difficulty }) {
  const n = d === 'Easy' ? 1 : d === 'Medium' ? 2 : 3;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-line px-1.5 py-0.5 text-[11px] font-semibold text-muted whitespace-nowrap" title={`Difficulty: ${d}`}>
      <span className="inline-flex items-end gap-[2px]" aria-hidden>
        {[1, 2, 3].map(i => <span key={i} className={cx('w-[3px] rounded-sm', i <= n ? 'bg-muted' : 'bg-line')} style={{ height: 4 + i * 2 }} />)}
      </span>{d}
    </span>
  );
}
export function PriorityPill({ p }: { p: Priority }) {
  const c = p === 'High' ? 'bg-hot/15 text-hot-ink' : p === 'Medium' ? 'bg-surface2 text-fg/80' : 'bg-surface2 text-muted';
  return <span className={cx('inline-flex rounded-lg px-1.5 py-0.5 text-[11px] font-semibold', c)}>{p}</span>;
}
const S_CLS: Record<Status, string> = {
  'Overdue': 'bg-hot/20 text-hot-ink font-bold', 'Due Today': 'border border-hot/45 text-hot-ink', 'Scheduled': 'bg-surface2 text-muted',
  'Mastered': 'bg-ok/15 text-ok-ink', 'Not Reviewed': 'bg-idle/15 text-idle-ink', 'Yet to Learn': 'text-muted border border-dashed border-line',
};
export function StatusPill({ s }: { s: Status }) {
  return <span className={cx('inline-flex rounded-lg px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap', S_CLS[s])}>{s}</span>;
}
export function PhasePill({ p }: { p: Phase }) {
  return <span className="inline-flex rounded-lg bg-surface2 px-1.5 py-0.5 text-[11px] font-medium text-muted whitespace-nowrap">{p}</span>;
}
/** Neutral tag (pattern names). */
export function Tag({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cx('inline-flex items-center rounded-lg bg-surface2 px-1.5 py-0.5 text-[11px] font-semibold text-fg/75 whitespace-nowrap', className)}>{children}</span>;
}
export function LinkButton({ url, label = 'Open', size = 'sm' }: { url: string; label?: string; size?: 'sm' | 'icon' }) {
  if (!url) return null;
  const host = /leetcode/.test(url) ? 'LeetCode' : /geeksforgeeks/.test(url) ? 'GFG' : 'Link';
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
      className={cx('inline-flex items-center justify-center gap-1 rounded-lg text-muted hover:text-accent-ink hover:bg-accent/10 transition-colors', size === 'icon' ? 'h-7 w-7' : 'h-7 px-2 text-xs font-semibold')}
      title={`Open on ${host}`} aria-label={`Open on ${host}`}>
      <ExternalLink size={13} />{size === 'sm' && <span>{label === 'Open' ? host : label}</span>}
    </a>
  );
}

export function GYRBar({ g, y, r, n = 0, height = 8 }: { g: number; y: number; r: number; n?: number; height?: number }) {
  const total = g + y + r + n;
  if (!total) return <div className="w-full rounded-full bg-surface2" style={{ height }} />;
  const seg = (v: number, c: string) => v > 0 && <div className={c} style={{ width: `${(v / total) * 100}%` }} />;
  return (
    <div className="flex w-full gap-[2px] overflow-hidden rounded-full bg-surface2" style={{ height }} role="img" aria-label={`${g} green, ${y} yellow, ${r} red${n ? `, ${n} not reviewed` : ''}`}>
      {seg(g, 'bg-ok')}{seg(y, 'bg-warn')}{seg(r, 'bg-bad')}{seg(n, 'bg-idle/30')}
    </div>
  );
}
export function Progress({ value, className, tone = 'accent' }: { value: number; className?: string; tone?: 'accent' | 'ok' }) {
  return (
    <div className={cx('h-2 w-full overflow-hidden rounded-full bg-surface2', className)} role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cx('h-full rounded-full transition-[width] duration-500 ease-out', tone === 'ok' ? 'bg-ok' : 'bg-interactive')} style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }} />
    </div>
  );
}

/** Progress ring. `mastery` uses the --ring-a/b gradient (reserved for lifetime mastery). */
export function Ring({ value, size = 120, stroke = 10, tone = 'accent', children, label }: { value: number; size?: number; stroke?: number; tone?: 'accent' | 'ok' | 'mastery'; children?: React.ReactNode; label?: string }) {
  const id = useId().replace(/:/g, '');
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const v = Math.min(1, Math.max(0, value));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={label ?? `${Math.round(v * 100)}%`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <defs>
          <linearGradient id={`ring-${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="rgb(var(--ring-a))" /><stop offset="100%" stopColor="rgb(var(--ring-b))" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(var(--surface2))" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round"
          stroke={tone === 'mastery' ? `url(#ring-${id})` : tone === 'ok' ? 'rgb(var(--ok))' : 'rgb(var(--interactive))'}
          strokeDasharray={c} strokeDashoffset={c * (1 - v)} style={{ transition: 'stroke-dashoffset 700ms cubic-bezier(.2,.8,.2,1)' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

/** The streak flame, drawn with the sunrise gradient. */
export function Flame({ size = 28, dim = false }: { size?: number; dim?: boolean }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden className={dim ? 'opacity-40 grayscale' : ''}>
      <defs><linearGradient id={`fl-${id}`} x1="0" y1="1" x2="0" y2="0"><stop offset="0%" stopColor="rgb(var(--sun-a))" /><stop offset="100%" stopColor="rgb(var(--sun-b))" /></linearGradient></defs>
      <path fill={`url(#fl-${id})`} d="M12 2c.6 3.2-1.1 5-2.6 6.7C8 10.3 7 11.8 7 14a5 5 0 0 0 10 0c0-1.7-.7-3-1.5-4 .1 1.4-.5 2.6-1.6 3 .5-3.2-.6-6.9-1.9-11Z" />
      <path fill="rgb(var(--surface) / .55)" d="M12 21a2.6 2.6 0 0 1-2.6-2.6c0-1.6 1.3-2.6 2.1-4 .5 1.4 3.1 2.2 3.1 4A2.6 2.6 0 0 1 12 21Z" />
    </svg>
  );
}

// ---------------------------------------------------------------------------------------------
// Dialog & side panel

function useEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
}

export function Dialog({ open, onClose, title, sub, children, footer, width = 'max-w-lg' }: { open: boolean; onClose: () => void; title: React.ReactNode; sub?: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode; width?: string }) {
  useEscape(open, onClose);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (open) setTimeout(() => ref.current?.querySelector<HTMLElement>('[data-autofocus], input, textarea, select, button:not([data-close])')?.focus(), 30); }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-backdrop/50 backdrop-blur-[3px] dlg-pad" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} role="dialog" aria-modal="true" className={cx('w-full max-h-[92%] flex flex-col rounded-t-3xl sm:rounded-3xl border border-line bg-elevated shadow-pop animate-rise', width)}>
        <div className="flex items-start justify-between gap-3 px-5 sm:px-6 pt-5 pb-3">
          <div className="min-w-0">
            <h2 className="font-display text-xl font-semibold text-fg leading-snug">{title}</h2>
            {sub && <div className="text-xs text-muted mt-1">{sub}</div>}
          </div>
          <Button data-close variant="ghost" size="icon" onClick={onClose} aria-label="Close"><X size={16} /></Button>
        </div>
        <div className="overflow-y-auto px-5 sm:px-6 pb-4 pt-1 min-h-0">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 px-5 sm:px-6 py-3.5 border-t border-line bg-surface2/50 rounded-b-3xl">{footer}</div>}
      </div>
    </div>
  );
}

export function Drawer({ open, onClose, children, title }: { open: boolean; onClose: () => void; children: React.ReactNode; title: string }) {
  useEscape(open, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-backdrop/40 backdrop-blur-[2px]" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <aside role="dialog" aria-modal="true" aria-label={title} className="h-full w-full max-w-xl overflow-y-auto border-l border-line bg-bg shadow-pop drawer-pad animate-page-in sm:rounded-l-3xl">
        {children}
      </aside>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Confirm + toast providers

type ConfirmOpts = { title: string; body?: React.ReactNode; confirmLabel?: string; danger?: boolean };
type ToastT = { id: number; text: string; tone: 'ok' | 'error' | 'info'; action?: { label: string; run: () => void } };
const Ctx = createContext<{ confirm: (o: ConfirmOpts) => Promise<boolean>; toast: (text: string, tone?: ToastT['tone'], action?: ToastT['action']) => void } | null>(null);

export function UiProvider({ children }: { children: React.ReactNode }) {
  const [c, setC] = useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null);
  const [toasts, setToasts] = useState<ToastT[]>([]);
  const confirm = useCallback((o: ConfirmOpts) => new Promise<boolean>(resolve => setC({ ...o, resolve })), []);
  const toast = useCallback((text: string, tone: ToastT['tone'] = 'ok', action?: ToastT['action']) => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t.slice(-3), { id, text, tone, action }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), action ? 7000 : 3800);
  }, []);
  const close = (v: boolean) => { c?.resolve(v); setC(null); };
  return (
    <Ctx.Provider value={{ confirm, toast }}>
      {children}
      <Dialog open={!!c} onClose={() => close(false)} title={c?.title ?? ''} width="max-w-md"
        footer={<>
          <Button variant="ghost" onClick={() => close(false)}>Cancel</Button>
          <Button data-autofocus variant={c?.danger ? 'danger' : 'primary'} onClick={() => close(true)}>{c?.confirmLabel ?? 'Confirm'}</Button>
        </>}>
        <div className="text-sm text-muted leading-relaxed">{c?.body}</div>
      </Dialog>
      <div className="fixed z-[60] bottom-0 right-0 flex flex-col gap-2 items-end toast-pad pointer-events-none" aria-live="polite">
        {toasts.map(t => (
          <div key={t.id} className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-line bg-elevated px-4 py-3 text-sm shadow-pop max-w-[min(440px,calc(100vw-32px))] animate-pop-in">
            <span className={cx('flex h-6 w-6 shrink-0 items-center justify-center rounded-full', t.tone === 'ok' ? 'bg-ok/15 text-ok-ink' : t.tone === 'error' ? 'bg-bad/12 text-bad-ink' : 'bg-accent/12 text-accent-ink')}>
              {t.tone === 'ok' ? <Check size={14} strokeWidth={3} /> : t.tone === 'error' ? <AlertTriangle size={13} /> : <Info size={13} />}
            </span>
            <span className="text-fg">{t.text}</span>
            {t.action && <button className="ml-1 font-semibold text-accent-ink hover:underline" onClick={() => { t.action!.run(); setToasts(x => x.filter(y => y.id !== t.id)); }}>{t.action.label}</button>}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
export function useUi() {
  const c = useContext(Ctx); if (!c) throw new Error('UiProvider missing'); return c;
}

export function Stat({ label, value, icon, tone, sub, onClick, className }: { className?: string; label: string; value: React.ReactNode; icon?: React.ReactNode; tone?: 'bad' | 'hot' | 'ok' | 'accent' | 'warn'; sub?: React.ReactNode; onClick?: () => void }) {
  const toneCls = tone === 'bad' ? 'text-bad-ink bg-bad/12' : tone === 'hot' ? 'text-hot-ink bg-hot/15' : tone === 'ok' ? 'text-ok-ink bg-ok/15' : tone === 'warn' ? 'text-warn-ink bg-warn/20' : 'text-muted bg-surface2';
  const Comp: any = onClick ? 'button' : 'div';
  return (
    <Comp onClick={onClick} className={cx('flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3.5 text-left shadow-card min-w-0', className, onClick && 'hover:border-interactive/40 hover:shadow-lift transition-[border-color,box-shadow]')}>
      {icon && <div className={cx('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', toneCls)}>{icon}</div>}
      <div className="min-w-0">
        <div className="text-xs font-medium text-muted truncate">{label}</div>
        <div className="font-display text-[26px] font-semibold text-fg tabular-nums leading-tight">{value}</div>
        {sub && <div className="text-[11px] text-muted truncate">{sub}</div>}
      </div>
    </Comp>
  );
}
