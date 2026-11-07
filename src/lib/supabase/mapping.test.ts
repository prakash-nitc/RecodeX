import { describe, expect, it } from 'vitest';
import { toRow, fromRow } from './mapping';
import type { Problem, Revision, Session, Pattern, Meta } from '../../types';
import { DEFAULT_SETTINGS } from '../../types';

const UID = '00000000-0000-0000-0000-000000000001';

const problem: Problem = {
  id: 'p-101', num: 101, name: 'Pair with Target Sum', patternId: 'pt-two-pointers', subPattern: 'Pair Sum', difficulty: 'Easy',
  url: 'https://leetcode.com/problems/two-sum-ii-input-array-is-sorted/', priority: 'Low', track: 'active', lastRating: 'green',
  lastRevised: '2026-11-06', nextReview: '2026-11-13', phase: 'Quick Recall', phaseManual: false, consecutiveGreen: 1,
  revisionCount: 1, weakness: '', notes: 'x', learnedAt: null, importedName: 'Pair with Target Sum (easy)',
  createdAt: '2026-11-01T10:00:00.000Z', updatedAt: '2026-11-06T10:00:00.000Z',
};

describe('mapping', () => {
  it('maps a problem to snake_case columns and back unchanged', () => {
    const row = toRow('problems', problem, UID);
    expect(row).toMatchObject({ user_id: UID, id: 'p-101', pattern_id: 'pt-two-pointers', last_rating: 'green', next_review: '2026-11-13', consecutive_green: 1, imported_name: 'Pair with Target Sum (easy)' });
    expect(fromRow('problems', row)).toEqual(problem);
  });

  it('omits importedName when the column is null', () => {
    const { importedName, ...rest } = problem;
    const back = fromRow('problems', toRow('problems', rest, UID));
    expect('importedName' in back).toBe(false);
    expect(back).toEqual(rest);
  });

  it('normalises Postgres timestamps so string comparison of `at` keeps working', () => {
    const rev: Revision = {
      id: 'r-1', problemId: 'p-101', date: '2026-11-07', at: '2026-11-07T06:30:00.000Z', rating: 'red', phase: 'Reconstruction',
      timeMin: 12.5, independent: false, mistake: 'm', notes: '', sessionId: null, source: 'quick', nextReview: '2026-11-08', prev: null,
    };
    const row = { ...toRow('revisions', rev, UID), revised_at: '2026-11-07T06:30:00+00:00', synced_at: 'x' };
    expect(fromRow('revisions', row)).toEqual(rev);
  });

  it('keeps dates as plain YYYY-MM-DD strings', () => {
    const row = toRow('problems', { ...problem, lastRevised: '2026-12-31', nextReview: '2027-01-01' }, UID);
    expect(row.last_revised).toBe('2026-12-31');
    expect(fromRow('problems', row).nextReview).toBe('2027-01-01');
  });

  it('keeps session results inside the session', () => {
    const s: Session = {
      id: 's-1', kind: 'daily', title: 'Daily', config: null, problemIds: ['p-1', 'p-2'], index: 1, status: 'in_progress',
      results: [{ problemId: 'p-1', outcome: 'rated', rating: 'green', timeSec: 90, revisionId: 'r-1' }],
      startedAt: '2026-11-07T06:00:00.000Z', endedAt: null, elapsedSec: 90,
    };
    const row = toRow('practice_sessions', s, UID);
    expect(row.position).toBe(1);
    expect(row.results).toEqual(s.results);
    expect(fromRow('practice_sessions', row)).toEqual(s);
  });

  it('maps patterns and meta', () => {
    const p: Pattern = { id: 'pt-a', name: 'A', order: 3, subPatterns: ['x'], learning: 'yet_to_learn', description: 'd', createdAt: '2026-11-01T00:00:00.000Z' };
    expect(toRow('patterns', p, UID)).toMatchObject({ sort_order: 3, sub_patterns: ['x'] });
    expect(fromRow('patterns', toRow('patterns', p, UID))).toEqual(p);
    const m: Meta = { settings: { ...DEFAULT_SETTINGS }, nextNum: 296, importedAt: '2026-11-07T00:00:00.000Z', schemaVersion: 1 };
    expect(fromRow('user_meta', toRow('user_meta', m, UID))).toEqual(m);
  });

  it('fills defaults for fields missing in old records', () => {
    const row = toRow('problems', { id: 'p-1', num: 1, name: 'n', patternId: 'pt' }, UID);
    expect(row).toMatchObject({ difficulty: 'Medium', priority: 'Medium', track: 'active', phase: 'Reconstruction', consecutive_green: 0, weakness: '', last_rating: null });
    expect('created_at' in row).toBe(false); // column default fills it
  });
});
