import React, { useMemo } from 'react';
import { Layers, CalendarCheck, AlertTriangle, Flag, BarChart3, Target, Play, Flame, ArrowRight, CheckCircle2, CalendarDays } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { useData, settingsOf, startSession } from '../lib/store';
import { buildFocus, statusOf, FocusItem, FocusReason } from '../lib/engine';
import { today, fmt, weekday, addDays } from '../lib/dates';
import { streaks, weekDays, countRatings, revisionsByDay } from '../lib/stats';
import { usePalette } from '../lib/theme';
import { Card, CardHeader, Stat, Button, Progress, DiffPill, RatingDot, cx, PageHeader, Empty, LinkButton } from '../components/ui';
import { useApp, QuickRate, PatternTag } from '../components/shared';
import type { Problem, Revision } from '../types';

export const REASON_CLS: Record<FocusReason, string> = {
  'Overdue': 'bg-bad/12 text-bad', 'Due today': 'bg-hot/15 text-hot', 'High priority': 'bg-hot/12 text-hot', 'Weak': 'bg-warn/12 text-warn', 'New': 'bg-none/15 text-muted',
};
export function ReasonChip({ item }: { item: FocusItem }) {
  return <span className={cx('inline-flex rounded-md px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap tabular-nums', REASON_CLS[item.reason])}>
    {item.reason === 'Overdue' ? `Overdue ${item.overdue}d` : item.reason}
  </span>;
}

export function FocusRow({ item, onOpen }: { item: FocusItem; onOpen: (id: string) => void }) {
  const p = item.problem;
  return (
    <li className="flex items-center gap-3 px-4 sm:px-5 py-2.5 hover:bg-surface2/60 transition-colors">
      <RatingDot r={p.lastRating} size={9} />
      <button className="min-w-0 flex-1 text-left" onClick={() => onOpen(p.id)}>
        <div className="text-sm font-semibold text-fg truncate">{p.name}</div>
        <div className="flex flex-wrap items-center gap-1.5 mt-1"><PatternTag id={p.patternId} /><DiffPill d={p.difficulty} /><ReasonChip item={item} /></div>
      </button>
      <div className="hidden sm:block"><LinkButton url={p.url} size="icon" /></div>
      <QuickRate id={p.id} source="today" />
    </li>
  );
}

export function useToday() {
  const d = useData(); const s = settingsOf(d); const t = today();
  return useMemo(() => {
    const problems = Object.values(d.problems);
    const revs = Object.values(d.revisions);
    const focus = buildFocus(problems, d.patterns, s, t);
    const todayRevs = revs.filter(r => r.date === t);
    const doneIds = [...new Set(todayRevs.map(r => r.problemId))];
    return { problems, revs, focus, todayRevs, doneIds, s, t };
  }, [d.problems, d.revisions, d.patterns, d.meta]);
}

export function startTodayRun(items: FocusItem[], go: (r: string) => void) {
  startSession({ kind: 'today', title: "Today's Revision", config: null, problemIds: items.map(i => i.problem.id) });
  go('session');
}

