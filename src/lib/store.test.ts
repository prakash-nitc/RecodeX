// The store holds the data-destructive paths (import, undo, activate, restore). These tests drive it
// through the public functions on top of an in-memory backend.
import { beforeEach, describe, expect, it } from 'vitest';
import type { Backend, BackendEvents } from './backend';
import {
  boot, getState, settingsOf, addPattern, addProblem, recordRevision, undoRevision, latestRevisionOf, activateProblems,
  setLearned, importRows, restoreBackup, makeBackup, deletePattern, setLearningState, updateSettings, type ImportRow,
} from './store';
import { addDays, today } from './dates';

class MemBackend implements Backend {
  kind = 'local' as const;
  writes: string[] = [];
  start(ev: BackendEvents) { ev.onReady(false); }
  put(col: string, id: string) { this.writes.push(`${col}/${id}`); }
  remove(col: string, id: string) { this.writes.push(`-${col}/${id}`); }
  putMeta() { this.writes.push('meta'); }
  flushed() { return Promise.resolve(); }
}

const T = '2026-11-07';
const rate = (rating: 'green' | 'yellow' | 'red', date: string, extra: Partial<Parameters<typeof recordRevision>[1]> = {}) =>
  ({ rating, timeMin: null, independent: null, mistake: '', notes: '', phaseUsed: 'Reconstruction' as const, source: 'quick' as const, date, ...extra });
const row = (over: Partial<ImportRow> = {}): ImportRow => ({
  name: 'Two Sum', pattern: 'Two Pointers', subPattern: 'Pair Sum', difficulty: 'Easy', url: 'https://leetcode.com/problems/two-sum/', priority: 'Medium',
  track: 'active', rating: null, lastRevised: null, nextReview: null, phase: null, consecutiveGreen: null, revisionCount: null, weakness: '', notes: '', ...over,
});

let be: MemBackend;
beforeEach(() => { be = new MemBackend(); boot(be); });

describe('problems', () => {
  it('numbers problems from 101 and keeps nextNum ahead of every existing number', () => {
    const pt = addPattern('Two Pointers');
    const a = addProblem({ name: 'A', patternId: pt.id, subPattern: '', difficulty: 'Easy', url: '', priority: 'Medium', track: 'active', notes: '' });
    const b = addProblem({ name: 'B', patternId: pt.id, subPattern: 'Sub', difficulty: 'Easy', url: '', priority: 'Medium', track: 'active', notes: '' });
    expect([a.num, b.num, a.id]).toEqual([101, 102, 'p-101']);
    expect(getState().meta!.nextNum).toBe(103);
    expect(getState().patterns[pt.id].subPatterns).toEqual(['Sub']);
  });
});

describe('revisions and undo', () => {
  it('undo restores rating, schedule, track and learnedAt, and only for the latest revision', () => {
    const pt = addPattern('P');
    const p = addProblem({ name: 'A', patternId: pt.id, subPattern: '', difficulty: 'Easy', url: '', priority: 'Medium', track: 'backlog', notes: '', initial: 'backlog' });
    const r1 = recordRevision(p.id, rate('red', '2026-11-01'))!;
    const r2 = recordRevision(p.id, rate('green', '2026-11-02'))!;
    let cur = getState().problems[p.id];
    expect(cur).toMatchObject({ track: 'active', learnedAt: '2026-11-01', lastRating: 'green', consecutiveGreen: 1, revisionCount: 2, nextReview: '2026-11-09' });

    expect(undoRevision(r1.id)).toBe(false);          // not the latest
    expect(undoRevision(r2.id)).toBe(true);
    cur = getState().problems[p.id];
    expect(cur).toMatchObject({ lastRating: 'red', consecutiveGreen: 0, revisionCount: 1, nextReview: '2026-11-02', track: 'active' });
    expect(getState().revisions[r2.id]).toBeUndefined();
    expect(latestRevisionOf(p.id)!.id).toBe(r1.id);

    expect(undoRevision(r1.id)).toBe(true);           // back to the untouched backlog problem
    cur = getState().problems[p.id];
    expect(cur).toMatchObject({ lastRating: null, nextReview: null, track: 'backlog', learnedAt: null, revisionCount: 0 });
  });
});

