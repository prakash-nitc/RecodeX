// Revision engine: status, spaced repetition, phase suggestion, Today's Focus and session generation.
import type {
  Problem, Rating, Phase, Settings, Status, Revision, SessionConfig, Pattern, Priority, ProblemSnapshot, Preset,
} from '../types';
import { addDays, diffDays, today, nowIso } from './dates';

export const RATING_SCORE: Record<Rating, number> = { green: 3, yellow: 2, red: 1 };
export const PRIORITY_RANK: Record<Priority, number> = { High: 0, Medium: 1, Low: 2 };
export const RATING_LABEL: Record<Rating, string> = { green: 'Green', yellow: 'Yellow', red: 'Red' };
export const RATING_MEANING: Record<Rating, string> = {
  green: 'Solved independently, understood the approach, can explain time and space complexity.',
  yellow: 'Partially solved: needed hints, struggled with implementation, or could not fully recall the approach.',
  red: 'Could not reconstruct the solution, or forgot the underlying pattern.',
};
export const PHASE_HINT: Record<Phase, string> = {
  'Reconstruction': 'Rebuild the solution from scratch without looking at old code or notes.',
  'Recall/Repair': 'Recall the approach and repair the implementation mistakes.',
  'Quick Recall': 'Quickly reproduce the approach, complexity and key edge cases.',
};

export function statusOf(p: Problem, s: Settings, t = today()): Status {
  if (p.track === 'backlog') return 'Yet to Learn';
  if (!p.lastRating || !p.nextReview) return 'Not Reviewed';
  const d = diffDays(p.nextReview, t);
  if (d < 0) return 'Overdue';
  if (d === 0) return 'Due Today';
  if (p.consecutiveGreen >= s.masteryStreak) return 'Mastered';
  return 'Scheduled';
}

export function overdueDays(p: Problem, t = today()): number {
  if (!p.nextReview || p.track !== 'active' || !p.lastRating) return 0;
  return Math.max(0, diffDays(t, p.nextReview));
}

/** The sheet's "Revision Type" column, derived from the last rating. */
export function revisionTypeOf(r: Rating | null): string {
  if (r === 'red') return 'Repair';
  if (r === 'yellow') return 'Recall/Repair';
  if (r === 'green') return 'Quick Recall';
  return 'First Attempt';
}

export function intervalFor(rating: Rating, streakAfter: number, s: Settings): number {
  if (rating === 'red') return Math.max(1, s.redDays);
  if (rating === 'yellow') return Math.max(1, s.yellowDays);
  const ladder = s.greenLadder.length ? s.greenLadder : [7];
  return Math.max(1, ladder[Math.min(Math.max(streakAfter, 1) - 1, ladder.length - 1)]);
}

export function streakAfter(prev: number, rating: Rating, s: Settings): number {
  if (rating === 'green') return prev + 1;
  if (rating === 'red') return 0;
  return s.yellowResetsStreak ? 0 : prev;
}

export function suggestPhase(rating: Rating | null, streak: number, prevRating: Rating | null): Phase {
  if (!rating || rating === 'red') return 'Reconstruction';
  if (rating === 'yellow') return 'Recall/Repair';
  if (streak >= 2) return 'Quick Recall';
  return prevRating === 'red' ? 'Recall/Repair' : 'Quick Recall';
}

export function priorityFor(rating: Rating): Priority {
  return rating === 'red' ? 'High' : rating === 'yellow' ? 'Medium' : 'Low';
}

export function snapshotOf(p: Problem): ProblemSnapshot {
  return {
    lastRating: p.lastRating, lastRevised: p.lastRevised, nextReview: p.nextReview,
    consecutiveGreen: p.consecutiveGreen, revisionCount: p.revisionCount, phase: p.phase, phaseManual: p.phaseManual,
    priority: p.priority, weakness: p.weakness, track: p.track, learnedAt: p.learnedAt,
  };
}

export interface RevisionInput {
  rating: Rating;
  timeMin: number | null;
  independent: boolean | null;
  mistake: string;
  notes: string;
  phaseUsed: Phase;
  nextPhase?: Phase | null;     // manual override for the next revision
  nextOverride?: string | null; // manual next review date
  date?: string;
  source: Revision['source'];
  sessionId?: string | null;
}

export function previewNext(p: Problem, rating: Rating, s: Settings, date = today()) {
  const streak = streakAfter(p.consecutiveGreen, rating, s);
  const days = intervalFor(rating, streak, s);
  return { streak, days, next: addDays(date, days), phase: suggestPhase(rating, streak, p.lastRating) };
}

