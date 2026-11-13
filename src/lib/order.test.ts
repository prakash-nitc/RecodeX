import { describe, expect, it } from 'vitest';
import type { Pattern, Problem } from '../types';
import { byStudyOrder, compareInPattern, patternPositions } from './order';

const pat = (id: string, order: number, subPatterns: string[] = []): Pattern =>
  ({ id, name: id, order, subPatterns, learning: 'active', description: '', createdAt: '' });
const prob = (num: number, patternId: string, subPattern = ''): Problem => ({
  id: `p-${num}`, num, name: `P${num}`, patternId, subPattern, difficulty: 'Easy', url: '', priority: 'Medium', track: 'active',
  lastRating: null, lastRevised: null, nextReview: null, phase: 'Reconstruction', phaseManual: false, consecutiveGreen: 0,
  revisionCount: 0, weakness: '', notes: '', learnedAt: null, createdAt: '', updatedAt: '',
});

describe('study order and positions', () => {
  const patterns = { a: pat('a', 1, ['Pair Sum', 'Partitioning']), b: pat('b', 2) };

  it('numbers problems 1, 2, 3… within each pattern, by sub-pattern order then date added', () => {
    const list = [
      prob(101, 'a', 'Partitioning'), prob(102, 'a', 'Pair Sum'), prob(103, 'b'), prob(104, 'a', 'Pair Sum'),
      prob(198, 'a', 'Pair Sum'),   // added much later: still slots in with its sub-pattern
      prob(199, 'a', ''),           // no sub-pattern: last in its pattern
      prob(105, 'b'),
    ];
    const pos = patternPositions(list, patterns);
    expect(Object.fromEntries(pos)).toEqual({
      'p-102': 1, 'p-104': 2, 'p-198': 3, 'p-101': 4, 'p-199': 5,
      'p-103': 1, 'p-105': 2,
    });
    expect(list.slice().sort(byStudyOrder(patterns)).map(p => p.num)).toEqual([102, 104, 198, 101, 199, 103, 105]);
  });

  it('follows the pattern order and an edited sub-pattern order', () => {
    const list = [prob(1, 'b'), prob(2, 'a', 'Partitioning'), prob(3, 'a', 'Pair Sum')];
    expect(list.slice().sort(byStudyOrder({ ...patterns, a: pat('a', 3, ['Partitioning', 'Pair Sum']) })).map(p => p.num)).toEqual([1, 2, 3]);
    expect(compareInPattern(list[1], list[2], patterns.a)).toBeGreaterThan(0);
  });

  it('keeps problems of a missing pattern together at the end', () => {
    const list = [prob(1, 'gone'), prob(2, 'a', 'Pair Sum'), prob(3, 'gone')];
    expect(list.slice().sort(byStudyOrder(patterns)).map(p => p.num)).toEqual([2, 1, 3]);
    expect(patternPositions(list, patterns).get('p-3')).toBe(2);
  });
});
