import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Pattern, Problem, Settings, SessionConfig } from '../types';
import { DEFAULT_SETTINGS } from '../types';
import {
  intervalFor, streakAfter, suggestPhase, statusOf, overdueDays, applyRevision, previewNext, priorityFor,
  buildFocus, generateSession, candidatePool, baseConfig, revisionTypeOf, type RevisionInput,
} from './engine';
import { addDays } from './dates';

const T = '2026-11-07';
const S: Settings = { ...DEFAULT_SETTINGS };

let seq = 0;
function prob(over: Partial<Problem> = {}): Problem {
  seq++;
  return {
    id: `p-${seq}`, num: 100 + seq, name: `Problem ${seq}`, patternId: 'pt-a', subPattern: '', difficulty: 'Medium',
    url: '', priority: 'Medium', track: 'active', lastRating: null, lastRevised: null, nextReview: null,
    phase: 'Reconstruction', phaseManual: false, consecutiveGreen: 0, revisionCount: 0, weakness: '', notes: '',
    learnedAt: null, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', ...over,
  };
}
function pattern(id: string, order: number): Pattern {
  return { id, name: id, order, subPatterns: [], learning: 'active', description: '', createdAt: '2026-01-01T00:00:00.000Z' };
}
const rate = (rating: RevisionInput['rating'], over: Partial<RevisionInput> = {}): RevisionInput => ({
  rating, timeMin: null, independent: null, mistake: '', notes: '', phaseUsed: 'Reconstruction', source: 'quick', ...over,
});

afterEach(() => vi.restoreAllMocks());

// ---------------------------------------------------------------------------------------------

describe('intervals', () => {
  it('Red is 1 day and Yellow is 3 days by default', () => {
    expect(intervalFor('red', 0, S)).toBe(1);
    expect(intervalFor('yellow', 0, S)).toBe(3);
  });

  it('Green follows the ladder 7 → 14 → 30 → 60 and repeats the last step', () => {
    expect([1, 2, 3, 4, 5, 9].map(n => intervalFor('green', n, S))).toEqual([7, 14, 30, 60, 60, 60]);
  });

  it('a Green with streak 0 uses the first ladder step', () => {
    expect(intervalFor('green', 0, S)).toBe(7);
  });

  it('respects custom settings, never schedules less than 1 day, and falls back to 7 on an empty ladder', () => {
    const c = { ...S, redDays: 0, yellowDays: 5, greenLadder: [2, 4] };
    expect(intervalFor('red', 0, c)).toBe(1);
    expect(intervalFor('yellow', 0, c)).toBe(5);
    expect(intervalFor('green', 1, c)).toBe(2);
    expect(intervalFor('green', 3, c)).toBe(4);
    expect(intervalFor('green', 1, { ...S, greenLadder: [] })).toBe(7);
  });
});

describe('streaks', () => {
  it('Green adds one', () => expect(streakAfter(2, 'green', S)).toBe(3));
  it('Red always resets', () => {
    expect(streakAfter(5, 'red', S)).toBe(0);
    expect(streakAfter(5, 'red', { ...S, yellowResetsStreak: false })).toBe(0);
  });
  it('Yellow resets when yellowResetsStreak is on, and keeps (without adding) when off', () => {
    expect(streakAfter(3, 'yellow', S)).toBe(0);
    expect(streakAfter(3, 'yellow', { ...S, yellowResetsStreak: false })).toBe(3);
  });
});

