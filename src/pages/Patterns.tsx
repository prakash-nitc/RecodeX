import React, { useMemo, useState } from 'react';
import { Plus, ChevronLeft, Pencil, Trash2, GraduationCap, ArrowUp, ArrowDown, Play, Shapes, Clock } from 'lucide-react';
import { useData, settingsOf, addPattern, updatePattern, deletePattern, setLearningState, startSession } from '../lib/store';
import { patternStats, PatternStat, isMastered } from '../lib/stats';
import { statusOf, MASTERY_CONFIG, baseConfig, generateSession } from '../lib/engine';
import { fmt, relDay } from '../lib/dates';
import { Button, Card, PageHeader, GYRBar, Progress, cx, Dialog, Field, Input, Select, Textarea, Segmented, useUi, Empty, RatingPill, PhasePill, Ring, Chip } from '../components/ui';
import { useApp } from '../components/shared';
import { MountainScene } from '../components/art/Mountains';
import { ProblemTable, FilterBar, applyFilters, EMPTY_FILTERS, Filters } from './ProblemBank';
import type { Pattern, Problem, Settings } from '../types';

export const patternRoute = (id: string) => `pattern-${id.replace(/^pt-/, '')}`;
const LEARN_LABEL: Record<Pattern['learning'], string> = { active: 'In revision', yet_to_learn: 'Yet to learn', learning: 'Learning' };

function avgLabel(avg: number | null) {
  if (avg === null) return '—';
  return avg >= 2.5 ? `${avg.toFixed(1)} · strong` : avg >= 1.8 ? `${avg.toFixed(1)} · shaky` : `${avg.toFixed(1)} · weak`;
}

interface SubStat { sp: string; n: number; g: number; y: number; r: number; none: number }
function subStats(pattern: Pattern, probs: Problem[]): SubStat[] {
  return pattern.subPatterns.map(sp => {
    const ps = probs.filter(p => p.subPattern === sp);
    return { sp, n: ps.length, g: ps.filter(p => p.lastRating === 'green').length, y: ps.filter(p => p.lastRating === 'yellow').length, r: ps.filter(p => p.lastRating === 'red').length, none: ps.filter(p => !p.lastRating).length };
  });
}

function WeakCounts({ r, y, overdue }: { r: number; y: number; overdue: number }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold tabular-nums">
      <span className={cx('rounded-lg px-1.5 py-0.5', r ? 'bg-bad/12 text-bad-ink' : 'bg-surface2 text-muted')}>{r} Red</span>
      <span className={cx('rounded-lg px-1.5 py-0.5', y ? 'bg-warn/20 text-warn-ink' : 'bg-surface2 text-muted')}>{y} Yellow</span>
      <span className={cx('rounded-lg px-1.5 py-0.5', overdue ? 'bg-hot/20 text-hot-ink' : 'bg-surface2 text-muted')}>{overdue} overdue</span>
    </div>
  );
}

