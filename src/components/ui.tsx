import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { X, Check, AlertTriangle, Info, ExternalLink, Search } from 'lucide-react';
import type { Rating, Priority, Difficulty, Status, Phase } from '../types';

export const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(' ');

// ---------------------------------------------------------------------------------------------
// Buttons & inputs

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
  size?: 'sm' | 'md' | 'lg' | 'icon';
};
export const Button = React.forwardRef<HTMLButtonElement, BtnProps>(function Button({ variant = 'secondary', size = 'md', className, ...rest }, ref) {
  return (
    <button
      ref={ref}
      {...rest}
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-45 disabled:pointer-events-none whitespace-nowrap select-none',
        size === 'sm' && 'h-8 px-2.5 text-[13px]',
        size === 'md' && 'h-9 px-3.5 text-sm',
        size === 'lg' && 'h-11 px-5 text-[15px]',
        size === 'icon' && 'h-8 w-8 text-sm',
        variant === 'primary' && 'bg-accent text-accentfg hover:bg-accent/90 shadow-sm',
        variant === 'secondary' && 'bg-surface2 text-fg hover:bg-line border border-line',
        variant === 'outline' && 'border border-line text-fg hover:bg-surface2',
        variant === 'ghost' && 'text-muted hover:text-fg hover:bg-surface2',
        variant === 'danger' && 'bg-bad text-white hover:bg-bad/90',
        className,
      )}
    />
  );
});

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx('h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm text-fg placeholder:text-muted/70 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent', props.className)} />;
}
export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx('w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-fg placeholder:text-muted/70 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent resize-y min-h-[72px]', props.className)} />;
}
export function Select({ className, children, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...rest} className={cx('h-9 rounded-lg border border-line bg-surface pl-3 pr-8 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent/50 appearance-none bg-no-repeat bg-[right_0.6rem_center] bg-[length:12px] select-caret', className)}>
      {children}
    </select>
  );
}
export function Field({ label, hint, children, htmlFor, className }: { label: string; hint?: React.ReactNode; children: React.ReactNode; htmlFor?: string; className?: string }) {
  return (
    <div className={cx('flex flex-col gap-1.5 min-w-0', className)}>
      <label htmlFor={htmlFor} className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</label>
      {children}
      {hint && <div className="text-xs text-muted">{hint}</div>}
    </div>
  );
}
export function Checkbox({ checked, onChange, label, id, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: React.ReactNode; id?: string; disabled?: boolean }) {
  return (
    <label className={cx('inline-flex items-center gap-2 text-sm select-none', disabled ? 'opacity-50' : 'cursor-pointer')}>
      <input id={id} type="checkbox" disabled={disabled} checked={checked} onChange={e => onChange(e.target.checked)} className="h-4 w-4 rounded border-line accent-[rgb(var(--accent))] cursor-pointer" />
      {label}
    </label>
  );
}
export function Toggle({ checked, onChange, label, id, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; id: string; hint?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <label htmlFor={id} className="min-w-0 cursor-pointer">
        <div className="text-sm font-medium text-fg">{label}</div>
        {hint && <div className="text-xs text-muted mt-0.5">{hint}</div>}
      </label>
      <button id={id} role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        className={cx('relative shrink-0 h-6 w-11 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent', checked ? 'bg-accent' : 'bg-line')}>
        <span className={cx('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-[22px]' : 'translate-x-0.5')} />
      </button>
    </div>
  );
}
export function Segmented<T extends string | number>({ value, options, onChange, size = 'md', ariaLabel }: { value: T; options: { value: T; label: React.ReactNode }[]; onChange: (v: T) => void; size?: 'sm' | 'md'; ariaLabel?: string }) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="inline-flex flex-wrap rounded-lg border border-line bg-surface2 p-0.5 gap-0.5">
      {options.map(o => (
        <button key={String(o.value)} role="radio" aria-checked={o.value === value} onClick={() => onChange(o.value)}
          className={cx('rounded-md font-semibold transition-colors', size === 'sm' ? 'px-2 h-7 text-xs' : 'px-3 h-8 text-[13px]',
            o.value === value ? 'bg-accent text-accentfg shadow-sm' : 'text-muted hover:text-fg')}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
export function SearchInput({ value, onChange, placeholder, id }: { value: string; onChange: (v: string) => void; placeholder?: string; id?: string }) {
  return (
    <div className="relative min-w-0 flex-1">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={15} />
      <Input id={id} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="pl-9" />
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Surfaces

export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...rest} className={cx('rounded-xl border border-line bg-surface shadow-card', className)}>{children}</div>;
}
export function CardHeader({ title, sub, right, icon }: { title: React.ReactNode; sub?: React.ReactNode; right?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3 sm:px-5">
      <div className="flex items-start gap-2.5 min-w-0">
        {icon && <div className="mt-0.5 text-accent shrink-0">{icon}</div>}
        <div className="min-w-0">
          <h2 className="font-display text-[15px] font-bold text-fg leading-tight">{title}</h2>
          {sub && <div className="text-xs text-muted mt-0.5">{sub}</div>}
        </div>
      </div>
      {right && <div className="shrink-0 flex items-center gap-2">{right}</div>}
    </div>
  );
}
export function PageHeader({ title, sub, right }: { title: string; sub?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-fg text-balance">{title}</h1>
        {sub && <p className="text-sm text-muted mt-1">{sub}</p>}
      </div>
      {right && <div className="flex flex-wrap items-center gap-2">{right}</div>}
    </div>
  );
}
export function Empty({ icon, title, body, action }: { icon?: React.ReactNode; title: string; body?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center text-center px-6 py-10 gap-2">
      {icon && <div className="text-muted mb-1">{icon}</div>}
      <div className="font-semibold text-fg">{title}</div>
      {body && <div className="text-sm text-muted max-w-sm">{body}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
export function Spinner({ size = 18 }: { size?: number }) {
  return <span className="inline-block animate-spin rounded-full border-2 border-line border-t-accent" style={{ width: size, height: size }} aria-label="Loading" />;
}

// ---------------------------------------------------------------------------------------------
// Semantic pills

const R_CLS: Record<Rating, string> = { green: 'bg-ok/15 text-ok', yellow: 'bg-warn/15 text-warn', red: 'bg-bad/15 text-bad' };
const R_DOT: Record<Rating, string> = { green: 'bg-ok', yellow: 'bg-warn', red: 'bg-bad' };
export function RatingDot({ r, size = 8 }: { r: Rating | null; size?: number }) {
  return <span className={cx('inline-block rounded-full shrink-0', r ? R_DOT[r] : 'bg-none/60')} style={{ width: size, height: size }} />;
}
export function RatingPill({ r }: { r: Rating | null }) {
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-xs font-semibold', r ? R_CLS[r] : 'bg-none/15 text-muted')}>
      <RatingDot r={r} size={7} />{r ? r[0].toUpperCase() + r.slice(1) : 'Not reviewed'}
    </span>
  );
}
export function DiffPill({ d }: { d: Difficulty }) {
  const c = d === 'Easy' ? 'text-ok border-ok/30' : d === 'Medium' ? 'text-warn border-warn/30' : 'text-bad border-bad/30';
  return <span className={cx('inline-flex rounded-md border px-1.5 py-0.5 text-[11px] font-semibold', c)}>{d}</span>;
}
export function PriorityPill({ p }: { p: Priority }) {
  const c = p === 'High' ? 'bg-hot/15 text-hot' : p === 'Medium' ? 'bg-warn/10 text-warn' : 'bg-surface2 text-muted';
  return <span className={cx('inline-flex rounded-md px-1.5 py-0.5 text-[11px] font-semibold', c)}>{p}</span>;
}
const S_CLS: Record<Status, string> = {
  'Overdue': 'bg-bad/12 text-bad', 'Due Today': 'bg-hot/15 text-hot', 'Scheduled': 'bg-accent/12 text-accent',
  'Mastered': 'bg-ok/15 text-ok', 'Not Reviewed': 'bg-none/15 text-muted', 'Yet to Learn': 'bg-surface2 text-muted border border-dashed border-line',
};
export function StatusPill({ s }: { s: Status }) {
  return <span className={cx('inline-flex rounded-md px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap', S_CLS[s])}>{s}</span>;
}
export function PhasePill({ p }: { p: Phase }) {
  return <span className="inline-flex rounded-md bg-surface2 px-1.5 py-0.5 text-[11px] font-medium text-muted whitespace-nowrap">{p}</span>;
}
export function Tag({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cx('inline-flex items-center rounded-md bg-accent/12 px-1.5 py-0.5 text-[11px] font-semibold text-accent whitespace-nowrap', className)}>{children}</span>;
}
export function LinkButton({ url, label = 'Open', size = 'sm' }: { url: string; label?: string; size?: 'sm' | 'icon' }) {
  if (!url) return null;
  const host = /leetcode/.test(url) ? 'LeetCode' : /geeksforgeeks/.test(url) ? 'GFG' : 'Link';
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
      className={cx('inline-flex items-center justify-center gap-1 rounded-md text-muted hover:text-accent hover:bg-accent/10 transition-colors', size === 'icon' ? 'h-7 w-7' : 'h-7 px-2 text-xs font-semibold')}
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
    <div className="flex w-full overflow-hidden rounded-full bg-surface2" style={{ height }} role="img" aria-label={`${g} green, ${y} yellow, ${r} red${n ? `, ${n} not reviewed` : ''}`}>
      {seg(g, 'bg-ok')}{seg(y, 'bg-warn')}{seg(r, 'bg-bad')}{seg(n, 'bg-none/30')}
    </div>
  );
}
export function Progress({ value, className, tone = 'accent' }: { value: number; className?: string; tone?: 'accent' | 'ok' }) {
  return (
    <div className={cx('h-2 w-full overflow-hidden rounded-full bg-surface2', className)} role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cx('h-full rounded-full transition-[width] duration-500', tone === 'ok' ? 'bg-ok' : 'bg-accent')} style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }} />
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Dialog & drawer

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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-[2px] dlg-pad" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} role="dialog" aria-modal="true" className={cx('w-full max-h-[92%] flex flex-col rounded-t-2xl sm:rounded-2xl border border-line bg-surface shadow-pop', width)}>
        <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3 border-b border-line">
          <div className="min-w-0">
            <h2 className="font-display text-base font-bold text-fg leading-snug">{title}</h2>
            {sub && <div className="text-xs text-muted mt-0.5">{sub}</div>}
          </div>
          <Button data-close variant="ghost" size="icon" onClick={onClose} aria-label="Close"><X size={16} /></Button>
        </div>
        <div className="overflow-y-auto px-5 py-4 min-h-0">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 px-5 py-3 border-t border-line">{footer}</div>}
      </div>
    </div>
  );
}

export function Drawer({ open, onClose, children, title }: { open: boolean; onClose: () => void; children: React.ReactNode; title: string }) {
  useEscape(open, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/45" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <aside role="dialog" aria-modal="true" aria-label={title} className="h-full w-full max-w-xl overflow-y-auto border-l border-line bg-bg shadow-pop drawer-pad">
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
          <div key={t.id} className="pointer-events-auto flex items-center gap-2.5 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm shadow-pop max-w-[min(420px,calc(100vw-32px))]">
            {t.tone === 'ok' ? <Check size={16} className="text-ok shrink-0" /> : t.tone === 'error' ? <AlertTriangle size={16} className="text-bad shrink-0" /> : <Info size={16} className="text-accent shrink-0" />}
            <span className="text-fg">{t.text}</span>
            {t.action && <button className="ml-1 font-semibold text-accent hover:underline" onClick={() => { t.action!.run(); setToasts(x => x.filter(y => y.id !== t.id)); }}>{t.action.label}</button>}
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
  const toneCls = tone === 'bad' ? 'text-bad bg-bad/12' : tone === 'hot' ? 'text-hot bg-hot/12' : tone === 'ok' ? 'text-ok bg-ok/12' : tone === 'warn' ? 'text-warn bg-warn/12' : 'text-accent bg-accent/12';
  const Comp: any = onClick ? 'button' : 'div';
  return (
    <Comp onClick={onClick} className={cx('flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3.5 text-left shadow-card min-w-0', className, onClick && 'hover:border-accent/50 transition-colors')}>
      {icon && <div className={cx('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', toneCls)}>{icon}</div>}
      <div className="min-w-0">
        <div className="text-xs font-medium text-muted truncate">{label}</div>
        <div className="font-display text-2xl font-extrabold text-fg tabular-nums leading-tight">{value}</div>
        {sub && <div className="text-[11px] text-muted truncate">{sub}</div>}
      </div>
    </Comp>
  );
}