describe('applyRevision (the green ladder end to end)', () => {
  it('walks a problem up the ladder with exact calendar dates', () => {
    let p = prob();
    const dates: string[] = [];
    let d = T;
    for (let i = 0; i < 5; i++) {
      const r = applyRevision(p, rate('green', { date: d }), S, `r-${i}`);
      p = r.problem;
      dates.push(p.nextReview!);
      d = p.nextReview!;
    }
    expect(dates).toEqual(['2026-11-14', '2026-11-28', '2026-12-28', '2027-02-26', '2027-04-27']);
    expect(p.consecutiveGreen).toBe(5);
    expect(p.revisionCount).toBe(5);
    expect(p.lastRevised).toBe('2027-02-26');
  });

  it('Red after a green streak resets to 0 and schedules tomorrow', () => {
    const p = prob({ lastRating: 'green', consecutiveGreen: 3, lastRevised: '2026-10-01', nextReview: T });
    const { problem } = applyRevision(p, rate('red', { date: T }), S, 'r');
    expect(problem.consecutiveGreen).toBe(0);
    expect(problem.nextReview).toBe('2026-11-08');
    expect(problem.priority).toBe('High');
    expect(problem.phase).toBe('Reconstruction');
  });

  it('Yellow resets the streak (default) and schedules in 3 days', () => {
    const p = prob({ lastRating: 'green', consecutiveGreen: 2 });
    const { problem } = applyRevision(p, rate('yellow', { date: T }), S, 'r');
    expect(problem.consecutiveGreen).toBe(0);
    expect(problem.nextReview).toBe('2026-11-10');
    expect(problem.priority).toBe('Medium');
  });

  it('Yellow keeps the streak when yellowResetsStreak is off; the next Green continues from it', () => {
    const s = { ...S, yellowResetsStreak: false };
    const p = prob({ lastRating: 'green', consecutiveGreen: 2 });
    const y = applyRevision(p, rate('yellow', { date: T }), s, 'r1').problem;
    expect(y.consecutiveGreen).toBe(2);
    const g = applyRevision(y, rate('green', { date: T }), s, 'r2').problem;
    expect(g.consecutiveGreen).toBe(3);
    expect(g.nextReview).toBe(addDays(T, 30));
  });

  it('records the previous state on the revision for undo', () => {
    const p = prob({ lastRating: 'yellow', consecutiveGreen: 0, nextReview: '2026-11-05', weakness: 'off by one', priority: 'Medium' });
    const { revision } = applyRevision(p, rate('green', { date: T, mistake: '  ' }), S, 'r-x');
    expect(revision.id).toBe('r-x');
    expect(revision.date).toBe(T);
    expect(revision.nextReview).toBe('2026-11-14');
    expect(revision.prev).toEqual({
      lastRating: 'yellow', lastRevised: null, nextReview: '2026-11-05', consecutiveGreen: 0, revisionCount: 0,
      phase: 'Reconstruction', phaseManual: false, priority: 'Medium', weakness: 'off by one', track: 'active', learnedAt: null,
    });
  });

  it('snapshots the track so undoing the first rating of a backlog problem puts it back', () => {
    const p = prob({ track: 'backlog', learnedAt: '2026-11-01' });
    const { problem, revision } = applyRevision(p, rate('green', { date: T }), S, 'r');
    expect(problem.track).toBe('active');
    expect(revision.prev).toMatchObject({ track: 'backlog', learnedAt: '2026-11-01' });
  });

  it('keeps the old weakness when no mistake is given and replaces it when one is', () => {
    const p = prob({ weakness: 'old' });
    expect(applyRevision(p, rate('green', { date: T }), S, 'a').problem.weakness).toBe('old');
    expect(applyRevision(p, rate('red', { date: T, mistake: ' new one ' }), S, 'b').problem.weakness).toBe('new one');
  });

  it('honours a manual next date and a manual next phase', () => {
    const p = prob();
    const { problem, revision } = applyRevision(p, rate('green', { date: T, nextOverride: '2026-12-01', nextPhase: 'Reconstruction' }), S, 'r');
    expect(problem.nextReview).toBe('2026-12-01');
    expect(revision.nextReview).toBe('2026-12-01');
    expect(problem.phase).toBe('Reconstruction');
    expect(problem.phaseManual).toBe(true);
  });

  it('a manually pinned phase survives later ratings', () => {
    const p = prob({ phase: 'Quick Recall', phaseManual: true });
    expect(applyRevision(p, rate('red', { date: T }), S, 'r').problem.phase).toBe('Quick Recall');
  });

  it('an explicit next phase replaces a pinned one, and choosing the suggested phase unpins it', () => {
    const p = prob({ phase: 'Quick Recall', phaseManual: true });
    // Red suggests Reconstruction. Choosing it explicitly must not be ignored in favour of the old pin.
    const auto = applyRevision(p, rate('red', { date: T, nextPhase: 'Reconstruction' }), S, 'r1').problem;
    expect(auto.phase).toBe('Reconstruction');
    expect(auto.phaseManual).toBe(false);
    const pinned = applyRevision(p, rate('red', { date: T, nextPhase: 'Recall/Repair' }), S, 'r2').problem;
    expect(pinned.phase).toBe('Recall/Repair');
    expect(pinned.phaseManual).toBe(true);
  });

  it('leaves priority alone when autoPriority is off', () => {
    const p = prob({ priority: 'Low' });
    expect(applyRevision(p, rate('red', { date: T }), { ...S, autoPriority: false }, 'r').problem.priority).toBe('Low');
  });

  it('rating a backlog problem moves it to the active track', () => {
    const p = prob({ track: 'backlog' });
    expect(applyRevision(p, rate('yellow', { date: T }), S, 'r').problem.track).toBe('active');
  });

  it('handles month and year boundaries without shifting the day', () => {
    const p = prob();
    expect(applyRevision(p, rate('green', { date: '2026-12-28' }), S, 'r').problem.nextReview).toBe('2027-01-04');
    expect(applyRevision(p, rate('red', { date: '2028-02-28' }), S, 'r').problem.nextReview).toBe('2028-02-29');
  });

  it('previewNext agrees with applyRevision', () => {
    const p = prob({ lastRating: 'green', consecutiveGreen: 1 });
    const pv = previewNext(p, 'green', S, T);
    const { problem } = applyRevision(p, rate('green', { date: T }), S, 'r');
    expect(pv).toEqual({ streak: 2, days: 14, next: '2026-11-21', phase: 'Quick Recall' });
    expect(problem.nextReview).toBe(pv.next);
  });

  it('priorityFor and revisionTypeOf map ratings as in the sheet', () => {
    expect([priorityFor('red'), priorityFor('yellow'), priorityFor('green')]).toEqual(['High', 'Medium', 'Low']);
    expect([revisionTypeOf(null), revisionTypeOf('red'), revisionTypeOf('yellow'), revisionTypeOf('green')])
      .toEqual(['First Attempt', 'Repair', 'Recall/Repair', 'Quick Recall']);
  });
});