export function PatternCard({ st, mastered, subs, onOpen }: { st: PatternStat; mastered: number; subs: SubStat[]; onOpen: () => void }) {
  const p = st.pattern;
  const mPct = st.total ? mastered / st.total : 0;
  return (
    <button onClick={onOpen} className="group flex flex-col gap-3.5 rounded-2xl border border-line bg-surface p-4 sm:p-5 text-left shadow-card hover:border-accent/40 hover:shadow-lift transition-[border-color,box-shadow] min-w-0">
      <div className="flex items-start gap-3.5">
        <Ring value={mPct} size={58} stroke={6} tone="ok" label={`${Math.round(mPct * 100)}% mastered`}>
          <span className="text-[13px] font-bold text-fg tabular-nums">{Math.round(mPct * 100)}%</span>
        </Ring>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="font-display text-[17px] font-semibold text-fg truncate group-hover:text-accent-ink transition-colors">{p.name}</div>
            {p.learning !== 'active' && <span className="shrink-0 rounded-lg border border-dashed border-line px-1.5 py-0.5 text-[10px] font-semibold text-muted">{LEARN_LABEL[p.learning]}</span>}
          </div>
          <div className="mt-0.5 flex items-center gap-1 text-xs text-muted"><Clock size={11} />{st.lastPracticed ? `practiced ${relDay(st.lastPracticed)}` : 'not practiced yet'} · {mastered}/{st.total} mastered</div>
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between text-[11px] text-muted mb-1"><span>Completion</span><span className="tabular-nums">{st.reviewed}/{st.total} reviewed · {Math.round(st.completion * 100)}%</span></div>
        <GYRBar g={st.g} y={st.y} r={st.r} n={st.notReviewed} />
      </div>
      <WeakCounts r={st.r} y={st.y} overdue={st.overdue} />
      {subs.length > 0 && (
        <div className="border-t border-line/70 pt-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted mb-2">Sub-patterns</div>
          <div className="flex flex-col gap-1.5">
            {subs.slice(0, 4).map(x => (
              <div key={x.sp} className="grid grid-cols-[minmax(0,1fr)_72px_1.5rem] items-center gap-2 text-xs">
                <span className="truncate text-fg/80">{x.sp}</span>
                <GYRBar g={x.g} y={x.y} r={x.r} n={x.none} height={5} />
                <span className="text-right text-muted tabular-nums">{x.n}</span>
              </div>
            ))}
            {subs.length > 4 && <span className="text-[11px] text-muted">and {subs.length - 4} more</span>}
          </div>
        </div>
      )}
      <div className="mt-auto flex items-center justify-between text-xs border-t border-line/70 pt-2.5">
        <span className="text-muted">Average rating</span><span className="font-semibold text-fg tabular-nums">{avgLabel(st.avg)}</span>
      </div>
    </button>
  );
}

function masteredBy(problems: Problem[], s: Settings) {
  const m = new Map<string, number>();
  for (const p of problems) if (isMastered(p, s)) m.set(p.patternId, (m.get(p.patternId) ?? 0) + 1);
  return m;
}

export default function Patterns() {
  const d = useData(); const s = settingsOf(d);
  const { go } = useApp();
  const [view, setView] = useState<'all' | 'active' | 'backlog'>('all');
  const [adding, setAdding] = useState(false);
  const problems = useMemo(() => Object.values(d.problems), [d.problems]);
  const stats = useMemo(() => patternStats(Object.values(d.patterns).sort((a, b) => a.order - b.order), problems, Object.values(d.revisions), s), [d.patterns, problems, d.revisions, d.meta]);
  const mastered = useMemo(() => masteredBy(problems, s), [problems, d.meta]);
  const byPattern = useMemo(() => { const m = new Map<string, Problem[]>(); for (const p of problems) { const a = m.get(p.patternId) ?? []; a.push(p); m.set(p.patternId, a); } return m; }, [problems]);
  const shown = stats.filter(x => view === 'all' || (view === 'active' ? x.pattern.learning === 'active' : x.pattern.learning !== 'active'));
  const totalMastered = [...mastered.values()].reduce((a, b) => a + b, 0);
  return (
    <div>
      <PageHeader eyebrow={<span className="inline-flex items-center gap-1.5"><Shapes size={13} />Camps</span>} title="Patterns" sub={`${stats.length} patterns · ${totalMastered} problems mastered · open one to see its problems and history`}
        right={<Button variant="primary" onClick={() => setAdding(true)}><Plus size={16} />Add pattern</Button>} />
      <div className="mb-4"><Segmented ariaLabel="Filter patterns" value={view} onChange={setView} options={[{ value: 'all', label: 'All' }, { value: 'active', label: 'In revision' }, { value: 'backlog', label: 'Yet to learn' }]} /></div>
      {shown.length === 0 ? <Card><Empty art={<MountainScene className="h-28 w-full" />} title="No patterns here" /></Card> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
          {shown.map(st => <PatternCard key={st.pattern.id} st={st} mastered={mastered.get(st.pattern.id) ?? 0} subs={subStats(st.pattern, byPattern.get(st.pattern.id) ?? [])} onOpen={() => go(patternRoute(st.pattern.id))} />)}
        </div>
      )}
      {adding && <PatternDialog onClose={() => setAdding(false)} />}
    </div>
  );
}

