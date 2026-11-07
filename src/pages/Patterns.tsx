import React, { useMemo, useState } from 'react';
import { Plus, ChevronLeft, Pencil, Trash2, GraduationCap, ArrowUp, ArrowDown, Play } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { useData, settingsOf, addPattern, updatePattern, deletePattern, setLearningState, startSession } from '../lib/store';
import { patternStats, PatternStat } from '../lib/stats';
import { statusOf, PRESETS, baseConfig, generateSession } from '../lib/engine';
import { fmt, relDay, today } from '../lib/dates';
import { usePalette } from '../lib/theme';
import { Button, Card, PageHeader, GYRBar, Progress, cx, Dialog, Field, Input, Select, Textarea, Segmented, useUi, Empty, RatingPill, PhasePill } from '../components/ui';
import { useApp } from '../components/shared';
import { ProblemTable, FilterBar, applyFilters, EMPTY_FILTERS, Filters } from './ProblemBank';
import type { Pattern } from '../types';

export const patternRoute = (id: string) => `pattern-${id.replace(/^pt-/, '')}`;
const LEARN_LABEL: Record<Pattern['learning'], string> = { active: 'In revision', yet_to_learn: 'Yet to learn', learning: 'Learning', completed: 'Learned' };

function avgLabel(avg: number | null) {
  if (avg === null) return '—';
  return avg >= 2.5 ? `${avg.toFixed(1)} · strong` : avg >= 1.8 ? `${avg.toFixed(1)} · shaky` : `${avg.toFixed(1)} · weak`;
}

export function PatternCard({ st, onOpen }: { st: PatternStat; onOpen: () => void }) {
  const p = st.pattern;
  return (
    <button onClick={onOpen} className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 text-left shadow-card hover:border-accent/50 transition-colors min-w-0">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-display font-bold text-fg truncate">{p.name}</div>
          <div className="text-xs text-muted mt-0.5">{p.subPatterns.length} sub-pattern{p.subPatterns.length === 1 ? '' : 's'} · last practiced {st.lastPracticed ? relDay(st.lastPracticed) : 'never'}</div>
        </div>
        {p.learning !== 'active' && <span className="shrink-0 rounded-md border border-dashed border-line px-1.5 py-0.5 text-[11px] font-semibold text-muted">{LEARN_LABEL[p.learning]}</span>}
        {st.overdue > 0 && p.learning === 'active' && <span className="shrink-0 rounded-md bg-bad/12 px-1.5 py-0.5 text-[11px] font-semibold text-bad tabular-nums">{st.overdue} overdue</span>}
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-surface2 py-1.5"><div className="font-bold text-fg tabular-nums">{st.total}</div><div className="text-[10px] text-muted">Total</div></div>
        <div className="rounded-lg bg-surface2 py-1.5"><div className="font-bold text-fg tabular-nums">{st.reviewed}</div><div className="text-[10px] text-muted">Reviewed</div></div>
        <div className="rounded-lg bg-surface2 py-1.5"><div className="font-bold text-fg tabular-nums">{st.notReviewed}</div><div className="text-[10px] text-muted">Not reviewed</div></div>
      </div>
      <div>
        <GYRBar g={st.g} y={st.y} r={st.r} n={st.notReviewed} />
        <div className="flex items-center justify-between mt-1.5 text-[11px] text-muted">
          <span className="tabular-nums"><span className="text-ok">{st.g}</span> / <span className="text-warn">{st.y}</span> / <span className="text-bad">{st.r}</span></span>
          <span className="tabular-nums">{Math.round(st.completion * 100)}% reviewed</span>
        </div>
      </div>
      <div className="flex items-center justify-between text-xs border-t border-line/70 pt-2">
        <span className="text-muted">Average rating</span><span className="font-semibold text-fg tabular-nums">{avgLabel(st.avg)}</span>
      </div>
    </button>
  );
}