describe('status and overdue detection', () => {
  it('backlog → Yet to Learn, unrated without a date → Not Reviewed', () => {
    expect(statusOf(prob({ track: 'backlog', lastRating: 'red', nextReview: '2026-01-01' }), S, T)).toBe('Yet to Learn');
    expect(statusOf(prob(), S, T)).toBe('Not Reviewed');
  });

  it('a scheduled first attempt (no rating yet) becomes due and overdue like any review', () => {
    expect(statusOf(prob({ nextReview: '2026-11-20' }), S, T)).toBe('Not Reviewed'); // still waiting for its day
    expect(statusOf(prob({ nextReview: T }), S, T)).toBe('Due Today');
    expect(statusOf(prob({ nextReview: '2026-11-01' }), S, T)).toBe('Overdue');
    expect(statusOf(prob({ nextReview: '2026-11-01', consecutiveGreen: 9 }), S, T)).toBe('Overdue'); // never Mastered without a rating
  });

  it('past → Overdue, today → Due Today, future → Scheduled', () => {
    expect(statusOf(prob({ lastRating: 'red', nextReview: '2026-11-06' }), S, T)).toBe('Overdue');
    expect(statusOf(prob({ lastRating: 'red', nextReview: T }), S, T)).toBe('Due Today');
    expect(statusOf(prob({ lastRating: 'green', nextReview: '2026-11-08', consecutiveGreen: 1 }), S, T)).toBe('Scheduled');
  });

  it('Mastered needs the mastery streak and a future date; overdue wins over mastered', () => {
    expect(statusOf(prob({ lastRating: 'green', nextReview: '2027-01-01', consecutiveGreen: 4 }), S, T)).toBe('Mastered');
    expect(statusOf(prob({ lastRating: 'green', nextReview: '2027-01-01', consecutiveGreen: 3 }), S, T)).toBe('Scheduled');
    expect(statusOf(prob({ lastRating: 'green', nextReview: '2026-11-01', consecutiveGreen: 6 }), S, T)).toBe('Overdue');
  });

  it('overdueDays counts calendar days, counts a missed first attempt, and ignores backlog problems', () => {
    expect(overdueDays(prob({ lastRating: 'yellow', nextReview: '2026-10-31' }), T)).toBe(7);
    expect(overdueDays(prob({ lastRating: 'yellow', nextReview: T }), T)).toBe(0);
    expect(overdueDays(prob({ lastRating: 'yellow', nextReview: '2026-11-20' }), T)).toBe(0);
    expect(overdueDays(prob({ nextReview: '2026-10-31' }), T)).toBe(7);
    expect(overdueDays(prob(), T)).toBe(0);
    expect(overdueDays(prob({ lastRating: 'red', nextReview: '2026-10-31', track: 'backlog' }), T)).toBe(0);
  });

  it('a problem due yesterday becomes overdue at local midnight, across a year boundary', () => {
    const p = prob({ lastRating: 'red', nextReview: '2026-12-31' });
    expect(statusOf(p, S, '2026-12-31')).toBe('Due Today');
    expect(statusOf(p, S, '2027-01-01')).toBe('Overdue');
    expect(overdueDays(p, '2027-01-01')).toBe(1);
  });
});

