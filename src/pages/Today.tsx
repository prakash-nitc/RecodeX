import React, { useMemo } from 'react';
import { Play, ListChecks, Focus, CalendarCheck } from 'lucide-react';
import { Card, CardHeader, Button, PageHeader, Empty, RatingPill, Progress, cx } from '../components/ui';
import { useApp } from '../components/shared';
import { MountainScene } from '../components/art/Mountains';
import { useToday, FocusRow, startTodayRun } from './Dashboard';
import { useData } from '../lib/store';
import type { FocusReason } from '../lib/engine';
import { fmt, today } from '../lib/dates';

const GROUPS: { reason: FocusReason; title: string; sub: string }[] = [
  { reason: 'Overdue', title: 'Overdue', sub: 'Past their review date. They stay here until you revise them.' },
  { reason: 'Due today', title: 'Due today', sub: 'Scheduled for today.' },
  { reason: 'High priority', title: 'High priority', sub: 'Marked High and not revised today.' },
  { reason: 'Weak', title: 'Weak problems', sub: 'Last rated Red or Yellow, scheduled later. Revising early is fine.' },
  { reason: 'New', title: 'New from your study plan', sub: 'Never-reviewed problems added by the "new per day" setting.' },
];

export default function Today() {
  const d = useData();
  const { go, openProblem } = useApp();
  const { focus, todayRevs, doneIds, s } = useToday();
  const queue = focus.filter(f => !doneIds.includes(f.problem.id));
  const slots = Math.max(s.dailyTarget - doneIds.length, 0);
  const doneSorted = useMemo(() => todayRevs.slice().sort((a, b) => (a.at < b.at ? 1 : -1)), [todayRevs]);
  const startCount = Math.min(queue.length, slots || s.dailyTarget);
  const done = doneIds.length;

  return (
    <div>
      <PageHeader eyebrow={<span className="inline-flex items-center gap-1.5"><CalendarCheck size={13} />{fmt(today(), 'EEEE, d MMMM')}</span>}
        title="Today's Revision" sub={`${queue.length} problems in the queue · ${done} of ${s.dailyTarget} done today`} />

      {/* Focus mode: the primary action */}
      <section className="mb-5 grid grid-cols-1 gap-4 overflow-hidden rounded-3xl border border-line bg-surface shadow-card md:grid-cols-[1fr_auto]">
        <div className="p-5 sm:p-6">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-muted"><Focus size={13} />Focus mode</div>
          <h2 className="mt-1.5 font-display text-2xl font-semibold text-fg">One problem at a time, with a timer.</h2>
          <p className="mt-1 text-sm text-muted max-w-xl">A calm, full-screen run through today's queue. Rate each one with 1, 2 or 3, then move on.</p>
          <div className="mt-4 flex items-center gap-3 max-w-md">
            <Progress value={done / Math.max(1, s.dailyTarget)} tone={done >= s.dailyTarget ? 'ok' : 'accent'} />
            <span className="text-xs text-muted tabular-nums whitespace-nowrap">{done}/{s.dailyTarget} today</span>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button variant="primary" size="lg" disabled={!queue.length} onClick={() => startTodayRun(queue.slice(0, startCount), go)}><Play size={16} />Start focus mode{startCount ? ` · ${startCount}` : ''}</Button>
            <Button variant="outline" size="lg" disabled={!queue.length} onClick={() => startTodayRun(queue, go)}><ListChecks size={16} />Run whole queue ({queue.length})</Button>
          </div>
        </div>
        <div className="relative hidden md:block w-[300px]"><MountainScene className="absolute inset-0 h-full w-full" /></div>
      </section>

      <p className="text-sm text-muted mb-4 max-w-2xl">Or rate a problem straight from the list with the three dots.</p>
      {queue.length === 0 && (
        <Card className="mb-4"><Empty art={<MountainScene className="h-32 w-full" />} title="Queue is clear" body="Nothing is due. You can still practice with a mixed session." action={<Button variant="outline" onClick={() => go('practice')}>Mixed practice</Button>} /></Card>
      )}
      <div className="flex flex-col gap-4">
        {GROUPS.map(g => {
          const items = queue.filter(f => f.reason === g.reason);
          if (!items.length) return null;
          return (
            <Card key={g.reason}>
              <CardHeader title={<span>{g.title} <span className={cx('font-semibold tabular-nums', g.reason === 'Overdue' ? 'text-hot-ink' : 'text-muted')}>· {items.length}</span></span>} sub={g.sub} />
              <ul className="divide-y divide-line/70 border-t border-line/70">{items.map(f => <FocusRow key={f.problem.id} item={f} onOpen={openProblem} />)}</ul>
            </Card>
          );
        })}
        {doneSorted.length > 0 && (
          <Card>
            <CardHeader title={<span>Done today <span className="text-muted font-semibold tabular-nums">· {doneSorted.length}</span></span>} />
            <ul className="divide-y divide-line/70 border-t border-line/70">
              {doneSorted.map(r => {
                const p = d.problems[r.problemId]; if (!p) return null;
                return (
                  <li key={r.id} className="flex items-center justify-between gap-3 px-4 sm:px-5 py-2.5">
                    <button className="min-w-0 text-left" onClick={() => openProblem(p.id)}>
                      <div className="text-sm font-semibold text-fg truncate">{p.name}</div>
                      <div className="text-xs text-muted truncate">{r.mistake ? `Mistake: ${r.mistake}` : 'No mistake noted'}</div>
                    </button>
                    <div className="flex items-center gap-2 shrink-0"><RatingPill r={r.rating} /><span className="text-xs text-muted hidden sm:inline">next {fmt(r.nextReview, 'd MMM')}</span></div>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}
