import React, { useMemo } from 'react';
import { Play, CheckCircle2, ListChecks } from 'lucide-react';
import { Card, CardHeader, Button, PageHeader, Empty, RatingPill, cx } from '../components/ui';
import { useApp } from '../components/shared';
import { useToday, FocusRow, startTodayRun } from './Dashboard';
import { useData } from '../lib/store';
import type { FocusReason } from '../lib/engine';
import { fmt } from '../lib/dates';

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

  return (
    <div>
      <PageHeader title="Today's Revision" sub={`${queue.length} problems in the queue · ${doneIds.length} of ${s.dailyTarget} done today`}
        right={<>
          <Button variant="outline" disabled={!queue.length} onClick={() => startTodayRun(queue, go)}><ListChecks size={16} />Run whole queue ({queue.length})</Button>
          <Button variant="primary" disabled={!queue.length} onClick={() => startTodayRun(queue.slice(0, slots || Math.min(queue.length, s.dailyTarget)), go)}><Play size={16} />Start ({Math.min(queue.length, slots || s.dailyTarget)})</Button>
        </>} />
      <p className="text-sm text-muted -mt-2 mb-5 max-w-2xl">Rate a problem straight from the list with the three dots, or start a guided run that shows one problem at a time with a timer.</p>
      {queue.length === 0 && (
        <Card className="mb-4"><Empty icon={<CheckCircle2 size={28} />} title="Queue is clear" body="Nothing is due. You can still practice with a mixed session." action={<Button variant="outline" onClick={() => go('practice')}>Mixed practice</Button>} /></Card>
      )}
      <div className="flex flex-col gap-4">
        {GROUPS.map(g => {
          const items = queue.filter(f => f.reason === g.reason);
          if (!items.length) return null;
          return (
            <Card key={g.reason}>
              <CardHeader title={<span>{g.title} <span className="text-muted font-semibold tabular-nums">· {items.length}</span></span>} sub={g.sub} />
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
                      <div className="text-xs text-muted">{r.mistake ? `Mistake: ${r.mistake}` : 'No mistake noted'}</div>
                    </button>
                    <div className="flex items-center gap-2 shrink-0"><RatingPill r={r.rating} /><span className={cx('text-xs text-muted hidden sm:inline')}>next {fmt(r.nextReview, 'd MMM')}</span></div>
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