describe('phase suggestion', () => {
  it('maps rating and history to a phase', () => {
    expect(suggestPhase(null, 0, null)).toBe('Reconstruction');
    expect(suggestPhase('red', 0, 'green')).toBe('Reconstruction');
    expect(suggestPhase('yellow', 0, null)).toBe('Recall/Repair');
    expect(suggestPhase('green', 1, 'red')).toBe('Recall/Repair');
    expect(suggestPhase('green', 1, 'yellow')).toBe('Quick Recall');
    expect(suggestPhase('green', 1, null)).toBe('Quick Recall');
    expect(suggestPhase('green', 2, 'red')).toBe('Quick Recall');
  });
});

// ---------------------------------------------------------------------------------------------

describe("Today's Focus", () => {
  const pats = { 'pt-a': pattern('pt-a', 1), 'pt-b': pattern('pt-b', 2) };

  it('orders overdue (oldest first) → due today → high priority → weak → new', () => {
    const newB = prob({ patternId: 'pt-b', num: 1 });
    const newA2 = prob({ patternId: 'pt-a', num: 5 });
    const newA1 = prob({ patternId: 'pt-a', num: 3 });
    const weakLater = prob({ lastRating: 'yellow', nextReview: '2026-11-20', lastRevised: '2026-11-01', priority: 'Low' });
    const weakRedLater = prob({ lastRating: 'red', nextReview: '2026-11-25', lastRevised: '2026-11-01', priority: 'Low' });
    const high = prob({ lastRating: 'green', nextReview: '2026-12-01', priority: 'High', lastRevised: '2026-11-01' });
    const dueLow = prob({ lastRating: 'green', nextReview: T, priority: 'Low' });
    const dueHigh = prob({ lastRating: 'green', nextReview: T, priority: 'High' });
    const od1 = prob({ lastRating: 'green', nextReview: '2026-11-05' });
    const od5 = prob({ lastRating: 'red', nextReview: '2026-11-01' });
    const fresh = prob({ lastRating: 'green', nextReview: '2026-12-15', priority: 'Low', lastRevised: '2026-11-01' });

    const f = buildFocus([newB, newA2, newA1, weakLater, weakRedLater, high, dueLow, dueHigh, od1, od5, fresh], pats, S, T);
    expect(f.map(x => [x.problem.id, x.reason])).toEqual([
      [od5.id, 'Overdue'], [od1.id, 'Overdue'],
      [dueHigh.id, 'Due today'], [dueLow.id, 'Due today'],
      [high.id, 'High priority'],
      [weakRedLater.id, 'Weak'], [weakLater.id, 'Weak'],
      [newA1.id, 'New'], [newA2.id, 'New'], // pattern order then number; capped at focusNewPerDay = 2
    ]);
    expect(f[0].overdue).toBe(6);
    expect(f[1].overdue).toBe(2);
  });

  it('breaks ties on the same overdue date by priority, then by weakness', () => {
    const a = prob({ lastRating: 'green', nextReview: '2026-11-01', priority: 'Low' });
    const b = prob({ lastRating: 'green', nextReview: '2026-11-01', priority: 'High' });
    const c = prob({ lastRating: 'red', nextReview: '2026-11-01', priority: 'Low' });
    expect(buildFocus([a, b, c], pats, S, T).map(x => x.problem.id)).toEqual([b.id, c.id, a.id]);
  });

  it('never lists a problem twice', () => {
    const p = prob({ lastRating: 'red', nextReview: '2026-11-01', priority: 'High' });
    expect(buildFocus([p], pats, S, T)).toHaveLength(1);
  });

  it('lists a scheduled first attempt as due or overdue, and does not spend a "new" slot on it', () => {
    const dueFirst = prob({ patternId: 'pt-a', num: 1, nextReview: T });
    const missedFirst = prob({ patternId: 'pt-a', num: 2, nextReview: '2026-11-04' });
    const newA = prob({ patternId: 'pt-a', num: 3 });
    const newB = prob({ patternId: 'pt-a', num: 4 });
    const f = buildFocus([newB, newA, dueFirst, missedFirst], pats, S, T);
    expect(f.map(x => [x.problem.id, x.reason])).toEqual([
      [missedFirst.id, 'Overdue'], [dueFirst.id, 'Due today'], [newA.id, 'New'], [newB.id, 'New'],
    ]);
    expect(f[0].overdue).toBe(3);
  });

  it('skips backlog problems and problems whose pattern is missing', () => {
    const backlog = prob({ track: 'backlog', lastRating: 'red', nextReview: '2026-11-01' });
    const orphan = prob({ patternId: 'pt-gone', lastRating: 'red', nextReview: '2026-11-01' });
    expect(buildFocus([backlog, orphan], pats, S, T)).toEqual([]);
  });

  it('weak and high-priority slots skip problems already revised today', () => {
    const w = prob({ lastRating: 'red', nextReview: '2026-11-08', lastRevised: T, priority: 'High' });
    expect(buildFocus([w], pats, S, T)).toEqual([]);
  });

  it('honours the include toggles, the new-per-day count and the study plan', () => {
    const weak = prob({ lastRating: 'yellow', nextReview: '2026-11-20', priority: 'Medium' });
    const high = prob({ lastRating: 'green', nextReview: '2026-12-01', priority: 'High' });
    const newA = prob({ patternId: 'pt-a' });
    const newB = prob({ patternId: 'pt-b' });
    const list = [weak, high, newA, newB];
    expect(buildFocus(list, pats, { ...S, focusIncludeWeak: false, focusIncludeHigh: false, focusNewPerDay: 0 }, T)).toEqual([]);
    expect(buildFocus(list, pats, { ...S, focusIncludeWeak: false, focusIncludeHigh: false, studyPlanPatternIds: ['pt-b'] }, T)
      .map(x => x.problem.id)).toEqual([newB.id]);
  });
});