export default function Dashboard() {
  const d = useData(); const pal = usePalette();
  const { go, openProblem } = useApp();
  const { problems, revs, focus, todayRevs, doneIds, s, t } = useToday();

  const counts = useMemo(() => {
    const st = problems.map(p => statusOf(p, s, t));
    const ws = weekDays(t, s.weekStart);
    const weekRevs = revs.filter(r => r.date >= ws[0] && r.date <= ws[6]);
    return {
      total: problems.length, due: st.filter(x => x === 'Due Today').length, overdue: st.filter(x => x === 'Overdue').length,
      high: problems.filter(p => p.priority === 'High' && p.track === 'active').length,
      weekDistinct: new Set(weekRevs.map(r => r.problemId)).size, weekRevs, ws,
      oldest: problems.filter((p, i) => st[i] === 'Overdue').sort((a, b) => (a.nextReview! < b.nextReview! ? -1 : 1))[0] as Problem | undefined,
    };
  }, [problems, revs, s, t]);

  const target = s.dailyTarget;
  const done = doneIds.length;
  const slots = Math.max(target - done, 0);
  const queue = focus.filter(f => !doneIds.includes(f.problem.id));
  const shown = slots > 0 ? queue.slice(0, slots) : queue.slice(0, 3);
  const todayCounts = countRatings(todayRevs);
  const st = streaks(revs, t);
  const byDay = revisionsByDay(counts.weekRevs);
  const week = counts.ws.map(day => {
    const rs = byDay.get(day) ?? []; const c = countRatings(rs);
    return { day: weekday(day), date: day, ...c, total: rs.length };
  });
  const weekTotal = week.reduce((a, x) => a + x.total, 0);
  const weekPct = Math.min(100, Math.round((weekTotal / (target * 7)) * 100));
  const weekC = countRatings(counts.weekRevs);
  const upcoming = Array.from({ length: 7 }, (_, i) => addDays(t, i + 1)).map(day => ({ day, n: problems.filter(p => p.track === 'active' && p.nextReview === day && p.lastRating).length }));

  return (
    <div>
      <PageHeader title="Dashboard" sub="Your revision queue, progress and focus for today."
        right={<div className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-3 h-9 text-sm font-semibold text-fg"><CalendarDays size={15} className="text-accent" />{fmt(t, 'EEE, d MMM yyyy')}</div>} />

      {s.notifyOverdueBanner && counts.overdue > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-bad/35 bg-bad/8 px-4 py-3">
          <div className="flex items-start gap-2.5 text-sm min-w-0">
            <AlertTriangle size={17} className="text-bad shrink-0 mt-0.5" />
            <span className="text-fg"><b className="tabular-nums">{counts.overdue}</b> problems are overdue.
              {counts.oldest && <span className="text-muted"> Oldest: {counts.oldest.name}, due {fmt(counts.oldest.nextReview, 'd MMM')}.</span>}</span>
          </div>
          <Button size="sm" variant="outline" onClick={() => go('practice-overdue')}>Overdue recovery<ArrowRight size={14} /></Button>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 mb-4">
        <Stat label="Total problems" value={counts.total} icon={<Layers size={19} />} onClick={() => go('bank')} />
        <Stat label="Due today" value={counts.due} icon={<CalendarCheck size={19} />} tone="hot" onClick={() => go('today')} />
        <Stat label="Overdue" value={counts.overdue} icon={<AlertTriangle size={19} />} tone="bad" onClick={() => go('today')} />
        <Stat label="High priority" value={counts.high} icon={<Flag size={19} />} tone="hot" onClick={() => go('bank-high')} />
        <Stat className="col-span-2 md:col-span-1" label="Revised this week" value={counts.weekDistinct} icon={<BarChart3 size={19} />} tone="ok" sub={`${weekTotal} revisions`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 flex flex-col min-w-0">
          <CardHeader icon={<Target size={18} />} title="Today's Focus"
            sub={slots > 0 ? `${slots} of ${queue.length} in the queue picked for today` : `Target reached · ${queue.length} more in the queue`}
            right={<Button size="sm" variant="ghost" onClick={() => go('today')}>View all ({queue.length})<ArrowRight size={14} /></Button>} />
          {shown.length === 0 ? (
            <Empty icon={<CheckCircle2 size={28} />} title="Nothing due right now" body="Every active problem is scheduled for later. Start a mixed practice session or add new problems to your study plan in Settings." action={<Button variant="outline" onClick={() => go('practice')}>Mixed practice</Button>} />
          ) : (
            <ul className="divide-y divide-line/70 border-t border-line/70">{shown.map(f => <FocusRow key={f.problem.id} item={f} onOpen={openProblem} />)}</ul>
          )}
          {doneIds.length > 0 && (
            <div className="border-t border-line/70 px-4 sm:px-5 py-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">Done today</div>
              <div className="flex flex-wrap gap-1.5">
                {doneIds.map(id => {
                  const p = d.problems[id]; const last = todayRevs.filter(r => r.problemId === id).sort((a, b) => (a.at < b.at ? 1 : -1))[0];
                  return p ? <button key={id} onClick={() => openProblem(id)} className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface2 px-2 py-1 text-xs text-fg hover:border-accent/50"><RatingDot r={last?.rating ?? null} />{p.name}</button> : null;
                })}
              </div>
            </div>
          )}
          <div className="mt-auto px-4 sm:px-5 pb-4 pt-3">
            <Button variant="primary" size="lg" className="w-full" disabled={queue.length === 0} onClick={() => startTodayRun(slots > 0 ? queue.slice(0, slots) : queue.slice(0, Math.min(queue.length, target)), go)}>
              <Play size={16} />Start today's revision{slots > 0 ? ` (${Math.min(slots, queue.length)})` : ''}
            </Button>
          </div>
        </Card>

        <div className="flex flex-col gap-4 min-w-0">
          <Card className="px-4 sm:px-5 py-4">
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-[15px] font-bold text-fg">Today's Progress</h2>
              <span className="text-sm font-semibold text-muted tabular-nums">{Math.min(100, Math.round((done / Math.max(1, target)) * 100))}%</span>
            </div>
            <div className="mt-1 text-sm text-muted">Target <b className="text-fg tabular-nums">{target}</b> · Completed <b className="text-fg tabular-nums">{done}/{target}</b> · Remaining <b className="text-fg tabular-nums">{Math.max(0, target - done)}</b></div>
            <Progress className="mt-3" value={done / Math.max(1, target)} tone={done >= target ? 'ok' : 'accent'} />
            <div className="grid grid-cols-3 gap-2 mt-4">
              {(['green', 'yellow', 'red'] as const).map(r => (
                <div key={r} className={cx('rounded-lg border px-2 py-2 text-center', r === 'green' ? 'border-ok/30 bg-ok/10' : r === 'yellow' ? 'border-warn/30 bg-warn/10' : 'border-bad/30 bg-bad/10')}>
                  <div className={cx('font-display text-xl font-extrabold tabular-nums', r === 'green' ? 'text-ok' : r === 'yellow' ? 'text-warn' : 'text-bad')}>{todayCounts[r]}</div>
                  <div className="text-[11px] font-semibold text-muted capitalize">{r}</div>
                </div>
              ))}
            </div>
            {s.notifyTargetReminder && done < target && queue.length > 0 && new Date().getHours() >= 18 && (
              <p className="mt-3 text-xs text-hot">Evening reminder: {target - done} left to hit today's target.</p>
            )}
          </Card>
          <Card className="px-4 sm:px-5 py-4 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-hot/12 text-hot shrink-0"><Flame size={24} /></div>
            <div className="min-w-0">
              <div className="text-xs font-medium text-muted">Revision streak</div>
              <div className="font-display text-2xl font-extrabold text-fg tabular-nums leading-tight">{st.current} day{st.current === 1 ? '' : 's'}</div>
              <div className="text-xs text-muted">Longest: {st.longest} days{doneIds.length === 0 && st.current > 0 ? ' · revise today to keep it' : ''}</div>
            </div>
          </Card>
          <Card className="px-4 sm:px-5 py-4">
            <h2 className="font-display text-[15px] font-bold text-fg mb-2">Coming up</h2>
            <div className="grid grid-cols-7 gap-1">
              {upcoming.map(u => (
                <div key={u.day} className="flex flex-col items-center gap-1">
                  <div className="text-[10px] font-semibold text-muted">{weekday(u.day, 'EEEEE')}</div>
                  <div className={cx('w-full rounded-md py-1.5 text-center text-xs font-bold tabular-nums', u.n ? 'bg-accent/15 text-accent' : 'bg-surface2 text-muted')}>{u.n}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <Card className="mt-4">
        <CardHeader icon={<BarChart3 size={18} />} title="This week" sub={`${fmt(counts.ws[0], 'd MMM')} – ${fmt(counts.ws[6], 'd MMM')}`}
          right={<div className="text-right"><div className="font-display text-lg font-extrabold text-fg tabular-nums">{weekPct}%</div><div className="text-[11px] text-muted">of {target * 7} weekly target</div></div>} />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 px-4 sm:px-5 pb-4">
          <div className="md:col-span-3 h-48 min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={week} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={pal.line} strokeDasharray="3 3" />
                <XAxis dataKey="day" tick={{ fill: pal.muted, fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: pal.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: pal.surface2 }} contentStyle={{ background: pal.surface, border: `1px solid ${pal.line}`, borderRadius: 10, color: pal.fg, fontSize: 12 }} />
                <Bar isAnimationActive={false} dataKey="green" stackId="a" fill={pal.ok} name="Green" />
                <Bar isAnimationActive={false} dataKey="yellow" stackId="a" fill={pal.warn} name="Yellow" />
                <Bar isAnimationActive={false} dataKey="red" stackId="a" fill={pal.bad} name="Red" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex md:flex-col gap-2 justify-center">
            {(['green', 'yellow', 'red'] as const).map(r => (
              <div key={r} className="flex-1 md:flex-none flex items-center justify-between gap-2 rounded-lg bg-surface2 px-3 py-2">
                <span className="flex items-center gap-2 text-sm text-muted capitalize"><RatingDot r={r} />{r}</span>
                <span className="font-bold text-fg tabular-nums">{weekC[r]}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}
