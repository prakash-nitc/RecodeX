import { describe, expect, it, vi, afterEach } from 'vitest';
import { addDays, diffDays, today, ymd, isValidYmd, relDay, weekStartOf, fmtTimestamp } from './dates';

afterEach(() => vi.useRealTimers());

describe('calendar-day helpers (Asia/Kolkata)', () => {
  it('runs in the user time zone', () => {
    expect(new Date('2026-11-07T00:00:00Z').getTimezoneOffset()).toBe(-330); // UTC+5:30
  });

  it('today() uses the local day, not the UTC day', () => {
    // 00:30 IST on 8 Nov is still 7 Nov in UTC.
    vi.useFakeTimers({ now: new Date('2026-11-07T19:00:00.000Z') });
    expect(today()).toBe('2026-11-08');
    // 23:30 IST on 7 Nov.
    vi.setSystemTime(new Date('2026-11-07T18:00:00.000Z'));
    expect(today()).toBe('2026-11-07');
  });

  it('formats timestamps in the local calendar day', () => {
    expect(fmtTimestamp('2026-11-07T20:00:00.000Z', 'd MMM yyyy')).toBe('8 Nov 2026');
  });

  it('addDays and diffDays work on whole calendar days', () => {
    expect(addDays('2026-11-07', 7)).toBe('2026-11-14');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2027-03-01', -1)).toBe('2027-02-28');
    expect(diffDays('2027-01-01', '2026-12-25')).toBe(7);
    expect(diffDays('2026-11-07', '2026-11-07')).toBe(0);
  });

  it('ymd pads month and day', () => expect(ymd(new Date(2026, 0, 5))).toBe('2026-01-05'));

  it('validates YYYY-MM-DD strings', () => {
    expect(isValidYmd('2026-11-07')).toBe(true);
    expect(isValidYmd('2026-13-01')).toBe(false);
    expect(isValidYmd('7/11/2026')).toBe(false);
  });

  it('relDay and weekStartOf', () => {
    expect(relDay('2026-11-08', '2026-11-07')).toBe('Tomorrow');
    expect(relDay('2026-11-04', '2026-11-07')).toBe('3d ago');
    expect(weekStartOf('2026-11-07', 1)).toBe('2026-11-02');
    expect(weekStartOf('2026-11-07', 0)).toBe('2026-11-01');
  });
});