describe('activation after learning', () => {
  it('schedules a first attempt for solved problems and leaves the others Not Reviewed', () => {
    const pt = addPattern('P', 'yet_to_learn');
    const mk = (n: string) => addProblem({ name: n, patternId: pt.id, subPattern: '', difficulty: 'Easy', url: '', priority: 'Medium', track: 'backlog', notes: '', initial: 'backlog' });
    const solved = mk('solved'), unsolved = mk('unsolved');
    updateSettings({ activationDelayDays: 2 });
    setLearned(solved.id, true);
    activateProblems([solved.id, unsolved.id]);
    expect(getState().problems[solved.id]).toMatchObject({ track: 'active', nextReview: addDays(today(), 2) });
    expect(getState().problems[unsolved.id]).toMatchObject({ track: 'active', nextReview: null });
  });

  it('moving a pattern to Yet to Learn sends only its unrated problems to the backlog', () => {
    const pt = addPattern('P');
    const a = addProblem({ name: 'a', patternId: pt.id, subPattern: '', difficulty: 'Easy', url: '', priority: 'Medium', track: 'active', notes: '' });
    const b = addProblem({ name: 'b', patternId: pt.id, subPattern: '', difficulty: 'Easy', url: '', priority: 'Medium', track: 'active', notes: '' });
    recordRevision(b.id, rate('green', T));
    setLearningState(pt.id, 'yet_to_learn');
    expect(getState().problems[a.id].track).toBe('backlog');
    expect(getState().problems[b.id].track).toBe('active');
  });
});

describe('CSV import', () => {
  it('adds, skips or updates duplicates, and creates one import revision for rated rows', () => {
    const s = settingsOf();
    expect(importRows([row({ rating: 'green', lastRevised: '2026-11-01' })], 'skip')).toEqual({ added: 1, updated: 0, skipped: 0 });
    const p = Object.values(getState().problems)[0];
    expect(p).toMatchObject({ lastRating: 'green', lastRevised: '2026-11-01', nextReview: addDays('2026-11-01', s.greenLadder[0]), consecutiveGreen: 1, revisionCount: 1 });
    expect(getState().patterns[p.patternId].name).toBe('Two Pointers');
    const revs = Object.values(getState().revisions);
    expect(revs).toHaveLength(1);
    expect(revs[0]).toMatchObject({ problemId: p.id, source: 'import', rating: 'green', date: '2026-11-01' });

    // Same URL, different casing in the name: a duplicate.
    expect(importRows([row({ name: 'TWO SUM' })], 'skip')).toEqual({ added: 0, updated: 0, skipped: 1 });
    expect(importRows([row({ name: 'TWO SUM', difficulty: 'Hard' })], 'update')).toEqual({ added: 0, updated: 1, skipped: 0 });
    expect(getState().problems[p.id]).toMatchObject({ name: 'TWO SUM', difficulty: 'Hard', lastRating: 'green' });
    expect(Object.values(getState().revisions)).toHaveLength(1); // no second import revision
    expect(Object.keys(getState().problems)).toHaveLength(1);
  });
});

describe('backup and patterns', () => {
  it('restoreBackup replaces everything and leaves the import screen', () => {
    const pt = addPattern('Old');
    addProblem({ name: 'old', patternId: pt.id, subPattern: '', difficulty: 'Easy', url: '', priority: 'Medium', track: 'active', notes: '' });
    const backup = makeBackup();
    boot(new MemBackend());
    const pt2 = addPattern('New');
    addProblem({ name: 'new', patternId: pt2.id, subPattern: '', difficulty: 'Easy', url: '', priority: 'Medium', track: 'active', notes: '' });
    restoreBackup(backup);
    const st = getState();
    expect(Object.values(st.patterns).map(p => p.name)).toEqual(['Old']);
    expect(Object.values(st.problems).map(p => p.name)).toEqual(['old']);
    expect(st.needsImport).toBe(false);
    expect(st.meta!.nextNum).toBe(backup.meta!.nextNum);
  });

  it('deletePattern moves or deletes its problems together with their revisions', () => {
    const a = addPattern('A'), b = addPattern('B');
    const p = addProblem({ name: 'x', patternId: a.id, subPattern: '', difficulty: 'Easy', url: '', priority: 'Medium', track: 'active', notes: '' });
    recordRevision(p.id, rate('red', T));
    deletePattern(a.id, b.id);
    expect(getState().patterns[a.id]).toBeUndefined();
    expect(getState().problems[p.id].patternId).toBe(b.id);
    deletePattern(b.id, null);
    expect(getState().problems).toEqual({});
    expect(getState().revisions).toEqual({});
  });
});

describe('milestones', () => {
  it('awards mastery and streak milestones once, dated by the revision that reached them', () => {
    const pt = addPattern('P');
    const p = addProblem({ name: 'x', patternId: pt.id, subPattern: '', difficulty: 'Easy', url: '', priority: 'Medium', track: 'active', notes: '' });
    const days = Array.from({ length: 7 }, (_, i) => addDays('2026-11-01', i));
    days.forEach(d => recordRevision(p.id, rate('green', d)));
    const m = settingsOf().milestones;
    expect(m['first-mastered']).toBe('2026-11-04'); // 4th consecutive green (masteryStreak = 4)
    expect(m['streak-7']).toBe('2026-11-07');
    expect(m['mastered-50']).toBeUndefined();
    // Losing the streak later does not take the milestone away.
    recordRevision(p.id, rate('red', '2026-11-20'));
    expect(settingsOf().milestones['first-mastered']).toBe('2026-11-04');
  });
});
