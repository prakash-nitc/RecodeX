import React, { useMemo } from 'react';
import { Target, Play, ArrowRight, CheckCircle2, CalendarDays, Shuffle, Zap, Plus, AlertTriangle, Mountain, BarChart3, Flag, Trophy, TrendingUp, TrendingDown, Sparkles } from 'lucide-react';
import { ColumnChart, RATING_SERIES } from '../components/charts';
import { useData, settingsOf, startSession } from '../lib/store';
import { buildFocus, statusOf, FocusItem, FocusReason } from '../lib/engine';
import { today, fmt, weekday, addDays } from '../lib/dates';
import { streaks, weekDays, countRatings, revisionsByDay, isMastered, journeyCamps, patternStats, weekDigest } from '../lib/stats';
import { quoteForDay } from '../lib/quotes';
import { Card, CardHeader, Button, Progress, DiffPill, RatingDot, cx, Empty, LinkButton, Ring, Flame, GYRBar } from '../components/ui';
import { useApp, QuickRate, PatternTag } from '../components/shared';
import { MountainScene } from '../components/art/Mountains';
import { StudyScene } from '../components/art/StudyScene';
import { PixelScene } from '../components/art/PixelScene';
import { GifScene } from '../components/art/GifScene';
import { usePalette } from '../lib/theme';
import { JourneyRoadmap } from '../components/Journey';
import { patternRoute } from './Patterns';
import type { Problem } from '../types';

export const REASON_CLS: Record<FocusReason, string> = {
  'Overdue': 'bg-hot/20 text-hot-ink', 'Due today': 'border border-hot/45 text-hot-ink', 'High priority': 'bg-hot/12 text-hot-ink', 'Weak': 'bg-surface2 text-fg/80', 'New': 'bg-idle/15 text-idle-ink',
};
export function ReasonChip({ item }: { item: FocusItem }) {
  return <span className={cx('inline-flex rounded-lg px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap tabular-nums', REASON_CLS[item.reason])}>
    {item.reason === 'Overdue' ? `Overdue ${item.overdue}d` : item.reason}
  </span>;
}

