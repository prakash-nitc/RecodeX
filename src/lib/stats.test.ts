import { describe, expect, it } from 'vitest';
import type { Problem, Revision } from '../types';
import { DEFAULT_SETTINGS } from '../types';
import { weekDigest } from './stats';

const S = { ...DEFAULT_SETTINGS }; // masteryStreak 4, week starts Monday
const T = '2026-11-12';            // Thursday; the week began on Mon 9 Nov

const prob = (id: string, over: Partial<Problem> = {}): Problem => ({
  id, num: Number(id.slice(2)), name: id, patternId: 'pt-a', subPattern: '', difficulty: 'Medium', url: '', priority: 'Medium', track: 'active',
  lastRating: null, lastRevised: null, nextReview: null, phase: 'Reconstruction', phaseManual: false, consecutiveGreen: 0, revisionCount: 0,
  weakness: '', notes: '', learnedAt: null, createdAt: '', updatedAt: '', ...over,
});
let n = 0;
const rev = (problemId: string, date: string, rating: Revision['rating'], prev: Revision['prev'] = null): Revision => ({
  id: `r-${++n}`, problemId, date, at: `${date}T0${n % 10}:00:00.000Z`, rating, phase: 'Reconstruction', timeMin: null, independent: null,
  mistake: '', notes: '', sessionId: null, source: 'quick', nextReview: date, prev,
});

describe('weekDigest', () => {
  it('finds improvements, slips, new masteries, near-mastery and the toughest pattern', () => {
    const problems = Object.fromEntries([
      prob('p-1'), prob('p-7'), prob('p-2'), prob('p-8', { patternId: 'pt-c' }), prob('p-3'), prob('p-4', { patternId: 'pt-b' }),
      prob('p-5', { lastRating: 'green', consecutiveGreen: 3, nextReview: '2026-11-15' }),
      prob('p-6', { lastRating: 'green', consecutiveGreen: 3, nextReview: '2026-12-30' }), // too far ahead
    ].map(p => [p.id, p]));
    const revs = [
      rev('p-1', '2026-11-02', 'red'), rev('p-1', '2026-11-10', 'yellow'),            // improved this week
      rev('p-2', '2026-11-03', 'green'), rev('p-2', '2026-11-11', 'red'),             // slipped this week
      rev('p-8', '2026-11-04', 'yellow'), rev('p-8', '2026-11-12', 'red'),            // Yellow → Red is a slip too
      rev('p-3', '2026-09-01', 'green'), rev('p-3', '2026-09-08', 'green'), rev('p-3', '2026-09-22', 'green'),
      rev('p-3', '2026-11-09', 'green'),                                              // 4th green: mastered this week
      rev('p-4', '2026-11-10', 'red'), rev('p-4', '2026-11-11', 'red'),               // pt-b: 2 reds
      rev('p-7', '2026-10-26', 'red'), rev('p-7', '2026-11-05', 'green'),            // improved last week: not counted
      rev('p-9', '2026-11-10', 'green'),                                              // deleted problem: ignored
    ];
    const d = weekDigest(revs, problems, S, 1, T);
    expect(d.improved).toEqual(['p-1']);
    expect(d.slipped).toEqual(['p-8', 'p-2']); // newest first
    expect(d.mastered).toEqual(['p-3']);
    expect(d.nearMastery).toEqual(['p-5']);
    expect(d.toughest).toEqual({ patternId: 'pt-b', red: 2 });
  });

  it('uses the import snapshot for mastery and is empty for a quiet week', () => {
    const problems = { 'p-1': prob('p-1') };
    expect(weekDigest([rev('p-1', '2026-11-10', 'green', { consecutiveGreen: 3 } as any)], problems, S, 1, T).mastered).toEqual(['p-1']);
    expect(weekDigest([rev('p-1', '2026-11-01', 'red')], problems, S, 1, T)).toEqual({ improved: [], slipped: [], mastered: [], nearMastery: [], toughest: null });
  });
});
