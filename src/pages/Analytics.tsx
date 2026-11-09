import React, { useMemo, useState } from 'react';
import { TrendingUp, TrendingDown, Repeat, ArrowUpRight, Trophy, Layers, CheckCircle2, CircleDashed, Activity, Award, Sparkles, Target, Calendar } from 'lucide-react';
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart } from 'recharts';
import { useData, settingsOf } from '../lib/store';
import { statusOf } from '../lib/engine';
import { patternStats, streaks, countRatings, weeklySeries, monthlySeries, effectiveness, revisionsByDay, isMastered } from '../lib/stats';
import { today, addDays, fmt, weekStartOf, diffDays } from '../lib/dates';
import { usePalette, chartTheme } from '../lib/theme';
import { Card, CardHeader, PageHeader, Segmented, Stat, cx, GYRBar, Empty, Ring, Flame, Progress } from '../components/ui';
import { useApp } from '../components/shared';
import { patternRoute } from './Patterns';
import type { Settings } from '../types';

// ---------------------------------------------------------------------------
// Milestone definitions
const MILESTONES: { id: string; label: string; test: (ctx: MCtx) => boolean }[] = [
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
interface MCtx { mastered: number; longest: number; patternMastery: Map<string, boolean> }

function MilestonesList({ milestones }: { milestones: Record<string, string>; }) {
  const reached = MILESTONES.filter(m => milestones[m.id]);
  const upcoming = MILESTONES.filter(m => !milestones[m.id]);
  return (
    <div className="flex flex-col gap-2">
      {reached.length === 0 && <p className="text-sm text-muted py-2">No milestones reached yet. Keep going — the first comes when you master a problem.</p>}
      {reached.map(m => (
        <div key={m.id} className="flex items-center gap-3 rounded-xl border border-ok/30 bg-ok/8 px-3.5 py-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ok/20"><Trophy size={14} className="text-ok-ink" /></span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-fg">{m.label}</div>
            <div className="text-[11px] text-muted tabular-nums">{fmt(milestones[m.id], 'd MMM yyyy')}</div>
          </div>
        </div>
      ))}
      {upcoming.slice(0, 3).map(m => (
        <div key={m.id} className="flex items-center gap-3 rounded-xl border border-dashed border-line px-3.5 py-2.5 opacity-60">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface2"><Target size={14} className="text-muted" /></span>
          <div className="text-sm text-muted">{m.label}</div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 52-week heatmap

function Heatmap({ revs, weekStart, t, pal }: { revs: import('../types').Revision[]; weekStart: 0 | 1; t: string; pal: ReturnType<typeof usePalette> }) {
  const { heat, heatMax, weeks } = useMemo(() => {
    const byDay = revisionsByDay(revs);
    const start = addDays(weekStartOf(t, weekStart), -7 * 51);
    const h = Array.from({ length: 52 }, (_, w) =>
      Array.from({ length: 7 }, (_, i) => {
        const day = addDays(start, w * 7 + i);
        return { day, n: day > t ? -1 : (byDay.get(day)?.length ?? 0) };
      }),
    );
    return { heat: h, heatMax: Math.max(1, ...h.flat().map(x => x.n)), weeks: 52 };
  }, [revs, weekStart, t]);

  const heatCls = (n: number) =>
    n < 0 ? 'bg-transparent' : n === 0 ? 'bg-surface2' : n / heatMax < 0.25 ? 'bg-accent/25' : n / heatMax < 0.5 ? 'bg-accent/45' : n / heatMax < 0.75 ? 'bg-accent/70' : 'bg-accent';

  // Month labels above columns
  const monthLabels = useMemo(() => {
    const start = addDays(weekStartOf(t, weekStart), -7 * 51);
    const labels: { col: number; label: string }[] = [];
    let lastMonth = '';
    for (let w = 0; w < weeks; w++) {
      const day = addDays(start, w * 7);
      const m = fmt(day, 'MMM');
      if (m !== lastMonth) { labels.push({ col: w, label: m }); lastMonth = m; }
    }
    return labels;
  }, [t, weekStart, weeks]);

  return (
    <div className="overflow-x-auto scroll-thin">
      {/* Month labels */}
      <div className="inline-flex gap-[3px] mb-1 ml-[26px]">
        {Array.from({ length: weeks }, (_, w) => {
          const label = monthLabels.find(l => l.col === w);
          return <div key={w} className="w-[13px] text-[9px] text-muted leading-none">{label?.label ?? ''}</div>;
        })}
      </div>
      <div className="inline-flex gap-[3px]">
        <div className="flex flex-col gap-[3px] mr-0.5 text-[9px] text-muted">
          {heat[0]?.map((c, i) => (
            <div key={i} className="h-[13px] w-[20px] leading-[13px]">{i % 2 === 0 ? fmt(c.day, 'EEEEE') : ''}</div>
          ))}
        </div>
        {heat.map((col, w) => (
          <div key={w} className="flex flex-col gap-[3px]">
            {col.map(c => (
              <div
                key={c.day}
                title={c.n >= 0 ? `${fmt(c.day, 'EEE d MMM')}: ${c.n} revision${c.n === 1 ? '' : 's'}` : ''}
                className={cx('h-[13px] w-[13px] rounded-[3px]', heatCls(c.n), c.day === t && 'ring-2 ring-hot')}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1.5 mt-3 text-[11px] text-muted">
        Less
        {['bg-surface2', 'bg-accent/25', 'bg-accent/45', 'bg-accent/70', 'bg-accent'].map(x => (
          <span key={x} className={cx('h-3 w-3 rounded-[3px]', x)} />
        ))}
        More
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Analytics page

export default function Analytics() {
  const d = useData(); const s = settingsOf(d); const pal = usePalette();
  const { openProblem, go } = useApp();
  const [range, setRange] = useState<7 | 30 | 90 | 365 | 0>(0);
  const t = today();
  const problems = Object.values(d.problems);
  const allRevs = Object.values(d.revisions).filter(r => d.problems[r.problemId]);
  const revs = range ? allRevs.filter(r => diffDays(t, r.date) < range) : allRevs;

  const overall = useMemo(() => {
    const st = problems.map(p => statusOf(p, s, t));
    const attempted = problems.filter(p => p.lastRating || p.revisionCount > 0).length;
    const mastered = problems.filter(p => isMastered(p, s)).length;
    return {
      total: problems.length, attempted,
      notReviewed: problems.filter(p => !p.lastRating && p.track === 'active').length,
      active: problems.filter(p => p.track === 'active' && p.lastRating).length - mastered,
      mastered,
      backlog: st.filter(x => x === 'Yet to Learn').length,
      overdue: st.filter(x => x === 'Overdue').length,
      due: st.filter(x => x === 'Due Today').length,
    };
  }, [d.problems, d.meta]);

  const c = countRatings(revs);
  const totalR = c.green + c.yellow + c.red;
  const pct = (n: number) => (totalR ? Math.round((n / totalR) * 100) : 0);
  const weekly = useMemo(() => weeklySeries(allRevs, 12, s.weekStart, t).map(w => ({ ...w, label: fmt(w.week, 'd MMM') })), [d.revisions, s.weekStart]);
  const monthly = useMemo(() => monthlySeries(allRevs, 6, t).map(m => ({ ...m, label: fmt(`${m.month}-01`, 'MMM') })), [d.revisions]);
  const st = streaks(allRevs, t);
  const ct = chartTheme(pal);

  const pstats = useMemo(() => patternStats(Object.values(d.patterns).sort((a, b) => a.order - b.order), problems, revs, s, t), [d.patterns, d.problems, d.revisions, range, d.meta]);
  const rated = pstats.filter(x => x.reviewed >= 2 && x.avg !== null);
  const ranked = rated.slice().sort((a, b) => b.avg! - a.avg! || b.reviewed - a.reviewed);
  const strongest = ranked.slice(0, Math.min(5, Math.ceil(ranked.length / 2)));
  const weakest = ranked.slice().reverse().slice(0, Math.min(5, Math.floor(ranked.length / 2)));
  const mostOverdue = pstats.filter(x => x.overdue > 0).sort((a, b) => b.overdue - a.overdue).slice(0, 5);
  const redPct = pstats.filter(x => x.redRevs > 0).sort((a, b) => b.redPct - a.redPct || b.redRevs - a.redRevs).slice(0, 5);
  const eff = useMemo(() => effectiveness(revs), [revs]);

  const tip = { contentStyle: { background: pal.surface, border: `1px solid ${pal.line}`, borderRadius: 12, color: pal.fg, fontSize: 12, boxShadow: '0 12px 28px -12px rgba(0,0,0,.25)' }, labelStyle: { color: pal.muted, fontWeight: 600, marginBottom: 2 }, cursor: { fill: pal.surface2 } };
  const thisWeek = weekly[weekly.length - 1]?.total ?? 0;
  const thisMonth = monthly[monthly.length - 1]?.total ?? 0;
  const todayCount = allRevs.filter(r => r.date === t).length;
  const masteryPct = overall.total ? overall.mastered / overall.total : 0;

  const ProbList = ({ ids, empty }: { ids: string[]; empty: string }) => ids.length === 0 ? <p className="text-sm text-muted px-1 py-2">{empty}</p> : (
    <ul className="flex flex-col">{ids.slice(0, 8).map(id => { const p = d.problems[id]; return p ? <li key={id}><button onClick={() => openProblem(id)} className="w-full flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-surface2 transition-colors"><span className="truncate text-fg">{p.name}</span><span className="text-[11px] text-muted shrink-0">{d.patterns[p.patternId]?.name}</span></button></li> : null; })}
      {ids.length > 8 && <li className="text-xs text-muted px-2 pt-1">and {ids.length - 8} more</li>}</ul>
  );
  const PatList = ({ rows, value, tone }: { rows: typeof pstats; value: (x: (typeof pstats)[number]) => string; tone: string }) => rows.length === 0 ? <p className="text-sm text-muted py-2">Not enough data yet.</p> : (
    <ul className="flex flex-col gap-1">{rows.map(x => (
      <li key={x.pattern.id}><button onClick={() => go(patternRoute(x.pattern.id))} className="w-full flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-surface2 transition-colors">
        <span className="truncate text-fg">{x.pattern.name}</span><span className={cx('rounded-lg px-1.5 py-0.5 text-[11px] font-semibold tabular-nums shrink-0', tone)}>{value(x)}</span>
      </button></li>))}</ul>
  );

  return (
    <div>
      <PageHeader eyebrow={<span className="inline-flex items-center gap-1.5"><Activity size={13} />Insights</span>} title="Analytics" sub="Your revision journey in numbers. Charts fill as you practice."
        right={<Segmented ariaLabel="Range" value={range} onChange={setRange} options={[{ value: 7, label: '7d' }, { value: 30, label: '30d' }, { value: 90, label: '90d' }, { value: 365, label: '1y' }, { value: 0, label: 'All' }]} />} />

      {/* Lifetime mastery ring + overall stats */}
      <div className="grid grid-cols-1 xl:grid-cols-[auto_1fr] gap-4 mb-6">
        <Card className="flex items-center gap-6 p-5 sm:p-6">
          <Ring value={masteryPct} size={120} stroke={12} tone="sunrise" label={`${Math.round(masteryPct * 100)}% mastered`}>
            <span className="font-display text-2xl font-semibold text-fg tabular-nums leading-none">{Math.round(masteryPct * 100)}%</span>
            <span className="mt-1 text-[10px] font-bold uppercase tracking-[0.1em] text-muted">mastered</span>
          </Ring>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
            {[
              ['Total', overall.total, ''],
              ['Attempted', overall.attempted, ''],
              ['Mastered', overall.mastered, 'text-ok-ink'],
              ['In revision', overall.active, ''],
              ['Not reviewed', overall.notReviewed, overall.notReviewed ? 'text-warn-ink' : ''],
              ['Overdue', overall.overdue, overall.overdue ? 'text-hot-ink' : ''],
            ].map(([k, v, c]) => (
              <div key={k as string}>
                <div className="text-[11px] text-muted">{k as string}</div>
                <div className={cx('font-display text-xl font-semibold tabular-nums text-fg leading-tight', c as string)}>{v as number}</div>
              </div>
            ))}
          </div>
        </Card>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          <Stat label="Today" value={todayCount} sub="revisions" icon={<Calendar size={18} />} />
          <Stat label="This week" value={thisWeek} sub="revisions" />
          <Stat label="This month" value={thisMonth} sub="revisions" />
          <Stat label="Current streak" value={`${st.current}d`} tone="hot" icon={<Flame size={18} />} />
          <Stat label="Longest streak" value={`${st.longest}d`} tone="ok" icon={<Trophy size={18} />} sub={`${st.activeDays} active days`} />
        </div>
      </div>

      {/* Ratings + Weekly chart */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-6">
        <Card className="p-4 sm:p-5">
          <h2 className="font-display font-bold text-fg">Ratings {range ? `· last ${range === 365 ? 'year' : `${range} days`}` : '· all time'}</h2>
          <p className="text-xs text-muted mb-3">{totalR} revision records</p>
          <GYRBar g={c.green} y={c.yellow} r={c.red} height={12} />
          <div className="grid grid-cols-3 gap-2 mt-4">
            {(['green', 'yellow', 'red'] as const).map(r => (
              <div key={r} className="rounded-xl bg-surface2 px-3 py-2.5">
                <div className="text-[11px] font-semibold text-muted capitalize">Total {r}</div>
                <div className={cx('font-display text-2xl font-extrabold tabular-nums', r === 'green' ? 'text-ok-ink' : r === 'yellow' ? 'text-warn-ink' : 'text-bad-ink')}>{c[r]}</div>
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
                <CartesianGrid {...ct.grid} />
                <XAxis dataKey="label" {...ct.axis} interval="preserveStartEnd" />
                <YAxis yAxisId="n" allowDecimals={false} {...ct.axis} />
                <YAxis yAxisId="p" orientation="right" domain={[0, 100]} tickFormatter={v => `${v}%`} {...ct.axis} width={40} />
                <Tooltip {...tip} formatter={(v: any, k: any) => (k === 'Green %' ? `${v}%` : v)} />
                <Bar isAnimationActive={false} yAxisId="n" dataKey="total" name="Revisions" fill={pal.accent} fillOpacity={0.35} radius={[4, 4, 0, 0]} />
                <Line yAxisId="p" dataKey="greenPct" name="Green %" stroke={pal.ok} strokeWidth={2.5} dot={{ r: 3, fill: pal.ok, strokeWidth: 0 }} connectNulls isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* 52-week heatmap + monthly chart */}
      <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted mb-2.5">Consistency · 52-week heatmap</h2>
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 mb-6">
        <Card className="xl:col-span-3 p-4 sm:p-5 min-w-0">
          <h3 className="font-display font-bold text-fg mb-0.5">Daily revisions</h3>
          <p className="text-xs text-muted mb-3">Each square is a day. Darker means more revisions (max {useMemo(() => { const byDay = revisionsByDay(allRevs); const start = addDays(weekStartOf(t, s.weekStart), -7 * 51); return Math.max(1, ...Array.from({ length: 52 * 7 }, (_, i) => { const day = addDays(start, i); return day > t ? 0 : (byDay.get(day)?.length ?? 0); })); }, [d.revisions, s.weekStart])}).</p>
          <Heatmap revs={allRevs} weekStart={s.weekStart} t={t} pal={pal} />
        </Card>
        <Card className="xl:col-span-2 min-w-0">
          <CardHeader title="Monthly revisions" sub="Last 6 months" />
          <div className="h-48 px-2 pb-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly} margin={{ top: 6, right: 8, left: -22, bottom: 0 }}>
                <CartesianGrid {...ct.grid} />
                <XAxis dataKey="label" {...ct.axis} />
                <YAxis allowDecimals={false} {...ct.axis} />
                <Tooltip {...tip} />
                <Bar isAnimationActive={false} dataKey="total" name="Revisions" fill={pal.accent} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Pattern comparisons */}
      <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted mb-2.5">Pattern comparisons</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
        <Card className="p-4"><div className="flex items-center gap-2 mb-2"><Trophy size={16} className="text-ok-ink" /><h3 className="font-bold text-fg text-sm">Strongest</h3></div><PatList rows={strongest} value={x => `${x.avg!.toFixed(2)} avg`} tone="bg-ok/15 text-ok-ink" /></Card>
        <Card className="p-4"><div className="flex items-center gap-2 mb-2"><TrendingDown size={16} className="text-bad-ink" /><h3 className="font-bold text-fg text-sm">Weakest</h3></div><PatList rows={weakest} value={x => `${x.avg!.toFixed(2)} avg`} tone="bg-bad/12 text-bad-ink" /></Card>
        <Card className="p-4"><div className="flex items-center gap-2 mb-2"><Flame size={16} /><h3 className="font-bold text-fg text-sm">Most overdue</h3></div><PatList rows={mostOverdue} value={x => `${x.overdue} overdue`} tone="bg-hot/15 text-hot-ink" /></Card>
        <Card className="p-4"><div className="flex items-center gap-2 mb-2"><TrendingDown size={16} className="text-bad-ink" /><h3 className="font-bold text-fg text-sm">Highest Red share</h3></div><PatList rows={redPct} value={x => `${Math.round(x.redPct * 100)}% red`} tone="bg-bad/12 text-bad-ink" /></Card>
      </div>
      <Card className="mb-6">
        <CardHeader title="Pattern mastery" sub="Share of each pattern's problems by last rating (grey = not reviewed). Average uses Green 3, Yellow 2, Red 1." />
        <div className="px-4 sm:px-5 pb-5 grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-3">
          {pstats.map(x => (
            <button key={x.pattern.id} onClick={() => go(patternRoute(x.pattern.id))} className="grid grid-cols-[minmax(0,10rem)_1fr_3.5rem] items-center gap-3 text-left group">
              <span className="text-sm text-fg truncate group-hover:text-accent-ink transition-colors">{x.pattern.name}</span>
              <GYRBar g={x.g} y={x.y} r={x.r} n={x.notReviewed} height={10} />
              <span className="text-xs text-muted text-right tabular-nums">{x.avg !== null ? x.avg.toFixed(2) : '—'}</span>
            </button>
          ))}
        </div>
      </Card>

      {/* Effectiveness */}
      <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted mb-2.5">Revision effectiveness {range ? `· last ${range === 365 ? 'year' : `${range} days`}` : ''}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <Card className="p-4"><div className="flex items-center justify-between mb-2"><h3 className="flex items-center gap-2 font-bold text-fg text-sm"><Repeat size={15} className="text-bad-ink" />Repeated Red</h3><span className="font-bold text-bad-ink tabular-nums">{eff.repeatedRed.length}</span></div><ProbList ids={eff.repeatedRed} empty="No problem has been Red twice." /></Card>
        <Card className="p-4"><div className="flex items-center justify-between mb-2"><h3 className="flex items-center gap-2 font-bold text-fg text-sm"><ArrowUpRight size={15} className="text-warn-ink" />Red → Yellow</h3><span className="font-bold text-warn-ink tabular-nums">{eff.redToYellow.length}</span></div><ProbList ids={eff.redToYellow} empty="None yet." /></Card>
        <Card className="p-4"><div className="flex items-center justify-between mb-2"><h3 className="flex items-center gap-2 font-bold text-fg text-sm"><TrendingUp size={15} className="text-ok-ink" />Yellow → Green</h3><span className="font-bold text-ok-ink tabular-nums">{eff.yellowToGreen.length}</span></div><ProbList ids={eff.yellowToGreen} empty="None yet." /></Card>
        <Card className="p-4"><div className="flex items-center justify-between mb-2"><h3 className="flex items-center gap-2 font-bold text-fg text-sm"><TrendingDown size={15} className="text-bad-ink" />Regressed from Green</h3><span className="font-bold text-bad-ink tabular-nums">{eff.regressed.length}</span></div><ProbList ids={eff.regressed} empty="No regressions." /></Card>
      </div>

      {/* Milestones */}
      <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted mb-2.5">Lifetime milestones</h2>
      <Card className="p-4 sm:p-5 mb-4">
        <div className="flex items-center gap-2 mb-3"><Sparkles size={16} className="text-accent-ink" /><h3 className="font-display font-semibold text-fg">Journey milestones</h3></div>
        <MilestonesList milestones={s.milestones} />
      </Card>

      {allRevs.length === 0 && <Card className="mt-4"><Empty title="No revision records yet" body="Charts fill in as you record revisions." /></Card>}
    </div>
  );
}