export function FocusRow({ item, onOpen }: { item: FocusItem; onOpen: (id: string) => void }) {
  const p = item.problem;
  return (
    <li className="group flex items-center gap-3 px-4 sm:px-5 py-2.5 hover:bg-hover/60 transition-colors">
      <RatingDot r={p.lastRating} size={9} />
      <button className="min-w-0 flex-1 text-left" onClick={() => onOpen(p.id)}>
        <div className="text-sm font-semibold leading-snug text-fg line-clamp-2 group-hover:text-accent-ink transition-colors" title={p.name}>{p.name}</div>
        <div className="flex flex-wrap items-center gap-1.5 mt-1"><PatternTag id={p.patternId} /><DiffPill d={p.difficulty} /><ReasonChip item={item} /></div>
        <div className="mt-1 text-[11px] leading-snug text-muted">{item.why}</div>
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

/** This week in review: what improved, slipped, got mastered, and what is one Green from mastery. */
function WeekReview({ t }: { t: string }) {
  const d = useData(); const s = settingsOf(d);
  const { openProblem, go } = useApp();
  const dg = useMemo(() => weekDigest(Object.values(d.revisions), d.problems, s, s.weekStart, t), [d.revisions, d.problems, d.meta, t]);
  const groups: { key: string; title: string; hint: string; ids: string[]; icon: React.ReactNode; tone: string }[] = [
    { key: 'mastered', title: 'Mastered', hint: `reached ${s.masteryStreak} greens in a row`, ids: dg.mastered, icon: <Trophy size={15} />, tone: 'text-ok-ink bg-ok/12' },
    { key: 'improved', title: 'Improved', hint: 'rated better than last time', ids: dg.improved, icon: <TrendingUp size={15} />, tone: 'text-ok-ink bg-ok/12' },
    { key: 'slipped', title: 'Slipped', hint: 'rated worse than last time', ids: dg.slipped, icon: <TrendingDown size={15} />, tone: 'text-bad-ink bg-bad/10' },
    { key: 'near', title: 'One Green from mastery', hint: 'due in the next 7 days', ids: dg.nearMastery, icon: <Flag size={15} />, tone: 'text-accent-ink bg-accent/12' },
  ];
  const quiet = groups.every(g => !g.ids.length) && !dg.toughest;
  return (
    <Card className="min-w-0">
      <CardHeader icon={<Sparkles size={18} />} title="Week in review"
        sub={dg.toughest ? <>Toughest pattern this week: <button className="font-semibold text-fg hover:text-accent-ink" onClick={() => go(patternRoute(dg.toughest!.patternId))}>{d.patterns[dg.toughest.patternId]?.name}</button> · {dg.toughest.red} Red</> : 'Changes since the start of the week'} />
      {quiet ? <p className="px-4 sm:px-5 pb-5 text-sm text-muted">Nothing has moved yet this week. Every rating you record shows up here.</p> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 px-4 sm:px-5 pb-5">
          {groups.map(g => (
            <section key={g.key} className="rounded-2xl border border-line bg-surface2/40 p-3.5 min-w-0">
              <div className="flex items-center gap-2">
                <span className={cx('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', g.tone)}>{g.icon}</span>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-fg">{g.title} <span className="tabular-nums text-muted">· {g.ids.length}</span></div>
                  <div className="text-[11px] text-muted truncate">{g.hint}</div>
                </div>
              </div>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {g.ids.slice(0, 3).map(id => d.problems[id] && (
                  <button key={id} onClick={() => openProblem(id)} className="max-w-full truncate rounded-lg border border-line bg-surface px-2 py-1 text-xs text-fg hover:border-interactive/50">{d.problems[id].name}</button>
                ))}
                {g.ids.length > 3 && <span className="self-center text-[11px] text-muted">+{g.ids.length - 3} more</span>}
                {!g.ids.length && <span className="text-xs text-muted">None yet</span>}
              </div>
            </section>
          ))}
        </div>
      )}
    </Card>
  );
}

function greeting(h: number) {
  if (h >= 5 && h < 12) return 'Good morning';
  if (h >= 12 && h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function Dashboard() {
  const d = useData();
  const { go, openProblem, addProblemDialog } = useApp();
  const { problems, revs, focus, todayRevs, doneIds, s, t } = useToday();
  // Light themes show the daylight animation. Dawn's banner was built for the night one (white text on a dark
  // fade), so while the daylight animation shows there it switches to dark text on a light veil (data-art="day").
  const palette = usePalette();
  const daylight = palette === 'dawn' || palette === 'cloud';

  const counts = useMemo(() => {
    const st = problems.map(p => statusOf(p, s, t));
    const ws = weekDays(t, s.weekStart);
    const weekRevs = revs.filter(r => r.date >= ws[0] && r.date <= ws[6]);
    return {
      total: problems.length, due: st.filter(x => x === 'Due Today').length, overdue: st.filter(x => x === 'Overdue').length,
      reviewed: problems.filter(p => p.lastRating).length,
      mastered: problems.filter(p => isMastered(p, s)).length,
      weekDistinct: new Set(weekRevs.map(r => r.problemId)).size, weekRevs, ws,
      oldest: problems.filter((p, i) => st[i] === 'Overdue').sort((a, b) => (a.nextReview! < b.nextReview! ? -1 : 1))[0] as Problem | undefined,
    };
  }, [problems, revs, s, t]);
  const patterns = useMemo(() => Object.values(d.patterns).sort((a, b) => a.order - b.order), [d.patterns]);
  const camps = useMemo(() => journeyCamps(patterns, problems, s, t), [patterns, problems, s, t]);
  const pstats = useMemo(() => patternStats(patterns, problems, revs, s, t), [patterns, problems, revs, s, t]);

  const target = s.dailyTarget;
  const done = doneIds.length;
  const slots = Math.max(target - done, 0);
  const queue = focus.filter(f => !doneIds.includes(f.problem.id));
  const shown = slots > 0 ? queue.slice(0, slots) : queue.slice(0, 3);
  const runItems = slots > 0 ? queue.slice(0, slots) : queue.slice(0, Math.min(queue.length, target));
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
  const upcoming = Array.from({ length: 7 }, (_, i) => addDays(t, i + 1)).map(day => ({ day, n: problems.filter(p => p.track === 'active' && p.nextReview === day).length }));
  const quote = quoteForDay(t);
  const hour = new Date().getHours();
  const name = s.displayName.trim();
  const masteryPct = counts.total ? counts.mastered / counts.total : 0;
  const dueNow = counts.due + counts.overdue;
  const targetMet = done >= target;

  return (
    <div className="flex flex-col gap-4">
      {/* Hero + today's mission */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <section className="relative overflow-hidden rounded-3xl h-[200px] sm:h-[240px] lg:col-span-2 shadow-lift" aria-label="Welcome"
          data-art={s.heroScene === 'gif' && palette === 'dawn' ? 'day' : undefined}>
          {s.heroScene === 'mountains' ? <MountainScene className="absolute inset-0 h-full w-full" />
            : s.heroScene === 'lofi' ? <StudyScene className="absolute inset-0 h-full w-full" />
            : s.heroScene === 'pixel' ? <PixelScene className="absolute inset-0 h-full w-full" />
            : <GifScene className="absolute inset-0 h-full w-full" variant={daylight ? 'day' : 'night'} />}
          <div className="hero-veil absolute inset-0" aria-hidden />
          <div className="absolute inset-0 bg-gradient-to-r from-scrim/[0.72] via-scrim/[0.38] to-scrim/5" />
          <div className="relative flex h-full flex-col justify-between p-5 sm:p-7 text-onart [text-shadow:0_1px_12px_rgb(var(--onart-shadow)/0.35)]">
            <div>
              <div className="flex flex-wrap items-center gap-x-2 text-[13px] font-semibold text-onart/90">
                <span>{greeting(hour)}{name ? `, ${name}` : ''}</span>
                <span className="text-onart/50">·</span>
                <span className="inline-flex items-center gap-1 text-onart/80"><CalendarDays size={13} />{fmt(t, 'EEEE, d MMMM')}</span>
              </div>
              <h1 className="mt-2 font-display text-[22px] sm:text-[30px] font-semibold leading-[1.15] tracking-tight max-w-[18ch] sm:max-w-none text-balance">
                Recode. Revise. Reinforce. Repeat. <span className="headline-accent [text-shadow:none]">Master.</span>
              </h1>
            </div>
            <figure className="max-w-xl hidden sm:block">
              <blockquote className="font-display text-[15px] italic leading-snug text-onart/95">“{quote.text}”</blockquote>
              <figcaption className="mt-1 text-xs text-onart/75">{quote.author}{quote.source ? `, ${quote.source}` : ''}</figcaption>
            </figure>
          </div>
        </section>

        <Card elevated className="flex flex-col justify-between p-5 sm:p-6 lg:h-[240px]">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">Today's mission</span>
              <span className={cx('rounded-lg px-2 py-0.5 text-xs font-semibold tabular-nums', targetMet ? 'bg-ok/15 text-ok-ink' : 'bg-surface2 text-muted')}>{done}/{target} done</span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-display text-5xl font-semibold text-fg tabular-nums leading-none">{dueNow}</span>
              <span className="text-sm text-muted">due{counts.overdue ? <> · <b className="text-hot-ink">{counts.overdue} overdue</b></> : ''}</span>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <Progress value={done / Math.max(1, target)} tone={targetMet ? 'ok' : 'accent'} />
              <span className="text-xs text-muted tabular-nums whitespace-nowrap">target {target}/day</span>
            </div>
          </div>
          {queue.length > 0 ? (
            <Button variant="primary" size="xl" className="w-full mt-4" onClick={() => startTodayRun(runItems, go)}>
              <Play size={18} />Start revision{runItems.length ? ` · ${runItems.length}` : ''}
            </Button>
          ) : (
            <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-ok/10 px-4 py-3">
              <span className="flex items-center gap-2 text-sm font-semibold text-ok-ink"><CheckCircle2 size={17} />All clear for today</span>
              <Button size="sm" variant="outline" onClick={() => go('practice')}>Practice</Button>
            </div>
          )}
        </Card>
      </div>

      {s.notifyOverdueBanner && counts.overdue > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-hot/40 bg-hot/10 px-4 py-3">
          <div className="flex items-start gap-2.5 text-sm min-w-0">
            <AlertTriangle size={17} className="text-hot-ink shrink-0 mt-0.5" />
            <span className="text-fg"><b className="tabular-nums">{counts.overdue}</b> problems are overdue.
              {counts.oldest && <span className="text-muted"> Oldest: {counts.oldest.name}, due {fmt(counts.oldest.nextReview, 'd MMM')}.</span>}</span>
          </div>
          <Button size="sm" variant="outline" onClick={() => go('practice-overdue')}>Overdue recovery<ArrowRight size={14} /></Button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Today's focus */}
        <Card className="lg:col-span-2 flex flex-col min-w-0">
          <CardHeader icon={<Target size={18} />} title="Today's Focus"
            sub={slots > 0 ? `${Math.min(slots, queue.length)} of ${queue.length} in the queue picked for today` : `Target reached · ${queue.length} more in the queue`}
            right={<Button size="sm" variant="ghost" onClick={() => go('today')}>View all ({queue.length})<ArrowRight size={14} /></Button>} />
          {shown.length === 0 ? (
            <Empty art={<MountainScene className="h-32 w-full" />} title="Nothing due right now" body="Every active problem is scheduled for later. Start a mixed practice session or add new problems to your study plan in Settings." action={<Button variant="outline" onClick={() => go('practice')}>Mixed practice</Button>} />
          ) : (
            <ul className="divide-y divide-line/70 border-t border-line/70">{shown.map(f => <FocusRow key={f.problem.id} item={f} onOpen={openProblem} />)}</ul>
          )}
          {doneIds.length > 0 && (
            <div className="border-t border-line/70 px-4 sm:px-5 py-3">
              <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted mb-2">Done today</div>
              <div className="flex flex-wrap gap-1.5">
                {doneIds.map(id => {
                  const p = d.problems[id]; const last = todayRevs.filter(r => r.problemId === id).sort((a, b) => (a.at < b.at ? 1 : -1))[0];
                  return p ? <button key={id} onClick={() => openProblem(id)} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface2 px-2 py-1 text-xs text-fg hover:border-interactive/50"><RatingDot r={last?.rating ?? null} />{p.name}</button> : null;
                })}
              </div>
            </div>
          )}
        </Card>

        <div className="flex flex-col gap-4 min-w-0">
          {/* Lifetime mastery */}
          <Card elevated className="p-5">
            <div className="flex items-center gap-5">
              <Ring value={masteryPct} size={116} stroke={11} tone="mastery" label={`${Math.round(masteryPct * 100)}% of all problems mastered`}>
                <span className="font-display text-[28px] font-semibold text-fg tabular-nums leading-none">{Math.round(masteryPct * 100)}<span className="text-base text-muted">%</span></span>
                <span className="mt-1 text-[10px] font-bold uppercase tracking-[0.1em] text-muted">mastered</span>
              </Ring>
              <div className="min-w-0">
                <h2 className="font-display text-[17px] font-semibold text-fg leading-tight">Lifetime mastery</h2>
                <p className="mt-1 text-xs text-muted leading-relaxed">{counts.mastered} of {counts.total} problems reached {s.masteryStreak} greens in a row.</p>
              </div>
            </div>
            <dl className="mt-4 grid grid-cols-5 gap-1 rounded-xl bg-surface2/70 p-1">
              {[['Problems', counts.total, ''], ['Reviewed', counts.reviewed, ''], ['Due', counts.due, counts.due ? 'text-hot-ink' : ''], ['Overdue', counts.overdue, counts.overdue ? 'text-hot-ink' : ''], ['Mastered', counts.mastered, 'text-ok-ink']].map(([k, v, c]) => (
                <div key={k as string} className="flex flex-col-reverse rounded-lg px-1 py-2 text-center">
                  <dt className="mt-1 text-[10px] font-semibold text-muted">{k as string}</dt>
                  <dd className={cx('font-display text-lg font-semibold tabular-nums leading-none text-fg', c as string)}>{v as number}</dd>
                </div>
              ))}
            </dl>
          </Card>

          {/* Today's progress */}
          <Card className="px-5 py-4">
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-[17px] font-semibold text-fg">Today's progress</h2>
              <span className="text-sm font-semibold text-muted tabular-nums">{Math.min(100, Math.round((done / Math.max(1, target)) * 100))}%</span>
            </div>
            <div className="mt-1 text-sm text-muted">Target <b className="text-fg tabular-nums">{target}</b> · Completed <b className="text-fg tabular-nums">{done}/{target}</b> · Remaining <b className="text-fg tabular-nums">{Math.max(0, target - done)}</b></div>
            <div className="grid grid-cols-3 gap-2 mt-3">
              {(['green', 'yellow', 'red'] as const).map(r => (
                <div key={r} className={cx('rounded-xl px-2 py-2 text-center', r === 'green' ? 'bg-ok/12' : r === 'yellow' ? 'bg-warn/15' : 'bg-bad/10')}>
                  <div className={cx('font-display text-xl font-semibold tabular-nums', r === 'green' ? 'text-ok-ink' : r === 'yellow' ? 'text-warn-ink' : 'text-bad-ink')}>{todayCounts[r]}</div>
                  <div className="text-[11px] font-semibold text-muted capitalize">{r}</div>
                </div>
              ))}
            </div>
            {s.notifyTargetReminder && done < target && queue.length > 0 && hour >= 18 && (
              <p className="mt-3 text-xs text-hot-ink">Evening reminder: {target - done} left to hit today's target.</p>
            )}
          </Card>
        </div>
      </div>

      {/* Journey roadmap */}
      <Card className="min-w-0 overflow-hidden">
        <CardHeader icon={<Mountain size={18} />} title="Your journey" sub={`${camps.filter(c => c.pct >= 1).length} of ${camps.length} camps fully mastered · base camp to summit`}
          right={<Button size="sm" variant="ghost" onClick={() => go('patterns')}>All patterns<ArrowRight size={14} /></Button>} />
        <JourneyRoadmap camps={camps} onOpen={id => go(patternRoute(id))} />
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Weekly consistency */}
        <Card className="lg:col-span-2 min-w-0">
          <CardHeader icon={<BarChart3 size={18} />} title="This week" sub={`${fmt(counts.ws[0], 'd MMM')} – ${fmt(counts.ws[6], 'd MMM')} · ${counts.weekDistinct} problems revised, ${weekTotal} revisions`}
            right={<div className="text-right"><div className="font-display text-lg font-semibold text-fg tabular-nums">{weekPct}%</div><div className="text-[11px] text-muted">of {target * 7} weekly target</div></div>} />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 px-4 sm:px-5 pb-5">
            <div className="md:col-span-3 h-52 min-w-0">
              <ColumnChart ariaLabel="Revisions this week by day and rating" series={RATING_SERIES} highlight={t}
                data={week.map(w => ({ key: w.date, label: w.day, title: fmt(w.date, 'EEE, d MMM'), values: { green: w.green, yellow: w.yellow, red: w.red } }))} />
            </div>
            <div className="flex md:flex-col gap-3 justify-center">
              <div className="flex-1 md:flex-none flex items-center gap-3 rounded-xl bg-surface2/70 px-3 py-3">
                <Flame size={30} dim={st.current === 0} />
                <div>
                  <div className="font-display text-xl font-semibold text-fg tabular-nums leading-none">{st.current} day{st.current === 1 ? '' : 's'}</div>
                  <div className="mt-1 text-[11px] text-muted">streak · longest {st.longest}{doneIds.length === 0 && st.current > 0 ? ' · revise today to keep it' : ''}</div>
                </div>
              </div>
              <div className="flex-1 md:flex-none flex flex-col gap-1.5">
                {(['green', 'yellow', 'red'] as const).map(r => (
                  <div key={r} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1 text-sm">
                    <span className="flex items-center gap-2 text-muted capitalize"><RatingDot r={r} />{r}</span>
                    <span className="font-semibold text-fg tabular-nums">{weekC[r]}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>

        <div className="flex flex-col gap-4 min-w-0">
          {/* Quick actions */}
          <Card className="p-2">
            <div className="px-3 pt-2 pb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-muted">Quick actions</div>
            {[
              { icon: <Shuffle size={17} />, label: 'Mixed Practice', sub: 'Recognise the pattern yourself', run: () => go('practice') },
              { icon: <Zap size={17} />, label: 'Weakness Challenge', sub: 'Red and Yellow problems first', run: () => go('practice-weakness') },
              { icon: <Plus size={17} />, label: 'Add Problem', sub: `${counts.total} problems in the bank`, run: () => addProblemDialog() },
            ].map(a => (
              <button key={a.label} onClick={a.run} className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-hover transition-colors">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/12 text-accent-ink">{a.icon}</span>
                <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-fg">{a.label}</span><span className="block text-xs text-muted truncate">{a.sub}</span></span>
                <ArrowRight size={15} className="text-muted group-hover:text-accent-ink transition-colors" />
              </button>
            ))}
          </Card>
          {/* Coming up */}
          <Card className="px-5 py-4">
            <h2 className="font-display text-[17px] font-semibold text-fg mb-2.5">Coming up</h2>
            <div className="grid grid-cols-7 gap-1">
              {upcoming.map(u => (
                <div key={u.day} className="flex flex-col items-center gap-1">
                  <div className="text-[10px] font-semibold text-muted">{weekday(u.day, 'EEEEE')}</div>
                  <div className={cx('w-full rounded-lg py-1.5 text-center text-xs font-bold tabular-nums', u.n ? 'bg-accent/12 text-selected' : 'bg-surface2 text-muted')}>{u.n}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <WeekReview t={t} />

      {/* Pattern mastery */}
      <Card className="min-w-0">
        <CardHeader icon={<Flag size={18} />} title="Pattern mastery" sub="Last rating of each pattern's problems; grey is not reviewed. Percent is mastered."
          right={<Button size="sm" variant="ghost" onClick={() => go('analytics')}>Analytics<ArrowRight size={14} /></Button>} />
        <div className="px-4 sm:px-5 pb-5 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2.5 max-h-[360px] overflow-y-auto scroll-thin">
          {pstats.map((x, i) => (
            <button key={x.pattern.id} onClick={() => go(patternRoute(x.pattern.id))} className="grid grid-cols-[minmax(0,9.5rem)_1fr_2.75rem] items-center gap-3 text-left group py-0.5">
              <span className="text-sm text-fg leading-snug group-hover:text-accent-ink">{x.pattern.name}</span>
              <GYRBar g={x.g} y={x.y} r={x.r} n={x.notReviewed} height={8} />
              <span className="text-xs font-semibold text-muted text-right tabular-nums">{Math.round((camps[i]?.pct ?? 0) * 100)}%</span>
            </button>
          ))}
          {pstats.length === 0 && <p className="text-sm text-muted">No patterns yet.</p>}
        </div>
      </Card>
    </div>
  );
}
