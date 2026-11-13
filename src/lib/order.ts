// The study order of problems: patterns in journey order; inside a pattern, sub-patterns in the order
// the pattern lists them (editable in the pattern's Edit dialog), then the order problems were added.
// Problems without a known sub-pattern come last in their pattern.
//
// The number shown next to a problem is its position in this order within its pattern (1, 2, 3…).
// Problem.num stays as a permanent, internal creation number: it is part of the record id (p-101),
// it is exported as problem_id in CSV, and it is still searchable.
import type { Pattern, Problem } from '../types';

function subRank(p: Problem, pattern: Pattern | undefined): number {
  const i = pattern ? pattern.subPatterns.indexOf(p.subPattern) : -1;
  return i < 0 ? Number.MAX_SAFE_INTEGER : i;
}

/** Orders two problems of the same pattern. */
export function compareInPattern(a: Problem, b: Problem, pattern: Pattern | undefined): number {
  return subRank(a, pattern) - subRank(b, pattern) || a.num - b.num;
}

/** Orders problems across patterns: pattern order first, then the order within the pattern. */
export function byStudyOrder(patterns: Record<string, Pattern>) {
  const ord = (p: Problem) => patterns[p.patternId]?.order ?? Number.MAX_SAFE_INTEGER;
  return (a: Problem, b: Problem) =>
    ord(a) - ord(b) || (a.patternId < b.patternId ? -1 : a.patternId > b.patternId ? 1 : 0) || compareInPattern(a, b, patterns[a.patternId]);
}

/** Problem id → its 1-based position within its pattern. Computed over all problems, so filters never change it. */
export function patternPositions(problems: Problem[], patterns: Record<string, Pattern>): Map<string, number> {
  const out = new Map<string, number>();
  const sorted = problems.slice().sort(byStudyOrder(patterns));
  let current = '', n = 0;
  for (const p of sorted) {
    if (p.patternId !== current) { current = p.patternId; n = 0; }
    out.set(p.id, ++n);
  }
  return out;
}