// ---------------------------------------------------------------------------------------------

describe('session generation', () => {
  const cfg = (over: Partial<SessionConfig> = {}): SessionConfig => ({ ...baseConfig(S), patternCount: 0, includeNew: true, ...over });
  const group = (patternId: string, n: number, over: Partial<Problem> = {}) =>
    Array.from({ length: n }, () => prob({ patternId, lastRating: 'yellow', nextReview: '2026-11-01', ...over }));
  const patternOf = (all: Problem[]) => (id: string) => all.find(p => p.id === id)!.patternId;

  it('round-robins between patterns so neighbours come from different patterns', () => {
    const all = [...group('pt-a', 4), ...group('pt-b', 4), ...group('pt-c', 4)];
    for (const strategy of ['balanced', 'random', 'weakest', 'overdue'] as const) {
      const { ids, patternsUsed, poolSize } = generateSession(all, cfg({ count: 9, strategy }), T);
      expect(ids).toHaveLength(9);
      expect(new Set(ids).size).toBe(9);
      expect(patternsUsed).toBe(3);
      expect(poolSize).toBe(12);
      const seq = ids.map(patternOf(all));
      for (let i = 1; i < seq.length; i++) expect(seq[i]).not.toBe(seq[i - 1]);
      // every block of 3 holds one problem from each pattern
      for (let i = 0; i < 9; i += 3) expect(new Set(seq.slice(i, i + 3)).size).toBe(3);
    }
  });

  it('keeps going with the remaining patterns once one runs out', () => {
    const all = [...group('pt-a', 1), ...group('pt-b', 4)];
    const { ids } = generateSession(all, cfg({ count: 5 }), T);
    expect(ids).toHaveLength(5);
    expect(ids.map(patternOf(all)).filter(x => x === 'pt-a')).toHaveLength(1);
  });

  it('limits the number of patterns with patternCount, choosing the strongest candidates', () => {
    const weakRed = group('pt-a', 3, { lastRating: 'red' });
    const greens = group('pt-b', 3, { lastRating: 'green', priority: 'Low' });
    const yellows = group('pt-c', 3);
    const all = [...weakRed, ...greens, ...yellows];
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const { ids, patternsUsed } = generateSession(all, cfg({ count: 10, patternCount: 2, strategy: 'weakest' }), T);
    expect(patternsUsed).toBe(2);
    expect(ids).toHaveLength(6);
    expect(new Set(ids.map(patternOf(all)))).toEqual(new Set(['pt-a', 'pt-c']));
  });

  it('within a pattern, the weakest strategy puts Red before Yellow before Green', () => {
    const g = prob({ patternId: 'pt-a', lastRating: 'green', nextReview: '2026-11-01' });
    const y = prob({ patternId: 'pt-a', lastRating: 'yellow', nextReview: '2026-11-01' });
    const r = prob({ patternId: 'pt-a', lastRating: 'red', nextReview: '2026-11-01' });
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    expect(generateSession([g, y, r], cfg({ count: 3, strategy: 'weakest' }), T).ids).toEqual([r.id, y.id, g.id]);
  });

  it('the overdue strategy puts the most overdue first', () => {
    const a = prob({ patternId: 'pt-a', lastRating: 'green', nextReview: '2026-11-06' });
    const b = prob({ patternId: 'pt-a', lastRating: 'green', nextReview: '2026-10-01' });
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    expect(generateSession([a, b], cfg({ count: 2, strategy: 'overdue' }), T).ids).toEqual([b.id, a.id]);
  });

  it('stops at count and returns nothing for an empty pool', () => {
    expect(generateSession(group('pt-a', 10), cfg({ count: 4 }), T).ids).toHaveLength(4);
    expect(generateSession([], cfg({ count: 4 }), T)).toEqual({ ids: [], poolSize: 0, patternsUsed: 0 });
  });

  it('candidatePool applies every filter', () => {
    const overdue = prob({ lastRating: 'yellow', nextReview: '2026-11-01', difficulty: 'Hard' });
    const due = prob({ lastRating: 'green', nextReview: T, difficulty: 'Easy' });
    const later = prob({ lastRating: 'green', nextReview: '2026-12-01', lastRevised: '2026-11-06' });
    const fresh = prob({ patternId: 'pt-b' });
    const firstDue = prob({ patternId: 'pt-b', nextReview: '2026-11-03' }); // first attempt scheduled, never rated
    const backlog = prob({ track: 'backlog' });
    const all = [overdue, due, later, fresh, firstDue, backlog];
    const ids = (c: Partial<SessionConfig>) => candidatePool(all, cfg(c), T).map(p => p.id);
    expect(ids({})).toEqual([overdue.id, due.id, later.id, fresh.id, firstDue.id]);
    expect(ids({ includeNew: false })).toEqual([overdue.id, due.id, later.id]);
    expect(ids({ includeSolved: false })).toEqual([fresh.id, firstDue.id]);
    expect(ids({ onlyDue: true })).toEqual([overdue.id, due.id, firstDue.id]);
    expect(ids({ onlyOverdue: true })).toEqual([overdue.id, firstDue.id]);
    expect(ids({ onlyWeak: true })).toEqual([overdue.id]);
    expect(ids({ difficulty: 'easy-medium' })).toEqual([due.id, later.id, fresh.id, firstDue.id]);
    expect(ids({ difficulty: 'Easy' })).toEqual([due.id]);
    expect(ids({ patternIds: ['pt-b'] })).toEqual([fresh.id, firstDue.id]);
    expect(ids({ excludeRecentDays: 2 })).toEqual([overdue.id, due.id, fresh.id, firstDue.id]);
    expect(ids({ phases: ['Quick Recall'] })).toEqual([]);
  });
});
