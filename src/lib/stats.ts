import type { Problem, Revision, Pattern, Settings, Rating, Session } from '../types';
import { addDays, diffDays, today, weekStartOf, toDate, ymd } from './dates';
import { statusOf, RATING_SCORE } from './engine';
import { startOfMonth } from 'date-fns';

export function revisionsByDay(revs: Revision[]): Map<string, Revision[]> {
  const m = new Map<string, Revision[]>();
  for (const r of revs) { const a = m.get(r.date) ?? []; a.push(r); m.set(r.date, a); }
  return m;
}

export function streaks(revs: Revision[], t = today()) {
  const days = new Set(revs.map(r => r.date));
  let current = 0;
  let d = days.has(t) ? t : addDays(t, -1);
  while (days.has(d)) { current++; d = addDays(d, -1); }
  const sorted = [...days].sort();
  let longest = 0, run = 0, prev: string | null = null;
  for (const x of sorted) { run = prev && diffDays(x, prev) === 1 ? run + 1 : 1; longest = Math.max(longest, run); prev = x; }
  return { current, longest, activeDays: days.size };
}

export function countRatings(revs: Revision[]) {
  const c = { green: 0, yellow: 0, red: 0 } as Record<Rating, number>;
  for (const r of revs) c[r.rating]++;
  return c;
}

export function weekDays(t: string, weekStart: 0 | 1): string[] {
  const s = weekStartOf(t, weekStart);
  return Array.from({ length: 7 }, (_, i) => addDays(s, i));
}

export interface PatternStat {
  pattern: Pattern; total: number; reviewed: number; notReviewed: number; overdue: number; backlog: number;
  g: number; y: number; r: number; completion: number; avg: number | null; lastPracticed: string | null;
  revCount: number; redRevs: number; redPct: number; mastered: number;
}

export function patternStats(patterns: Pattern[], problems: Problem[], revs: Revision[], s: Settings, t = today()): PatternStat[] {
  const byPattern = new Map<string, Problem[]>();
  for (const p of problems) { const a = byPattern.get(p.patternId) ?? []; a.push(p); byPattern.set(p.patternId, a); }
  const probPattern = new Map(problems.map(p => [p.id, p.patternId]));
  const revBy = new Map<string, Revision[]>();
  for (const r of revs) { const pid = probPattern.get(r.problemId); if (!pid) continue; const a = revBy.get(pid) ?? []; a.push(r); revBy.set(pid, a); }
  return patterns.map(pattern => {
    const ps = byPattern.get(pattern.id) ?? [];
    const rs = revBy.get(pattern.id) ?? [];
    const reviewed = ps.filter(p => p.lastRating);
    const st = ps.map(p => statusOf(p, s, t));
    const score = reviewed.reduce((a, p) => a + RATING_SCORE[p.lastRating!], 0);
    const last = reviewed.reduce<string | null>((a, p) => (!a || (p.lastRevised ?? '') > a ? p.lastRevised : a), null);
    const redRevs = rs.filter(r => r.rating === 'red').length;
    return {
      pattern, total: ps.length, reviewed: reviewed.length, notReviewed: ps.length - reviewed.length,
      overdue: st.filter(x => x === 'Overdue').length, backlog: st.filter(x => x === 'Yet to Learn').length,
      g: reviewed.filter(p => p.lastRating === 'green').length, y: reviewed.filter(p => p.lastRating === 'yellow').length, r: reviewed.filter(p => p.lastRating === 'red').length,
      completion: ps.length ? reviewed.length / ps.length : 0,
      avg: reviewed.length ? score / reviewed.length : null,
      lastPracticed: last, revCount: rs.length, redRevs, redPct: rs.length ? redRevs / rs.length : 0,
      mastered: st.filter(x => x === 'Mastered').length,
    };
  });
}

/** Rating sequences per problem, oldest first. */
export function sequences(revs: Revision[]): Map<string, Revision[]> {
  const m = new Map<string, Revision[]>();
  for (const r of revs) { const a = m.get(r.problemId) ?? []; a.push(r); m.set(r.problemId, a); }
  for (const a of m.values()) a.sort((x, y) => (x.at < y.at ? -1 : 1));
  return m;
}

export function effectiveness(revs: Revision[]) {
  const seqs = sequences(revs);
  const repeatedRed: string[] = [], redToYellow: string[] = [], yellowToGreen: string[] = [], regressed: string[] = [];
  for (const [pid, a] of seqs) {
    if (a.filter(r => r.rating === 'red').length >= 2) repeatedRed.push(pid);
    let ry = false, yg = false, rg = false;
    for (let i = 1; i < a.length; i++) {
      const p = a[i - 1].rating, c = a[i].rating;
      if (p === 'red' && c === 'yellow') ry = true;
      if (p === 'yellow' && c === 'green') yg = true;
      if (p === 'green' && c !== 'green') rg = true;
    }
    if (ry) redToYellow.push(pid); if (yg) yellowToGreen.push(pid); if (rg) regressed.push(pid);
  }
  return { repeatedRed, redToYellow, yellowToGreen, regressed };
}