export default function Patterns() {
  const d = useData(); const s = settingsOf(d);
  const { go } = useApp();
  const [view, setView] = useState<'all' | 'active' | 'backlog'>('all');
  const [adding, setAdding] = useState(false);
  const stats = useMemo(() => patternStats(Object.values(d.patterns).sort((a, b) => a.order - b.order), Object.values(d.problems), Object.values(d.revisions), s), [d.patterns, d.problems, d.revisions, d.meta]);
  const shown = stats.filter(x => view === 'all' || (view === 'active' ? x.pattern.learning === 'active' || x.pattern.learning === 'completed' : x.pattern.learning === 'yet_to_learn' || x.pattern.learning === 'learning'));
  return (
    <div>
      <PageHeader title="Patterns" sub={`${stats.length} patterns · click one to see its problems and history`}
        right={<Button variant="primary" onClick={() => setAdding(true)}><Plus size={16} />Add pattern</Button>} />
      <div className="mb-4"><Segmented ariaLabel="Filter patterns" value={view} onChange={setView} options={[{ value: 'all', label: 'All' }, { value: 'active', label: 'In revision' }, { value: 'backlog', label: 'Yet to learn' }]} /></div>
      {shown.length === 0 ? <Card><Empty title="No patterns here" /></Card> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
          {shown.map(st => <PatternCard key={st.pattern.id} st={st} onOpen={() => go(patternRoute(st.pattern.id))} />)}
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
        <Field label="Learning state" htmlFor="pd-learn" hint="Yet to learn keeps its problems out of the daily queue.">
          <Select id="pd-learn" value={learning} onChange={e => setLearning(e.target.value as Pattern['learning'])}>
            <option value="active">In revision</option><option value="yet_to_learn">Yet to learn</option><option value="learning">Currently learning</option><option value="completed">Learned</option>
          </Select>
        </Field>
        <Field label="Sub-patterns (one per line)" htmlFor="pd-subs"><Textarea id="pd-subs" rows={4} value={subs} onChange={e => setSubs(e.target.value)} placeholder={'Basics\nBinary Search on Answer'} /></Field>
      </div>
    </Dialog>
  );
}

export function PatternDetail({ id }: { id: string }) {
  const d = useData(); const s = settingsOf(d); const pal = usePalette();
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
  const pie = [{ k: 'Green', v: st.g, c: pal.ok }, { k: 'Yellow', v: st.y, c: pal.warn }, { k: 'Red', v: st.r, c: pal.bad }].filter(x => x.v > 0);
  const subCounts = pattern.subPatterns.map(sp => ({ sp, n: probs.filter(p => p.subPattern === sp).length }));
  const others = Object.values(d.patterns).filter(p => p.id !== id).sort((a, b) => a.order - b.order);

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
    const cfg = { ...baseConfig(s), ...PRESETS.mastery.config, preset: 'mastery' as const, patternIds: [id], count: s.defaultSessionSize };
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
          <Button variant="ghost" className="hover:!text-bad" onClick={del}><Trash2 size={14} /></Button>
          <Button variant="outline" onClick={mastery}><Play size={14} />Mastery session</Button>
          <Button variant="primary" onClick={() => addProblemDialog({ patternId: id, subPattern: sub, initial: pattern.learning === 'yet_to_learn' ? 'backlog' : 'not_reviewed' })}><Plus size={16} />Add problem</Button>
        </>} />
      {pattern.learning !== 'active' && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-line bg-surface px-4 py-3 text-sm">
          <span className="flex items-center gap-2 text-fg"><GraduationCap size={16} className="text-accent" />{LEARN_LABEL[pattern.learning]}: {st.backlog} problem{st.backlog === 1 ? '' : 's'} are held out of the daily queue.</span>
          <Button size="sm" variant="outline" onClick={() => go('learn')}>Open Yet to Learn</Button>
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        {[['Total', st.total], ['Reviewed', st.reviewed], ['Not reviewed', st.notReviewed], ['Overdue', st.overdue]].map(([k, v]) => (
          <Card key={k as string} className={cx('px-4 py-3', k === 'Overdue' && (v as number) > 0 && 'border-bad/40')}>
            <div className="text-xs text-muted">{k}</div>
            <div className={cx('font-display text-2xl font-extrabold tabular-nums', k === 'Overdue' && (v as number) > 0 ? 'text-bad' : 'text-fg')}>{v}</div>
          </Card>
        ))}
        <Card className="px-4 py-3 col-span-2 md:col-span-1">
          <div className="text-xs text-muted">Completion</div>
          <div className="font-display text-2xl font-extrabold text-fg tabular-nums">{Math.round(st.completion * 100)}%</div>
          <Progress value={st.completion} className="mt-1.5" tone="ok" />
        </Card>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <Card className="p-4 flex items-center gap-4">
          <div className="relative h-32 w-32 shrink-0">
            {pie.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart><Pie data={pie} dataKey="v" innerRadius={42} outerRadius={60} paddingAngle={2} stroke="none" isAnimationActive={false}>{pie.map(x => <Cell key={x.k} fill={x.c} />)}</Pie></PieChart>
              </ResponsiveContainer>
            ) : <div className="h-full w-full rounded-full border-[14px] border-surface2" />}
            <div className="absolute inset-0 flex flex-col items-center justify-center"><span className="font-display text-2xl font-extrabold text-fg tabular-nums">{st.reviewed}</span><span className="text-[10px] text-muted">reviewed</span></div>
          </div>
          <div className="flex flex-col gap-1.5 text-sm min-w-0">
            {[['Green', st.g, 'bg-ok'], ['Yellow', st.y, 'bg-warn'], ['Red', st.r, 'bg-bad']].map(([k, v, c]) => (
              <span key={k as string} className="flex items-center gap-2 text-muted"><span className={cx('h-2.5 w-2.5 rounded-full', c as string)} />{k}: <b className="text-fg tabular-nums">{v as number}</b>{st.reviewed ? <span className="tabular-nums">({Math.round(((v as number) / st.reviewed) * 100)}%)</span> : null}</span>
            ))}
            <span className="text-xs text-muted mt-1">Average {avgLabel(st.avg)} · last {st.lastPracticed ? fmt(st.lastPracticed, 'd MMM') : 'never'}</span>
          </div>
        </Card>
        <Card className="p-4 lg:col-span-2 min-w-0">
          <div className="text-sm font-bold text-fg mb-2">Sub-patterns</div>
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => setSub('')} className={cx('rounded-md border px-2 py-1 text-xs font-semibold', !sub ? 'border-accent bg-accent/15 text-accent' : 'border-line text-muted hover:text-fg')}>All · {probs.length}</button>
            {subCounts.map(({ sp, n }) => (
              <button key={sp} onClick={() => setSub(sub === sp ? '' : sp)} className={cx('rounded-md border px-2 py-1 text-xs font-semibold', sub === sp ? 'border-accent bg-accent/15 text-accent' : 'border-line text-muted hover:text-fg')}>{sp} · <span className="tabular-nums">{n}</span></button>
            ))}
            {subCounts.length === 0 && <span className="text-sm text-muted">No sub-patterns yet. Add them with Edit, or type one when adding a problem.</span>}
          </div>
          <div className="mt-3 grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
            {subCounts.map(({ sp }) => {
              const ps = probs.filter(p => p.subPattern === sp);
              return <div key={sp} className="min-w-0"><div className="text-[11px] text-muted truncate mb-1">{sp}</div><GYRBar g={ps.filter(p => p.lastRating === 'green').length} y={ps.filter(p => p.lastRating === 'yellow').length} r={ps.filter(p => p.lastRating === 'red').length} n={ps.filter(p => !p.lastRating).length} height={6} /></div>;
            })}
          </div>
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
              <li key={p.id} className="rounded-lg border border-line px-3.5 py-2.5">
                <button onClick={() => openProblem(p.id)} className="text-sm font-semibold text-fg hover:text-accent">{p.name}</button>
                {p.weakness && <p className="text-sm text-fg mt-1"><span className="text-hot font-semibold">Weakness: </span>{p.weakness}</p>}
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
