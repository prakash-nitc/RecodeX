import React, { useMemo, useState } from 'react';
import { TrendingUp, TrendingDown, Repeat, ArrowUpRight, Flame, Trophy, Layers, CheckCircle2, CircleDashed, Activity, Award } from 'lucide-react';
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart } from 'recharts';
import { useData, settingsOf } from '../lib/store';
import { statusOf } from '../lib/engine';
import { patternStats, streaks, countRatings, weeklySeries, monthlySeries, effectiveness, revisionsByDay } from '../lib/stats';
import { today, addDays, fmt, weekStartOf, diffDays } from '../lib/dates';
import { usePalette } from '../lib/theme';
import { Card, CardHeader, PageHeader, Segmented, Stat, cx, GYRBar, Empty } from '../components/ui';
import { useApp } from '../components/shared';
import { patternRoute } from './Patterns';

export default function Analytics() {
  const d = useData(); const s = settingsOf(d); const pal = usePalette();
  const { openProblem, go } = useApp();
  const [range, setRange] = useState<30 | 90 | 0>(0);
  const t = today();
  const problems = Object.values(d.problems);
  const allRevs = Object.values(d.revisions).filter(r => d.problems[r.problemId]);
  const revs = range ? allRevs.filter(r => diffDays(t, r.date) < range) : allRevs;

  const overall = useMemo(() => {
    const st = problems.map(p => statusOf(p, s, t));
    const attempted = problems.filter(p => p.lastRating || p.revisionCount > 0).length;
    return {
      total: problems.length, attempted, notReviewed: problems.filter(p => !p.lastRating && p.track === 'active').length,
      active: problems.filter(p => p.track === 'active' && p.lastRating).length - st.filter(x => x === 'Mastered').length,
      mastered: st.filter(x => x === 'Mastered').length, backlog: st.filter(x => x === 'Yet to Learn').length,
    };
  }, [d.problems, d.meta]);

  const c = countRatings(revs);
  const totalR = c.green + c.yellow + c.red;
  const pct = (n: number) => (totalR ? Math.round((n / totalR) * 100) : 0);
  const weekly = useMemo(() => weeklySeries(allRevs, 12, s.weekStart, t).map(w => ({ ...w, label: fmt(w.week, 'd MMM') })), [d.revisions, s.weekStart]);
  const monthly = useMemo(() => monthlySeries(allRevs, 6, t).map(m => ({ ...m, label: fmt(`${m.month}-01`, 'MMM') })), [d.revisions]);
  const st = streaks(allRevs, t);

  const pstats = useMemo(() => patternStats(Object.values(d.patterns).sort((a, b) => a.order - b.order), problems, revs, s, t), [d.patterns, d.problems, d.revisions, range, d.meta]);
  const rated = pstats.filter(x => x.reviewed >= 2 && x.avg !== null);
  const ranked = rated.slice().sort((a, b) => b.avg! - a.avg! || b.reviewed - a.reviewed);
  const strongest = ranked.slice(0, Math.min(5, Math.ceil(ranked.length / 2)));
  const weakest = ranked.slice().reverse().slice(0, Math.min(5, Math.floor(ranked.length / 2)));
  const mostOverdue = pstats.filter(x => x.overdue > 0).sort((a, b) => b.overdue - a.overdue).slice(0, 5);
  const redPct = pstats.filter(x => x.redRevs > 0).sort((a, b) => b.redPct - a.redPct || b.redRevs - a.redRevs).slice(0, 5);
  const eff = useMemo(() => effectiveness(revs), [revs]);

  // heatmap: 20 weeks, columns = weeks
  const heat = useMemo(() => {
    const byDay = revisionsByDay(allRevs);
    const start = addDays(weekStartOf(t, s.weekStart), -7 * 19);
    return Array.from({ length: 20 }, (_, w) => Array.from({ length: 7 }, (_, i) => { const day = addDays(start, w * 7 + i); return { day, n: day > t ? -1 : (byDay.get(day)?.length ?? 0) }; }));
  }, [d.revisions, s.weekStart]);
  const heatMax = Math.max(1, ...heat.flat().map(x => x.n));
  const heatCls = (n: number) => n < 0 ? 'bg-transparent' : n === 0 ? 'bg-surface2' : n / heatMax < 0.34 ? 'bg-accent/30' : n / heatMax < 0.67 ? 'bg-accent/60' : 'bg-accent';
  const tip = { contentStyle: { background: pal.surface, border: `1px solid ${pal.line}`, borderRadius: 10, color: pal.fg, fontSize: 12 }, cursor: { fill: pal.surface2 } };
  const thisWeek = weekly[weekly.length - 1]?.total ?? 0;
  const thisMonth = monthly[monthly.length - 1]?.total ?? 0;
  const todayCount = allRevs.filter(r => r.date === t).length;

  const ProbList = ({ ids, empty }: { ids: string[]; empty: string }) => ids.length === 0 ? <p className="text-sm text-muted px-1 py-2">{empty}</p> : (
    <ul className="flex flex-col">{ids.slice(0, 8).map(id => { const p = d.problems[id]; return p ? <li key={id}><button onClick={() => openProblem(id)} className="w-full flex items-center justify-between gap-2 rounded-md px-1.5 py-1.5 text-left text-sm hover:bg-surface2"><span className="truncate text-fg">{p.name}</span><span className="text-[11px] text-muted shrink-0">{d.patterns[p.patternId]?.name}</span></button></li> : null; })}
      {ids.length > 8 && <li className="text-xs text-muted px-1.5 pt-1">and {ids.length - 8} more</li>}</ul>
  );
  const PatList = ({ rows, value, tone }: { rows: typeof pstats; value: (x: (typeof pstats)[number]) => string; tone: string }) => rows.length === 0 ? <p className="text-sm text-muted py-2">Not enough data yet.</p> : (
    <ul className="flex flex-col gap-1">{rows.map(x => (
      <li key={x.pattern.id}><button onClick={() => go(patternRoute(x.pattern.id))} className="w-full flex items-center justify-between gap-2 rounded-md px-1.5 py-1.5 text-left text-sm hover:bg-surface2">
        <span className="truncate text-fg">{x.pattern.name}</span><span className={cx('rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums shrink-0', tone)}>{value(x)}</span>
      </button></li>))}</ul>
  );

  return (
    <div>
      <PageHeader title="Analytics" sub="Computed from your stored problems and revision records."
        right={<Segmented ariaLabel="Range" value={range} onChange={setRange} options={[{ value: 30, label: '30 days' }, { value: 90, label: '90 days' }, { value: 0, label: 'All time' }]} />} />

      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">Overall progress</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
        <Stat label="Total problems" value={overall.total} icon={<Layers size={18} />} />
        <Stat label="Attempted" value={overall.attempted} icon={<Activity size={18} />} sub={`at least once · ${overall.total ? Math.round((overall.attempted / overall.total) * 100) : 0}%`} />
        <Stat label="Not reviewed" value={overall.notReviewed} icon={<CircleDashed size={18} />} tone="warn" sub="never rated" />
        <Stat label="In revision" value={overall.active} icon={<Repeat size={18} />} tone="accent" />
        <Stat label="Mastered" value={overall.mastered} icon={<Award size={18} />} tone="ok" sub={`${s.masteryStreak}+ greens`} />
        <Stat label="Yet to learn" value={overall.backlog} icon={<CheckCircle2 size={18} />} sub="held in backlog" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-6">
        <Card className="p-4 sm:p-5">
          <h2 className="font-display font-bold text-fg">Ratings {range ? `· last ${range} days` : '· all time'}</h2>
          <p className="text-xs text-muted mb-3">{totalR} revision records</p>
          <GYRBar g={c.green} y={c.yellow} r={c.red} height={12} />
          <div className="grid grid-cols-3 gap-2 mt-4">
            {(['green', 'yellow', 'red'] as const).map(r => (
              <div key={r} className="rounded-lg bg-surface2 px-3 py-2.5">
                <div className="text-[11px] font-semibold text-muted capitalize">Total {r}</div>
                <div className={cx('font-display text-2xl font-extrabold tabular-nums', r === 'green' ? 'text-ok' : r === 'yellow' ? 'text-warn' : 'text-bad')}>{c[r]}</div>
                <div className="text-[11px] text-muted tabular-nums">{pct(c[r])}%</div>
              </div>
            ))}
          </div>
        </Card>
        <Card className="xl:col-span-2 min-w-0">
          <CardHeader title="Green percentage over time" sub="Weekly revisions (bars) and the share rated Green (line), last 12 weeks" />
          <div className="h-56 px-2 pb-3">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={weekly} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={pal.line} strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fill: pal.muted, fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis yAxisId="n" allowDecimals={false} tick={{ fill: pal.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="p" orientation="right" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fill: pal.muted, fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
                <Tooltip {...tip} formatter={(v: any, k: any) => (k === 'Green %' ? `${v}%` : v)} />
                <Bar isAnimationActive={false} yAxisId="n" dataKey="total" name="Revisions" fill={pal.accent} fillOpacity={0.35} radius={[4, 4, 0, 0]} />
                <Line yAxisId="p" dataKey="greenPct" name="Green %" stroke={pal.ok} strokeWidth={2.5} dot={{ r: 3, fill: pal.ok, strokeWidth: 0 }} connectNulls isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">Patterns</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
        <Card className="p-4"><div className="flex items-center gap-2 mb-2"><Trophy size={16} className="text-ok" /><h3 className="font-bold text-fg text-sm">Strongest</h3></div><PatList rows={strongest} value={x => `${x.avg!.toFixed(2)} avg`} tone="bg-ok/15 text-ok" /></Card>
        <Card className="p-4"><div className="flex items-center gap-2 mb-2"><TrendingDown size={16} className="text-bad" /><h3 className="font-bold text-fg text-sm">Weakest</h3></div><PatList rows={weakest} value={x => `${x.avg!.toFixed(2)} avg`} tone="bg-bad/12 text-bad" /></Card>
        <Card className="p-4"><div className="flex items-center gap-2 mb-2"><Flame size={16} className="text-hot" /><h3 className="font-bold text-fg text-sm">Most overdue</h3></div><PatList rows={mostOverdue} value={x => `${x.overdue} overdue`} tone="bg-hot/15 text-hot" /></Card>
        <Card className="p-4"><div className="flex items-center gap-2 mb-2"><TrendingDown size={16} className="text-bad" /><h3 className="font-bold text-fg text-sm">Highest Red share</h3></div><PatList rows={redPct} value={x => `${Math.round(x.redPct * 100)}% red`} tone="bg-bad/12 text-bad" /></Card>
      </div>
      <Card className="mb-6">
        <CardHeader title="Pattern mastery" sub="Share of each pattern's problems by last rating (grey = not reviewed). Average uses Green 3, Yellow 2, Red 1." />
        <div className="px-4 sm:px-5 pb-5 grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-3">
          {pstats.map(x => (
            <button key={x.pattern.id} onClick={() => go(patternRoute(x.pattern.id))} className="grid grid-cols-[minmax(0,10rem)_1fr_3.5rem] items-center gap-3 text-left group">
              <span className="text-sm text-fg truncate group-hover:text-accent">{x.pattern.name}</span>
              <GYRBar g={x.g} y={x.y} r={x.r} n={x.notReviewed} height={10} />
              <span className="text-xs text-muted text-right tabular-nums">{x.avg !== null ? x.avg.toFixed(2) : '—'}</span>
            </button>
          ))}
        </div>
      </Card>

      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">Consistency</h2>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        <Stat label="Today" value={todayCount} sub="revisions" />
        <Stat label="This week" value={thisWeek} sub="revisions" />
        <Stat label="This month" value={thisMonth} sub="revisions" />
        <Stat label="Current streak" value={`${st.current}d`} tone="hot" icon={<Flame size={18} />} />
        <Stat label="Longest streak" value={`${st.longest}d`} tone="ok" icon={<Trophy size={18} />} sub={`${st.activeDays} active days`} />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 mb-6">
        <Card className="xl:col-span-3 p-4 sm:p-5 min-w-0">
          <h3 className="font-display font-bold text-fg">Daily revisions · last 20 weeks</h3>
          <p className="text-xs text-muted mb-3">Each square is a day. Darker means more revisions (max {heatMax}).</p>
          <div className="overflow-x-auto">
            <div className="inline-flex gap-[3px]">
              <div className="flex flex-col gap-[3px] mr-1 text-[9px] text-muted">
                {heat[0].map((c, i) => <div key={i} className="h-3.5 leading-[14px]">{i % 2 === 0 ? fmt(c.day, 'EEEEE') : ''}</div>)}
              </div>
              {heat.map((col, w) => (
                <div key={w} className="flex flex-col gap-[3px]">
                  {col.map(c => <div key={c.day} title={c.n >= 0 ? `${fmt(c.day, 'EEE d MMM')}: ${c.n} revision${c.n === 1 ? '' : 's'}` : ''} className={cx('h-3.5 w-3.5 rounded-[3px]', heatCls(c.n), c.day === t && 'ring-2 ring-hot')} />)}
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1.5 mt-3 text-[11px] text-muted">Less{['bg-surface2', 'bg-accent/30', 'bg-accent/60', 'bg-accent'].map(x => <span key={x} className={cx('h-3 w-3 rounded-[3px]', x)} />)}More</div>
        </Card>
        <Card className="xl:col-span-2 min-w-0">
          <CardHeader title="Monthly revisions" sub="Last 6 months" />
          <div className="h-48 px-2 pb-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly} margin={{ top: 6, right: 8, left: -22, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={pal.line} strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fill: pal.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: pal.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip {...tip} />
                <Bar isAnimationActive={false} dataKey="total" name="Revisions" fill={pal.accent} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">Revision effectiveness {range ? `· last ${range} days` : ''}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card className="p-4"><div className="flex items-center justify-between mb-2"><h3 className="flex items-center gap-2 font-bold text-fg text-sm"><Repeat size={15} className="text-bad" />Repeated Red</h3><span className="font-bold text-bad tabular-nums">{eff.repeatedRed.length}</span></div><ProbList ids={eff.repeatedRed} empty="No problem has been Red twice." /></Card>
        <Card className="p-4"><div className="flex items-center justify-between mb-2"><h3 className="flex items-center gap-2 font-bold text-fg text-sm"><ArrowUpRight size={15} className="text-warn" />Red → Yellow</h3><span className="font-bold text-warn tabular-nums">{eff.redToYellow.length}</span></div><ProbList ids={eff.redToYellow} empty="None yet." /></Card>
        <Card className="p-4"><div className="flex items-center justify-between mb-2"><h3 className="flex items-center gap-2 font-bold text-fg text-sm"><TrendingUp size={15} className="text-ok" />Yellow → Green</h3><span className="font-bold text-ok tabular-nums">{eff.yellowToGreen.length}</span></div><ProbList ids={eff.yellowToGreen} empty="None yet." /></Card>
        <Card className="p-4"><div className="flex items-center justify-between mb-2"><h3 className="flex items-center gap-2 font-bold text-fg text-sm"><TrendingDown size={15} className="text-bad" />Regressed from Green</h3><span className="font-bold text-bad tabular-nums">{eff.regressed.length}</span></div><ProbList ids={eff.regressed} empty="No regressions." /></Card>
      </div>
      {allRevs.length === 0 && <Card className="mt-4"><Empty title="No revision records yet" body="Charts fill in as you record revisions." /></Card>}
    </div>
  );
}