export function applyRevision(p: Problem, input: RevisionInput, s: Settings, id: string): { problem: Problem; revision: Revision } {
  const date = input.date ?? today();
  const pv = previewNext(p, input.rating, s, date);
  const next = input.nextOverride || pv.next;
  // An explicit next phase always wins. Picking the suggested one means "auto" and unpins the phase;
  // without a choice, a pinned phase stays and an unpinned one follows the suggestion.
  const phase = input.nextPhase ?? (p.phaseManual ? p.phase : pv.phase);
  const phaseManual = input.nextPhase ? input.nextPhase !== pv.phase : p.phaseManual;
  const revision: Revision = {
    id, problemId: p.id, date, at: nowIso(), rating: input.rating, phase: input.phaseUsed,
    timeMin: input.timeMin, independent: input.independent, mistake: input.mistake.trim(), notes: input.notes.trim(),
    sessionId: input.sessionId ?? null, source: input.source, nextReview: next, prev: snapshotOf(p),
  };
  const problem: Problem = {
    ...p,
    lastRating: input.rating,
    lastRevised: date,
    nextReview: next,
    consecutiveGreen: pv.streak,
    revisionCount: p.revisionCount + 1,
    phase,
    phaseManual,
    priority: s.autoPriority ? priorityFor(input.rating) : p.priority,
    weakness: input.mistake.trim() ? input.mistake.trim() : p.weakness,
    track: 'active',
    updatedAt: nowIso(),
  };
  return { problem, revision };
}

// ---------------------------------------------------------------------------------------------
// Today's Focus

export type FocusReason = 'Overdue' | 'Due today' | 'High priority' | 'Weak' | 'New';
export interface FocusItem { problem: Problem; reason: FocusReason; overdue: number; }