export function PatternDialog({ pattern, onClose }: { pattern?: Pattern; onClose: () => void }) {
  const { toast } = useUi(); const { go } = useApp();
  const [name, setName] = useState(pattern?.name ?? '');
  const [desc, setDesc] = useState(pattern?.description ?? '');
  const [learning, setLearning] = useState<Pattern['learning']>(pattern?.learning ?? 'active');
  const [subs, setSubs] = useState((pattern?.subPatterns ?? []).join('\n'));
  const save = () => {
    const subList = [...new Set(subs.split('\n').map(x => x.trim()).filter(Boolean))];
    if (pattern) {
      updatePattern(pattern.id, { name: name.trim(), description: desc, subPatterns: subList });
      if (learning !== pattern.learning) setLearningState(pattern.id, learning);
      toast('Pattern saved');
    } else {
      const p = addPattern(name, learning, desc); updatePattern(p.id, { subPatterns: subList });
      toast(`Added ${p.name}`); go(patternRoute(p.id));
    }
    onClose();
  };
  return (
    <Dialog open onClose={onClose} title={pattern ? `Edit ${pattern.name}` : 'Add pattern'} width="max-w-md"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!name.trim()} onClick={save}>{pattern ? 'Save' : 'Add pattern'}</Button></>}>
      <div className="flex flex-col gap-3.5">
        <Field label="Name" htmlFor="pd-name"><Input id="pd-name" data-autofocus value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Tries" /></Field>
        <Field label="Description" htmlFor="pd-desc"><Textarea id="pd-desc" rows={2} value={desc} onChange={e => setDesc(e.target.value)} placeholder="What the pattern is for" /></Field>
        <Field label="Learning state" htmlFor="pd-learn" hint="Yet to learn keeps unreviewed problems out of the daily queue; In revision activates any held back.">
          <Select id="pd-learn" className="!w-full" value={learning} onChange={e => setLearning(e.target.value as Pattern['learning'])}>
            <option value="active">In revision</option><option value="yet_to_learn">Yet to learn</option><option value="learning">Currently learning</option>
          </Select>
        </Field>
        <Field label="Sub-patterns (one per line)" htmlFor="pd-subs"><Textarea id="pd-subs" rows={4} value={subs} onChange={e => setSubs(e.target.value)} placeholder={'Basics\nBinary Search on Answer'} /></Field>
      </div>
    </Dialog>
  );
}

