// Lifetime milestones: awarded once, dated by the revision that reached them, never removed.
export interface MilestoneCtx { mastered: number; longest: number }
export interface Milestone { id: string; label: string; test: (c: MilestoneCtx) => boolean }

export const MILESTONES: Milestone[] = [
  { id: 'first-mastered', label: 'First problem mastered', test: c => c.mastered >= 1 },
  { id: 'mastered-50', label: '50 problems mastered', test: c => c.mastered >= 50 },
  { id: 'mastered-100', label: '100 problems mastered', test: c => c.mastered >= 100 },
  { id: 'mastered-250', label: '250 problems mastered', test: c => c.mastered >= 250 },
  { id: 'mastered-500', label: '500 problems mastered', test: c => c.mastered >= 500 },
  { id: 'mastered-1000', label: '1,000 problems mastered', test: c => c.mastered >= 1000 },
  { id: 'streak-7', label: '7-day streak', test: c => c.longest >= 7 },
  { id: 'streak-30', label: '30-day streak', test: c => c.longest >= 30 },
  { id: 'streak-100', label: '100-day streak', test: c => c.longest >= 100 },
  { id: 'streak-365', label: '365-day streak', test: c => c.longest >= 365 },
];

/** Returns the milestone map with any newly reached ones added (dated `date`), or null when nothing changed. */
export function awardMilestones(reached: Record<string, string>, ctx: MilestoneCtx, date: string): Record<string, string> | null {
  let out: Record<string, string> | null = null;
  for (const m of MILESTONES) {
    if (reached[m.id] || !m.test(ctx)) continue;
    out = out ?? { ...reached };
    out[m.id] = date;
  }
  return out;
}