export function buildFocus(problems: Problem[], patterns: Record<string, Pattern>, s: Settings, t = today()) {
  const active = problems.filter(p => p.track === 'active' && patterns[p.patternId]);
  const revisedToday = (p: Problem) => p.lastRevised === t;
  const seen = new Set<string>();
  const out: FocusItem[] = [];
  const push = (p: Problem, reason: FocusReason) => {
    if (seen.has(p.id)) return; seen.add(p.id); out.push({ problem: p, reason, overdue: overdueDays(p, t) });
  };
  const byPri = (a: Problem, b: Problem) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
  const ratingWeak = (p: Problem) => (p.lastRating ? RATING_SCORE[p.lastRating] : 2);

  active.filter(p => p.lastRating && p.nextReview && p.nextReview < t)
    .sort((a, b) => (a.nextReview! < b.nextReview! ? -1 : a.nextReview! > b.nextReview! ? 1 : 0) || byPri(a, b) || ratingWeak(a) - ratingWeak(b))
    .forEach(p => push(p, 'Overdue'));
  active.filter(p => p.lastRating && p.nextReview === t).sort(byPri).forEach(p => push(p, 'Due today'));
  if (s.focusIncludeHigh)
    active.filter(p => p.priority === 'High' && !revisedToday(p) && p.lastRating).sort((a, b) => ratingWeak(a) - ratingWeak(b)).forEach(p => push(p, 'High priority'));
  if (s.focusIncludeWeak)
    active.filter(p => (p.lastRating === 'red' || p.lastRating === 'yellow') && !revisedToday(p))
      .sort((a, b) => ratingWeak(a) - ratingWeak(b) || ((a.nextReview ?? '') < (b.nextReview ?? '') ? -1 : 1))
      .forEach(p => push(p, 'Weak'));
  if (s.focusNewPerDay > 0) {
    const plan = new Set(s.studyPlanPatternIds);
    const fresh = active.filter(p => !p.lastRating && (plan.size === 0 || plan.has(p.patternId)))
      .sort((a, b) => (patterns[a.patternId].order - patterns[b.patternId].order) || a.num - b.num);
    fresh.slice(0, s.focusNewPerDay).forEach(p => push(p, 'New'));
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Mixed practice generation

export const PRESETS: Record<Exclude<Preset, 'custom' | 'today'>, { title: string; blurb: string; config: Partial<SessionConfig> }> = {
  daily: { title: 'Daily Mixed Revision', blurb: 'Due and overdue problems, mixed across patterns', config: { strategy: 'balanced', onlyDue: true, includeNew: false, includeSolved: true, patternCount: 0, difficulty: 'all' } },
  weakness: { title: 'Weakness Challenge', blurb: 'Red and Yellow problems first', config: { strategy: 'weakest', onlyWeak: true, includeNew: false, includeSolved: true, patternCount: 0, difficulty: 'all', ignoreSchedule: true } },
  interview: { title: 'Interview Simulation', blurb: 'Easy and Medium from several patterns', config: { strategy: 'random', difficulty: 'easy-medium', includeNew: true, includeSolved: true, patternCount: 0, count: 5, ignoreSchedule: true } },
  random: { title: 'Random Recall', blurb: 'Previously studied, ignoring due dates', config: { strategy: 'random', includeNew: false, includeSolved: true, patternCount: 0, difficulty: 'all', ignoreSchedule: true } },
  overdue: { title: 'Overdue Recovery', blurb: 'Every overdue problem, most overdue first', config: { strategy: 'overdue', onlyOverdue: true, includeNew: false, includeSolved: true, patternCount: 0, difficulty: 'all', count: 20 } },
  mastery: { title: 'Pattern Mastery', blurb: 'A full session from one pattern', config: { strategy: 'weakest', includeNew: true, includeSolved: true, patternCount: 1, difficulty: 'all', ignoreSchedule: true } },
};

export function baseConfig(s: Settings): SessionConfig {
  return {
    preset: 'custom', count: s.defaultSessionSize, difficulty: s.defaultDifficulty, patternCount: 3, strategy: 'balanced',
    includeSolved: true, includeNew: false, excludeRecentDays: 0, patternIds: [], phases: [],
    onlyDue: false, onlyOverdue: false, onlyWeak: false, ignoreSchedule: false,
  };
}

function shuffle<T>(a: T[], rnd = Math.random): T[] {
  const x = a.slice();
  for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; }
  return x;
}

export function candidatePool(problems: Problem[], c: SessionConfig, t = today()): Problem[] {
  return problems.filter(p => {
    if (p.track !== 'active') return false;
    if (c.patternIds.length && !c.patternIds.includes(p.patternId)) return false;
    if (c.phases.length && !c.phases.includes(p.phase)) return false;
    if (c.difficulty === 'easy-medium' ? p.difficulty === 'Hard' : c.difficulty !== 'all' && p.difficulty !== c.difficulty) return false;
    const reviewed = !!p.lastRating;
    if (reviewed && !c.includeSolved) return false;
    if (!reviewed && !c.includeNew) return false;
    if (c.excludeRecentDays > 0 && p.lastRevised && diffDays(t, p.lastRevised) < c.excludeRecentDays) return false;
    if (c.onlyOverdue && !(reviewed && p.nextReview && p.nextReview < t)) return false;
    if (c.onlyDue && !(reviewed && p.nextReview && p.nextReview <= t)) return false;
    if (c.onlyWeak && !(p.lastRating === 'red' || p.lastRating === 'yellow')) return false;
    return true;
  });
}

function scoreOf(p: Problem, c: SessionConfig, t: string): number {
  const od = overdueDays(p, t);
  const weak = p.lastRating ? (4 - RATING_SCORE[p.lastRating]) : 1.5; // red 3, yellow 2, green 1, new 1.5
  const pri = 2 - PRIORITY_RANK[p.priority];
  const jitter = Math.random();
  switch (c.strategy) {
    case 'random': return jitter;
    case 'weakest': return weak * 10 + pri * 2 + Math.min(od, 30) * 0.1 + jitter;
    case 'overdue': return od * 10 + weak + jitter * 0.5;
    default: return weak * 4 + Math.min(od, 30) * 0.4 + pri * 1.5 + jitter * 3; // balanced
  }
}

/** Picks patterns, then round-robins between them so consecutive problems come from different patterns. */
export function generateSession(problems: Problem[], c: SessionConfig, t = today()): { ids: string[]; poolSize: number; patternsUsed: number } {
  const pool = candidatePool(problems, c, t);
  const scored = new Map(pool.map(p => [p.id, scoreOf(p, c, t)]));
  const groups = new Map<string, Problem[]>();
  for (const p of pool) { const g = groups.get(p.patternId) ?? []; g.push(p); groups.set(p.patternId, g); }
  for (const g of groups.values()) g.sort((a, b) => scored.get(b.id)! - scored.get(a.id)!);
  let order = [...groups.keys()];
  order = c.strategy === 'random'
    ? shuffle(order)
    : order.sort((a, b) => scored.get(groups.get(b)![0].id)! - scored.get(groups.get(a)![0].id)!);
  if (c.patternCount > 0) order = order.slice(0, c.patternCount);
  const ids: string[] = [];
  const cursors = new Map(order.map(k => [k, 0]));
  let progressed = true;
  while (ids.length < c.count && progressed) {
    progressed = false;
    for (const k of order) {
      if (ids.length >= c.count) break;
      const i = cursors.get(k)!; const g = groups.get(k)!;
      if (i < g.length) { ids.push(g[i].id); cursors.set(k, i + 1); progressed = true; }
    }
  }
  return { ids, poolSize: pool.length, patternsUsed: new Set(ids.map(id => pool.find(p => p.id === id)!.patternId)).size };
}