export function PatternDetail({ id }: { id: string }) {
  const d = useData(); const s = settingsOf(d);
  const { go, addProblemDialog, openProblem } = useApp();
  const { confirm, toast } = useUi();
  const [tab, setTab] = useState<'problems' | 'history' | 'notes'>('problems');
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState<Filters>({ ...EMPTY_FILTERS, pattern: id, sort: 'num' });
  const [sub, setSub] = useState('');
  const pattern = d.patterns[id];
  const probs = useMemo(() => Object.values(d.problems).filter(p => p.patternId === id), [d.problems, id]);
  const st = useMemo(() => pattern ? patternStats([pattern], probs, Object.values(d.revisions), s)[0] : null, [pattern, probs, d.revisions]);
  const hist = useMemo(() => { const ids = new Set(probs.map(p => p.id)); return Object.values(d.revisions).filter(r => ids.has(r.problemId)).sort((a, b) => (a.at < b.at ? 1 : -1)); }, [probs, d.revisions]);
  if (!pattern || !st) return <Card><Empty title="Pattern not found" action={<Button onClick={() => go('patterns')}>All patterns</Button>} /></Card>;
  const list = applyFilters(probs.filter(p => !sub || p.subPattern === sub), f, p => statusOf(p, s));
  const subs = subStats(pattern, probs);
  const mastered = probs.filter(p => isMastered(p, s)).length;
  const mPct = st.total ? mastered / st.total : 0;

  const del = async () => {
    if (probs.length && !(await confirm({ title: `Delete ${pattern.name}?`, body: `It has ${probs.length} problems. They and their revision history are deleted too. To keep them, move them to another pattern first with the bulk "Pattern" action.`, confirmLabel: 'Delete pattern and problems', danger: true }))) return;
    if (!probs.length && !(await confirm({ title: `Delete ${pattern.name}?`, confirmLabel: 'Delete', danger: true }))) return;
    deletePattern(id, null); toast('Pattern deleted'); go('patterns');
  };
  const move = (dir: -1 | 1) => {
    const sorted = Object.values(d.patterns).sort((a, b) => a.order - b.order);
    const i = sorted.findIndex(p => p.id === id); const j = i + dir;
    if (j < 0 || j >= sorted.length) return;
    updatePattern(sorted[i].id, { order: sorted[j].order }); updatePattern(sorted[j].id, { order: sorted[i].order });
  };
  const mastery = () => {
    const cfg = { ...baseConfig(s), ...MASTERY_CONFIG, preset: 'mastery' as const, patternIds: [id], count: s.defaultSessionSize };
    const r = generateSession(Object.values(d.problems), cfg);
    if (!r.ids.length) { toast('No active problems in this pattern yet', 'info'); return; }
    startSession({ kind: 'mastery', title: `Pattern Mastery · ${pattern.name}`, config: cfg, problemIds: r.ids }); go('session');
  };

  return (
    <div>
      <button onClick={() => go('patterns')} className="mb-2 inline-flex items-center gap-1 text-sm text-muted hover:text-fg"><ChevronLeft size={15} />Patterns</button>
      <PageHeader title={pattern.name} sub={pattern.description || undefined}
        right={<>
          <Button size="icon" variant="ghost" aria-label="Move up" onClick={() => move(-1)}><ArrowUp size={15} /></Button>
          <Button size="icon" variant="ghost" aria-label="Move down" onClick={() => move(1)}><ArrowDown size={15} /></Button>
          <Button variant="outline" onClick={() => setEditing(true)}><Pencil size={14} />Edit</Button>
          <Button variant="ghost" className="hover:!text-bad-ink" onClick={del} aria-label="Delete pattern"><Trash2 size={14} /></Button>
          <Button variant="outline" onClick={mastery}><Play size={14} />Mastery session</Button>
          <Button variant="primary" onClick={() => addProblemDialog({ patternId: id, subPattern: sub, initial: pattern.learning === 'yet_to_learn' ? 'backlog' : 'not_reviewed' })}><Plus size={16} />Add problem</Button>
        </>} />
      {pattern.learning !== 'active' && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-line bg-surface px-4 py-3 text-sm">
          <span className="flex items-center gap-2 text-fg"><GraduationCap size={16} className="text-muted" />{LEARN_LABEL[pattern.learning]}: {st.backlog} problem{st.backlog === 1 ? '' : 's'} are held out of the daily queue.</span>
          <Button size="sm" variant="outline" onClick={() => go('learn')}>Open Yet to Learn</Button>
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <Card className="p-5 flex items-center gap-5">
          <Ring value={mPct} size={112} stroke={10} tone="ok" label={`${Math.round(mPct * 100)}% mastered`}>
            <span className="font-display text-2xl font-semibold text-fg tabular-nums leading-none">{Math.round(mPct * 100)}%</span>
            <span className="mt-1 text-[10px] font-bold uppercase tracking-[0.1em] text-muted">mastered</span>
          </Ring>
          <div className="min-w-0 flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-x-5 gap-y-1.5 text-sm">
              {[['Total', st.total, ''], ['Reviewed', st.reviewed, ''], ['Not reviewed', st.notReviewed, ''], ['Overdue', st.overdue, st.overdue ? 'text-hot-ink' : '']].map(([k, v, c]) => (
                <div key={k as string}><div className="text-[11px] text-muted">{k as string}</div><div className={cx('font-display text-xl font-semibold tabular-nums text-fg leading-tight', c as string)}>{v as number}</div></div>
              ))}
            </div>
            <div className="text-xs text-muted">Average {avgLabel(st.avg)} · last {st.lastPracticed ? fmt(st.lastPracticed, 'd MMM') : 'never'}</div>
          </div>
        </Card>
        <Card className="p-5 lg:col-span-2 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h2 className="font-display text-lg font-semibold text-fg">Completion and weak spots</h2>
            <WeakCounts r={st.r} y={st.y} overdue={st.overdue} />
          </div>
          <div className="flex items-center gap-3 mb-1 text-xs text-muted"><span className="tabular-nums">{st.reviewed}/{st.total} reviewed</span><Progress value={st.completion} tone="ok" className="flex-1" /><span className="tabular-nums">{Math.round(st.completion * 100)}%</span></div>
          <GYRBar g={st.g} y={st.y} r={st.r} n={st.notReviewed} height={10} />
          <div className="mt-4 flex flex-wrap gap-1.5">
            <Chip on={!sub} onClick={() => setSub('')}>All · {probs.length}</Chip>
            {subs.map(x => <Chip key={x.sp} on={sub === x.sp} onClick={() => setSub(sub === x.sp ? '' : x.sp)}>{x.sp} · <span className="tabular-nums">{x.n}</span></Chip>)}
            {subs.length === 0 && <span className="text-sm text-muted">No sub-patterns yet. Add them with Edit, or type one when adding a problem.</span>}
          </div>
          {subs.length > 0 && (
            <div className="mt-4 grid gap-x-5 gap-y-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))' }}>
              {subs.map(x => (
                <div key={x.sp} className="min-w-0">
                  <div className="flex items-center justify-between text-[11px] mb-1"><span className="text-fg/80 truncate">{x.sp}</span><span className="text-muted tabular-nums">{x.r ? <span className="text-bad-ink">{x.r}R </span> : null}{x.y ? <span className="text-warn-ink">{x.y}Y</span> : null}</span></div>
                  <GYRBar g={x.g} y={x.y} r={x.r} n={x.none} height={6} />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
      <div className="mb-3"><Segmented ariaLabel="Section" value={tab} onChange={setTab} options={[{ value: 'problems', label: `Problems (${probs.length})` }, { value: 'history', label: `Revision history (${hist.length})` }, { value: 'notes', label: 'Notes' }]} /></div>
      {tab === 'problems' && <><div className="mb-3"><FilterBar f={f} setF={setF} hidePattern /></div><ProblemTable problems={list} /></>}
      {tab === 'history' && (
        <Card className="overflow-hidden">
          {hist.length === 0 ? <Empty title="No revisions in this pattern yet" /> : (
            <ul className="divide-y divide-line/70">{hist.slice(0, 200).map(r => {
              const p = d.problems[r.problemId];
              return <li key={r.id}><button onClick={() => openProblem(r.problemId)} className="w-full flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-left hover:bg-surface2/60">
                <span className="min-w-0"><span className="block text-sm font-semibold text-fg truncate">{p?.name}</span><span className="text-xs text-muted">{fmt(r.date, 'EEE, d MMM yyyy')}{r.mistake ? ` · ${r.mistake.slice(0, 80)}` : ''}</span></span>
                <span className="flex items-center gap-2"><PhasePill p={r.phase} /><RatingPill r={r.rating} /></span>
              </button></li>;
            })}</ul>
          )}
        </Card>
      )}
      {tab === 'notes' && (
        <Card className="p-4">
          {probs.filter(p => p.weakness || p.notes).length === 0 ? <Empty title="No notes yet" body="Mistakes you log while revising this pattern's problems collect here." /> : (
            <ul className="flex flex-col gap-3">{probs.filter(p => p.weakness || p.notes).map(p => (
              <li key={p.id} className="rounded-xl border border-line px-3.5 py-2.5">
                <button onClick={() => openProblem(p.id)} className="text-sm font-semibold text-fg hover:text-accent-ink">{p.name}</button>
                {p.weakness && <p className="text-sm text-fg mt-1"><span className="text-hot-ink font-semibold">Weakness: </span>{p.weakness}</p>}
                {p.notes && <p className="text-xs text-muted mt-1 whitespace-pre-wrap">{p.notes}</p>}
              </li>
            ))}</ul>
          )}
        </Card>
      )}
      {editing && <PatternDialog pattern={pattern} onClose={() => setEditing(false)} />}
    </div>
  );
}