/** Weekly buckets ending at t. */
export function weeklySeries(revs: Revision[], weeks: number, weekStart: 0 | 1, t = today()) {
  const end = weekStartOf(t, weekStart);
  const starts = Array.from({ length: weeks }, (_, i) => addDays(end, -7 * (weeks - 1 - i)));
  return starts.map(ws => {
    const we = addDays(ws, 6);
    const inWeek = revs.filter(r => r.date >= ws && r.date <= we);
    const c = countRatings(inWeek);
    const total = inWeek.length;
    return { week: ws, total, ...c, greenPct: total ? Math.round((c.green / total) * 100) : null };
  });
}

export function monthlySeries(revs: Revision[], months: number, t = today()) {
  const out: { month: string; total: number }[] = [];
  let m = startOfMonth(toDate(t));
  const list: Date[] = [];
  for (let i = 0; i < months; i++) { list.unshift(m); m = new Date(m.getFullYear(), m.getMonth() - 1, 1); }
  for (const d of list) {
    const key = ymd(d).slice(0, 7);
    out.push({ month: key, total: revs.filter(r => r.date.startsWith(key)).length });
  }
  return out;
}

export function completedSessions(sessions: Session[]) { return sessions.filter(s => s.status === 'completed'); }

/** Lifetime mastery: an active problem whose green streak has reached the mastery streak, whether or not it is due. */
export function isMastered(p: Problem, s: Settings): boolean {
  return p.track === 'active' && !!p.lastRating && p.consecutiveGreen >= s.masteryStreak;
}

export interface Camp { id: string; name: string; total: number; mastered: number; pct: number; r: number; y: number; overdue: number; reviewed: number }

/** One camp per pattern, in pattern order, for the journey roadmap. */
export function journeyCamps(patterns: Pattern[], problems: Problem[], s: Settings, t = today()): Camp[] {
  const by = new Map<string, Problem[]>();
  for (const p of problems) { const a = by.get(p.patternId) ?? []; a.push(p); by.set(p.patternId, a); }
  return patterns.slice().sort((a, b) => a.order - b.order).map(pt => {
    const ps = by.get(pt.id) ?? [];
    const mastered = ps.filter(p => isMastered(p, s)).length;
    return {
      id: pt.id, name: pt.name, total: ps.length, mastered, pct: ps.length ? mastered / ps.length : 0,
      r: ps.filter(p => p.lastRating === 'red').length, y: ps.filter(p => p.lastRating === 'yellow').length,
      overdue: ps.filter(p => statusOf(p, s, t) === 'Overdue').length, reviewed: ps.filter(p => p.lastRating).length,
    };
  });
}

export interface WeekDigest {
  improved: string[];   // a revision this week rated better than the one before it (Red→Yellow/Green, Yellow→Green)
  slipped: string[];    // a revision this week rated worse than the one before it
  mastered: string[];   // reached the mastery streak with a Green this week
  nearMastery: string[]; // one more Green to mastery, due within the next 7 days, soonest first
  toughest: { patternId: string; red: number } | null; // the pattern with the most Reds this week
}

/** What changed this week (from the week's first day up to t): problem ids, newest change first. */
export function weekDigest(revs: Revision[], problems: Record<string, Problem>, s: Settings, weekStart: 0 | 1, t = today()): WeekDigest {
  const from = weekStartOf(t, weekStart);
  const inWeek = (r: Revision) => r.date >= from && r.date <= t;
  const improved = new Map<string, string>(), slipped = new Map<string, string>(), mastered = new Map<string, string>();
  for (const [pid, seq] of sequences(revs)) {
    if (!problems[pid]) continue;
    let streak = 0;
    seq.forEach((r, i) => {
      streak = r.rating === 'green' ? streak + 1 : r.rating === 'red' || s.yellowResetsStreak ? 0 : streak;
      if (!inWeek(r)) return;
      const prev = seq[i - 1]?.rating;
      if (prev && RATING_SCORE[r.rating] > RATING_SCORE[prev]) improved.set(pid, r.at);
      if (prev && RATING_SCORE[r.rating] < RATING_SCORE[prev]) slipped.set(pid, r.at);
      // The import revision stands for an unknown history, so trust its snapshot over counting.
      const before = r.prev?.consecutiveGreen ?? streak - 1;
      if (r.rating === 'green' && before + 1 === s.masteryStreak) mastered.set(pid, r.at);
    });
  }
  const newest = (m: Map<string, string>) => [...m].sort((a, b) => (a[1] < b[1] ? 1 : -1)).map(([id]) => id);
  const horizon = addDays(t, 7);
  const nearMastery = Object.values(problems)
    .filter(p => p.track === 'active' && p.lastRating === 'green' && p.consecutiveGreen === s.masteryStreak - 1 && p.nextReview && p.nextReview <= horizon)
    .sort((a, b) => (a.nextReview! < b.nextReview! ? -1 : a.nextReview! > b.nextReview! ? 1 : a.num - b.num))
    .map(p => p.id);
  const reds = new Map<string, number>();
  for (const r of revs) if (inWeek(r) && r.rating === 'red' && problems[r.problemId]) {
    const pt = problems[r.problemId].patternId; reds.set(pt, (reds.get(pt) ?? 0) + 1);
  }
  const top = [...reds].sort((a, b) => b[1] - a[1])[0];
  return { improved: newest(improved), slipped: newest(slipped), mastered: newest(mastered), nearMastery, toughest: top ? { patternId: top[0], red: top[1] } : null };
}
