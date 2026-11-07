// Local-timezone calendar-day helpers. All stored dates are 'YYYY-MM-DD' in the user's local time.
import { format, parseISO, differenceInCalendarDays, addDays as dfAddDays, startOfWeek } from 'date-fns';

export const pad = (n: number) => String(n).padStart(2, '0');
export function ymd(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function today(): string { return ymd(new Date()); }
export function toDate(s: string): Date { return parseISO(s); } // parseISO of a date-only string = local midnight
export function addDays(s: string, n: number): string { return ymd(dfAddDays(toDate(s), n)); }
export function diffDays(a: string, b: string): number { return differenceInCalendarDays(toDate(a), toDate(b)); }
export function fmt(s: string | null | undefined, f = 'd MMM yyyy'): string {
  if (!s) return '—';
  try { return format(toDate(s), f); } catch { return s; }
}
export function weekStartOf(s: string, weekStart: 0 | 1): string {
  return ymd(startOfWeek(toDate(s), { weekStartsOn: weekStart }));
}
export function weekday(s: string, f = 'EEE'): string { return format(toDate(s), f); }
export function relDay(s: string | null, ref = today()): string {
  if (!s) return '—';
  const d = diffDays(s, ref);
  if (d === 0) return 'Today';
  if (d === 1) return 'Tomorrow';
  if (d === -1) return 'Yesterday';
  if (d < 0) return `${-d}d ago`;
  return `in ${d}d`;
}
export function nowIso(): string { return new Date().toISOString(); }
export function isValidYmd(s: string): boolean { return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(toDate(s).getTime()); }
