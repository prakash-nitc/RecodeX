import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { CalendarClock, Pencil, Trash2, Undo2, ExternalLink, BookOpen, Flame } from 'lucide-react';
import type { Difficulty, Phase, Priority, Problem, Rating, Revision, Track } from '../types';
import { DIFFICULTIES, PHASES, PRIORITIES } from '../types';
import {
  useData, settingsOf, recordRevision, addProblem, updateProblem, deleteProblems, findDuplicates, undoRevision, latestRevisionOf, addPattern,
} from '../lib/store';
import { previewNext, statusOf, revisionTypeOf, RATING_MEANING, PHASE_HINT, suggestPhase } from '../lib/engine';
import { fmt, relDay, today } from '../lib/dates';
import {
  Button, Dialog, Field, Input, Select, Textarea, Segmented, cx, RatingPill, DiffPill, PriorityPill, StatusPill, PhasePill, Tag, Drawer, useUi, RatingDot, Card,
} from './ui';

// ---------------------------------------------------------------------------------------------
// App-wide navigation & dialogs

export type Route = string;
interface AppCtx {
  route: Route;
  go: (r: Route) => void;
  openProblem: (id: string) => void;
  rate: (id: string, opts?: { source?: Revision['source']; sessionId?: string | null; rating?: Rating; onSaved?: (r: Revision) => void }) => void;
  addProblemDialog: (prefill?: Partial<ProblemDraft>) => void;
  editProblem: (id: string) => void;
}
const AppContext = createContext<AppCtx | null>(null);
export const useApp = () => { const c = useContext(AppContext); if (!c) throw new Error('AppContext'); return c; };

export function AppProvider({ route, go, children }: { route: Route; go: (r: Route) => void; children: React.ReactNode }) {
  const [drawer, setDrawer] = useState<string | null>(null);
  const [rateFor, setRateFor] = useState<{ id: string; source: Revision['source']; sessionId: string | null; rating?: Rating; onSaved?: (r: Revision) => void } | null>(null);
  const [form, setForm] = useState<{ mode: 'add' | 'edit'; id?: string; prefill?: Partial<ProblemDraft> } | null>(null);
  const ctx: AppCtx = useMemo(() => ({
    route, go,
    openProblem: id => setDrawer(id),
    rate: (id, o) => setRateFor({ id, source: o?.source ?? 'quick', sessionId: o?.sessionId ?? null, rating: o?.rating, onSaved: o?.onSaved }),
    addProblemDialog: prefill => setForm({ mode: 'add', prefill }),
    editProblem: id => setForm({ mode: 'edit', id }),
  }), [route, go]);
  return (
    <AppContext.Provider value={ctx}>
      {children}
      <ProblemDrawer id={drawer} onClose={() => setDrawer(null)} />
      {rateFor && <RatingDialog key={rateFor.id + (rateFor.rating ?? '')} problemId={rateFor.id} source={rateFor.source} sessionId={rateFor.sessionId} initialRating={rateFor.rating}
        onClose={() => setRateFor(null)} onSaved={r => { rateFor.onSaved?.(r); setRateFor(null); }} />}
      {form && <ProblemFormDialog mode={form.mode} id={form.id} prefill={form.prefill} onClose={() => setForm(null)} />}
    </AppContext.Provider>
  );
}

// ---------------------------------------------------------------------------------------------
// Rating form (used by the dialog and by the session runner)

export interface RatingFormValue {
  rating: Rating | null; timeMin: string; independent: boolean | null; mistake: string; notes: string;
  phaseUsed: Phase; nextPhase: Phase | null; nextOverride: string;
}
export function initialRatingValue(p: Problem, rating?: Rating | null, timeMin = ''): RatingFormValue {
  return { rating: rating ?? null, timeMin, independent: rating === 'green' ? true : rating ? false : null, mistake: '', notes: '', phaseUsed: p.phase, nextPhase: null, nextOverride: '' };
}

export const RATING_BTN: Record<Rating, string> = {
  green: 'border-ok/45 bg-ok/10 text-ok-ink hover:bg-ok/20 aria-pressed:bg-ok aria-pressed:text-[#06281A] aria-pressed:border-ok aria-pressed:shadow-[0_8px_20px_-8px_rgb(var(--ok)/0.7)]',
  yellow: 'border-warn/50 bg-warn/12 text-warn-ink hover:bg-warn/25 aria-pressed:bg-warn aria-pressed:text-[#3A2700] aria-pressed:border-warn aria-pressed:shadow-[0_8px_20px_-8px_rgb(var(--warn)/0.7)]',
  red: 'border-bad/45 bg-bad/10 text-bad-ink hover:bg-bad/20 aria-pressed:bg-bad aria-pressed:text-white aria-pressed:border-bad aria-pressed:shadow-[0_8px_20px_-8px_rgb(var(--bad)/0.7)]',
};
const RATING_SHORT: Record<Rating, string> = { green: 'Solved independently', yellow: 'Needed hints / partial', red: 'Could not solve' };

export function RatingButtons({ value, onPick, compact, keys }: { value: Rating | null; onPick: (r: Rating) => void; compact?: boolean; keys?: boolean }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {(['green', 'yellow', 'red'] as Rating[]).map(r => (
        <button key={r} aria-pressed={value === r} onClick={() => onPick(r)} title={RATING_MEANING[r]}
          className={cx('relative rounded-2xl border-2 px-2 text-center font-semibold transition-[background-color,box-shadow,transform] duration-150 active:scale-[.97]', compact ? 'py-2 text-sm' : 'py-3.5', RATING_BTN[r])}>
          {keys && <kbd aria-hidden className="absolute top-1.5 right-2 hidden sm:block font-mono text-[10px] opacity-60">{r === 'green' ? 1 : r === 'yellow' ? 2 : 3}</kbd>}
          <div className={compact ? '' : 'text-base'}>{r[0].toUpperCase() + r.slice(1)}</div>
          {!compact && <div className="text-[11px] font-medium opacity-80 mt-0.5">{RATING_SHORT[r]}</div>}
        </button>
      ))}
    </div>
  );
}

export function RatingForm({ problem, value, onChange, idPrefix, collapsible, keys }: { problem: Problem; value: RatingFormValue; onChange: (v: RatingFormValue) => void; idPrefix: string; collapsible?: boolean; keys?: boolean }) {
  const d = useData(); const s = settingsOf(d);
  const [more, setMore] = useState(!collapsible);
  const pv = value.rating ? previewNext(problem, value.rating, s) : null;
  const set = (patch: Partial<RatingFormValue>) => onChange({ ...value, ...patch });
  return (
    <div className="flex flex-col gap-4">
      <RatingButtons keys={keys} value={value.rating} onPick={r => set({ rating: r, independent: value.independent ?? (r === 'green') })} />
      {value.rating && <p className="text-xs text-muted -mt-1">{RATING_MEANING[value.rating]}</p>}
      {collapsible && (
        <Field label="Main mistake or weakness" htmlFor={`${idPrefix}-mistake`} hint={problem.weakness ? <>Last time: <span className="text-fg/80">{problem.weakness.slice(0, 140)}{problem.weakness.length > 140 ? '…' : ''}</span></> : undefined}>
          <Textarea id={`${idPrefix}-mistake`} rows={2} placeholder="e.g. off-by-one when shrinking the window" value={value.mistake} onChange={e => set({ mistake: e.target.value })} />
        </Field>
      )}
      {collapsible && (
        <button type="button" onClick={() => setMore(!more)} aria-expanded={more} className="-mt-1 self-start text-xs font-semibold text-accent-ink hover:underline">
          {more ? 'Fewer details' : 'More details: time, independence, notes, phases, next date'}
        </button>
      )}
      {more && <>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Time taken (min)" htmlFor={`${idPrefix}-time`}>
          <Input id={`${idPrefix}-time`} type="number" min={0} inputMode="numeric" placeholder="Optional" value={value.timeMin} onChange={e => set({ timeMin: e.target.value })} />
        </Field>
        <Field label="Solved independently?">
          <Segmented ariaLabel="Solved independently" value={value.independent === null ? 'unset' : value.independent ? 'yes' : 'no'}
            options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]}
            onChange={v => set({ independent: v === 'yes' })} />
        </Field>
      </div>
      {!collapsible && (
      <Field label="Main mistake or weakness" htmlFor={`${idPrefix}-mistake`} hint={problem.weakness ? <>Last time: <span className="text-fg/80">{problem.weakness.slice(0, 140)}{problem.weakness.length > 140 ? '…' : ''}</span></> : undefined}>
        <Textarea id={`${idPrefix}-mistake`} rows={2} placeholder="e.g. off-by-one when shrinking the window" value={value.mistake} onChange={e => set({ mistake: e.target.value })} />
      </Field>
      )}
      <Field label="Additional notes" htmlFor={`${idPrefix}-notes`}>
        <Textarea id={`${idPrefix}-notes`} rows={2} placeholder="Optional" value={value.notes} onChange={e => set({ notes: e.target.value })} />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Phase used" htmlFor={`${idPrefix}-phase`} hint={PHASE_HINT[value.phaseUsed]}>
          <Select id={`${idPrefix}-phase`} value={value.phaseUsed} onChange={e => set({ phaseUsed: e.target.value as Phase })}>
            {PHASES.map(p => <option key={p}>{p}</option>)}
          </Select>
        </Field>
        <Field label="Next phase" htmlFor={`${idPrefix}-nphase`} hint={pv ? `Suggested: ${pv.phase}` : 'Pick a rating first'}>
          <Select id={`${idPrefix}-nphase`} value={value.nextPhase ?? ''} onChange={e => set({ nextPhase: (e.target.value || null) as Phase | null })} disabled={!pv}>
            <option value="">{pv ? `Auto (${pv.phase})` : 'Auto'}</option>
            {PHASES.map(p => <option key={p} value={p}>{p}</option>)}
          </Select>
        </Field>
      </div>
      </>}
      {pv && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface2/70 px-3.5 py-3">
          <div className="flex items-center gap-2.5 text-sm">
            <CalendarClock size={16} className="text-accent-ink" />
            <span className="text-muted">Next review</span>
            <span className="font-semibold text-fg">{fmt(value.nextOverride || pv.next, 'EEE, d MMM')}</span>
            {!value.nextOverride && <span className="text-xs text-muted">({pv.days}d · green streak {pv.streak})</span>}
          </div>
          <Input aria-label="Override next review date" type="date" className="!w-auto h-8 text-xs" value={value.nextOverride} min={today()} onChange={e => set({ nextOverride: e.target.value })} />
        </div>
      )}
    </div>
  );
}

export function submitRating(problemId: string, v: RatingFormValue, source: Revision['source'], sessionId: string | null) {
  if (!v.rating) return null;
  const t = v.timeMin.trim() === '' ? null : Math.max(0, Number(v.timeMin));
  return recordRevision(problemId, {
    rating: v.rating, timeMin: t === null || Number.isNaN(t) ? null : t, independent: v.independent,
    mistake: v.mistake, notes: v.notes, phaseUsed: v.phaseUsed, nextPhase: v.nextPhase, nextOverride: v.nextOverride || null,
    source, sessionId,
  });
}

function RatingDialog({ problemId, source, sessionId, initialRating, onClose, onSaved }: { problemId: string; source: Revision['source']; sessionId: string | null; initialRating?: Rating; onClose: () => void; onSaved: (r: Revision) => void }) {
  const d = useData(); const { toast } = useUi();
  const p = d.problems[problemId];
  const [v, setV] = useState<RatingFormValue | null>(p ? initialRatingValue(p, initialRating) : null);
  if (!p || !v) return null;
  const save = () => {
    const r = submitRating(p.id, v, source, sessionId);
    if (r) { toast(`${p.name}: ${r.rating}, next review ${fmt(r.nextReview, 'd MMM')}`); onSaved(r); }
  };
  return (
    <Dialog open onClose={onClose} title={`Record revision · ${p.name}`} sub={<span>#{p.num} · {d.patterns[p.patternId]?.name} · {p.difficulty}</span>} width="max-w-xl"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!v.rating} onClick={save}>Save revision</Button></>}>
      {p.url && <a href={p.url} target="_blank" rel="noopener noreferrer" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-accent-ink hover:underline"><ExternalLink size={14} />Open problem</a>}
      <RatingForm problem={p} value={v} onChange={setV} idPrefix="rd" />
    </Dialog>
  );
}

export function QuickRate({ id, source = 'quick' }: { id: string; source?: Revision['source'] }) {
  const { rate } = useApp();
  return (
    <div className="inline-flex items-center gap-1" onClick={e => e.stopPropagation()}>
      {(['green', 'yellow', 'red'] as Rating[]).map(r => (
        <button key={r} onClick={() => rate(id, { rating: r, source })} title={`Rate ${r}`} aria-label={`Rate ${r}`}
          className={cx('h-7 w-7 rounded-lg border flex items-center justify-center transition-colors',
            r === 'green' ? 'border-ok/35 hover:bg-ok/20' : r === 'yellow' ? 'border-warn/35 hover:bg-warn/20' : 'border-bad/35 hover:bg-bad/20')}>
          <RatingDot r={r} size={9} />
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Add / edit problem

export interface ProblemDraft {
  name: string; patternId: string; subPattern: string; difficulty: Difficulty; url: string; priority: Priority;
  initial: 'not_reviewed' | 'due_today' | 'backlog'; notes: string; weakness: string; phase: Phase | 'auto'; nextReview: string;
}

function ProblemFormDialog({ mode, id, prefill, onClose }: { mode: 'add' | 'edit'; id?: string; prefill?: Partial<ProblemDraft>; onClose: () => void }) {
  const d = useData(); const { toast } = useUi();
  const patterns = Object.values(d.patterns).sort((a, b) => a.order - b.order);
  const existing = id ? d.problems[id] : null;
  const [f, setF] = useState<ProblemDraft>(() => existing ? {
    name: existing.name, patternId: existing.patternId, subPattern: existing.subPattern, difficulty: existing.difficulty,
    url: existing.url, priority: existing.priority, initial: existing.track === 'backlog' ? 'backlog' : 'not_reviewed',
    notes: existing.notes, weakness: existing.weakness, phase: existing.phaseManual ? existing.phase : 'auto', nextReview: existing.nextReview ?? '',
  } : {
    name: '', patternId: patterns.find(p => p.learning === 'active')?.id ?? patterns[0]?.id ?? '', subPattern: '', difficulty: 'Medium', url: '',
    priority: 'Medium', initial: 'not_reviewed', notes: '', weakness: '', phase: 'auto', nextReview: '', ...prefill,
  });
  const [newPattern, setNewPattern] = useState('');
  const [forceDup, setForceDup] = useState(false);
  const set = (patch: Partial<ProblemDraft>) => { setF(x => ({ ...x, ...patch })); setForceDup(false); };
  const dups = useMemo(() => f.name.trim().length > 2 || f.url.trim() ? findDuplicates(f.name, f.url, id) : [], [f.name, f.url, id, d.problems]);
  const pt = d.patterns[f.patternId];
  const valid = f.name.trim() && (f.patternId || newPattern.trim());

  const save = () => {
    let patternId = f.patternId;
    if (f.patternId === '__new') {
      if (!newPattern.trim()) return;
      patternId = addPattern(newPattern.trim()).id;
    }
    if (dups.length && !forceDup && mode === 'add') { setForceDup(true); return; }
    if (mode === 'add') {
      const p = addProblem({ name: f.name, patternId, subPattern: f.subPattern, difficulty: f.difficulty, url: f.url, priority: f.priority, track: f.initial === 'backlog' ? 'backlog' : 'active', notes: f.notes, weakness: f.weakness, initial: f.initial });
      toast(`Added #${p.num} ${p.name}`);
    } else if (existing) {
      const patch: Partial<Problem> = {
        name: f.name.trim(), patternId, subPattern: f.subPattern.trim(), difficulty: f.difficulty, url: f.url.trim(), priority: f.priority,
        notes: f.notes, weakness: f.weakness, track: (f.initial === 'backlog' ? 'backlog' : 'active') as Track,
      };
      if (f.phase === 'auto') { patch.phaseManual = false; patch.phase = suggestPhase(existing.lastRating, existing.consecutiveGreen, null); }
      else { patch.phaseManual = true; patch.phase = f.phase; }
      if (existing.lastRating && f.nextReview && f.nextReview !== existing.nextReview) patch.nextReview = f.nextReview;
      updateProblem(existing.id, patch);
      toast('Changes saved');
    }
    onClose();
  };

  return (
    <Dialog open onClose={onClose} title={mode === 'add' ? 'Add problem' : `Edit #${existing?.num} ${existing?.name}`} width="max-w-xl"
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" disabled={!valid} onClick={save}>{forceDup ? 'Add anyway' : mode === 'add' ? 'Add problem' : 'Save changes'}</Button>
      </>}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <Field label="Problem name" htmlFor="pf-name" className="sm:col-span-2">
          <Input id="pf-name" data-autofocus value={f.name} onChange={e => set({ name: e.target.value })} placeholder="e.g. Container With Most Water" />
        </Field>
        <Field label="Problem URL" htmlFor="pf-url" className="sm:col-span-2" hint="LeetCode, GeeksforGeeks or any link">
          <Input id="pf-url" value={f.url} onChange={e => set({ url: e.target.value })} placeholder="https://leetcode.com/problems/…" />
        </Field>
        {dups.length > 0 && (
          <div className={cx('sm:col-span-2 rounded-lg border px-3 py-2.5 text-sm', forceDup ? 'border-hot/60 bg-hot/10' : 'border-warn/40 bg-warn/10')}>
            <div className="font-semibold text-fg">Possible duplicate</div>
            {dups.slice(0, 3).map(p => <div key={p.id} className="text-muted text-xs mt-1">#{p.num} {p.name} · {d.patterns[p.patternId]?.name}{p.url && normalizeEq(p.url, f.url) ? ' (same URL)' : ''}</div>)}
            {forceDup && <div className="text-xs text-fg mt-1.5">Press "Add anyway" to add it as a separate problem.</div>}
          </div>
        )}
        <Field label="Pattern" htmlFor="pf-pattern">
          <Select id="pf-pattern" value={f.patternId} onChange={e => set({ patternId: e.target.value, subPattern: '' })}>
            {patterns.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            <option value="__new">+ New pattern…</option>
          </Select>
        </Field>
        {f.patternId === '__new' ? (
          <Field label="New pattern name" htmlFor="pf-newpat"><Input id="pf-newpat" value={newPattern} onChange={e => setNewPattern(e.target.value)} placeholder="e.g. Tries" /></Field>
        ) : (
          <Field label="Sub-pattern" htmlFor="pf-sub">
            <Input id="pf-sub" list="pf-subs" value={f.subPattern} onChange={e => set({ subPattern: e.target.value })} placeholder="Optional" />
            <datalist id="pf-subs">{pt?.subPatterns.map(s => <option key={s} value={s} />)}</datalist>
          </Field>
        )}
        <Field label="Difficulty">
          <Segmented ariaLabel="Difficulty" value={f.difficulty} onChange={v => set({ difficulty: v })} options={DIFFICULTIES.map(x => ({ value: x, label: x }))} />
        </Field>
        <Field label="Priority">
          <Segmented ariaLabel="Priority" value={f.priority} onChange={v => set({ priority: v })} options={PRIORITIES.map(x => ({ value: x, label: x }))} />
        </Field>
        <Field label={mode === 'add' ? 'Initial status' : 'Track'} htmlFor="pf-initial" className="sm:col-span-2">
          <Select id="pf-initial" value={f.initial} onChange={e => set({ initial: e.target.value as ProblemDraft['initial'] })}>
            <option value="not_reviewed">Active · not reviewed yet</option>
            {mode === 'add' && <option value="due_today">Active · first attempt due today</option>}
            <option value="backlog">Yet to Learn (kept out of the daily queue)</option>
          </Select>
        </Field>
        {mode === 'edit' && existing && (
          <>
            <Field label="Revision phase" htmlFor="pf-phase">
              <Select id="pf-phase" value={f.phase} onChange={e => set({ phase: e.target.value as ProblemDraft['phase'] })}>
                <option value="auto">Auto (suggested)</option>
                {PHASES.map(p => <option key={p} value={p}>{p}</option>)}
              </Select>
            </Field>
            <Field label="Next review" htmlFor="pf-next" hint={existing.lastRating ? undefined : 'Available after the first revision'}>
              <Input id="pf-next" type="date" disabled={!existing.lastRating} value={f.nextReview} onChange={e => set({ nextReview: e.target.value })} />
            </Field>
            <Field label="Main weakness" htmlFor="pf-weak" className="sm:col-span-2">
              <Textarea id="pf-weak" rows={2} value={f.weakness} onChange={e => set({ weakness: e.target.value })} />
            </Field>
          </>
        )}
        <Field label="Notes" htmlFor="pf-notes" className="sm:col-span-2">
          <Textarea id="pf-notes" rows={3} value={f.notes} onChange={e => set({ notes: e.target.value })} placeholder="Approach, edge cases, mistake notes" />
        </Field>
      </div>
    </Dialog>
  );
}
const normalizeEq = (a: string, b: string) => a.trim().toLowerCase().replace(/\/+$/, '') === b.trim().toLowerCase().replace(/\/+$/, '');

// ---------------------------------------------------------------------------------------------
// Problem detail drawer

function ProblemDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const d = useData(); const s = settingsOf(d);
  const { rate, editProblem } = useApp();
  const { confirm, toast } = useUi();
  const p = id ? d.problems[id] : null;
  const history = useMemo(() => p ? Object.values(d.revisions).filter(r => r.problemId === p.id).sort((a, b) => (a.at < b.at ? 1 : -1)) : [], [d.revisions, p?.id]);
  if (!p) return null;
  const st = statusOf(p, s);
  const latest = latestRevisionOf(p.id);
  const pattern = d.patterns[p.patternId];
  const seq = history.slice().reverse();
  const trend = seq.length >= 2 ? (seq[seq.length - 1].rating === 'green' && seq[0].rating !== 'green' ? 'Improving' : seq[seq.length - 1].rating === 'red' && seq.length > 1 && seq[seq.length - 2].rating !== 'red' ? 'Regressed' : null) : null;

  const del = async () => {
    if (await confirm({ title: `Delete #${p.num} ${p.name}?`, body: `This removes the problem and its ${history.length} revision record${history.length === 1 ? '' : 's'}. It cannot be undone.`, confirmLabel: 'Delete', danger: true })) {
      deleteProblems([p.id]); onClose(); toast('Problem deleted');
    }
  };
  const undo = async () => {
    if (!latest) return;
    if (await confirm({ title: 'Undo the latest revision?', body: `The ${latest.rating} rating from ${fmt(latest.date)} is removed, and the problem returns to its previous rating and schedule.`, confirmLabel: 'Undo revision' })) {
      if (undoRevision(latest.id)) toast('Revision undone'); else toast('Only the latest revision can be undone', 'error');
    }
  };
  const Row = ({ k, v }: { k: string; v: React.ReactNode }) => (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-line/70 last:border-0 text-sm">
      <span className="text-muted shrink-0">{k}</span><span className="text-fg text-right min-w-0">{v}</span>
    </div>
  );

  return (
    <Drawer open onClose={onClose} title={p.name}>
      <div className="sticky top-0 z-10 bg-bg/95 backdrop-blur border-b border-line px-5 pt-4 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-mono text-muted">#{p.num} · {pattern?.name}{p.subPattern ? ` › ${p.subPattern}` : ''}</div>
            <h2 className="font-display text-xl font-extrabold text-fg mt-1 text-balance">{p.name}</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">✕</Button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
          <DiffPill d={p.difficulty} /><RatingPill r={p.lastRating} /><StatusPill s={st} /><PriorityPill p={p.priority} /><PhasePill p={p.phase} />
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          <Button variant="primary" size="sm" onClick={() => rate(p.id)}><Flame size={14} />Record revision</Button>
          {p.url && <a href={p.url} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line px-2.5 text-[13px] font-semibold text-fg hover:bg-surface2"><ExternalLink size={14} />Open problem</a>}
          <Button size="sm" variant="outline" onClick={() => editProblem(p.id)}><Pencil size={14} />Edit</Button>
          {latest && latest.prev && <Button size="sm" variant="ghost" onClick={undo}><Undo2 size={14} />Undo last</Button>}
          <Button size="sm" variant="ghost" className="hover:!text-bad-ink" onClick={del}><Trash2 size={14} />Delete</Button>
        </div>
      </div>
      <div className="px-5 py-4 flex flex-col gap-4">
        <Card className="px-4 py-1">
          <Row k="Last revised" v={p.lastRevised ? `${fmt(p.lastRevised)} (${relDay(p.lastRevised)})` : '—'} />
          <Row k="Next review" v={p.nextReview ? <span className={st === 'Overdue' ? 'text-bad-ink font-semibold' : ''}>{fmt(p.nextReview)} ({relDay(p.nextReview)})</span> : '—'} />
          <Row k="Revision type" v={revisionTypeOf(p.lastRating)} />
          <Row k="Consecutive green" v={<span className="tabular-nums">{p.consecutiveGreen} / {s.masteryStreak} for mastery</span>} />
          <Row k="Total revisions" v={<span className="tabular-nums">{p.revisionCount}</span>} />
          {p.importedName && <Row k="Name in source" v={<span className="text-muted">{p.importedName}</span>} />}
        </Card>
        {p.weakness && (
          <div className="rounded-xl border border-hot/30 bg-hot/8 px-4 py-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-hot-ink mb-1">Main weakness</div>
            <p className="text-sm text-fg leading-relaxed whitespace-pre-wrap">{p.weakness}</p>
          </div>
        )}
        {p.notes && (
          <div className="rounded-xl border border-line bg-surface px-4 py-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted mb-1">Notes</div>
            <p className="text-sm text-fg leading-relaxed whitespace-pre-wrap">{p.notes}</p>
          </div>
        )}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-display font-bold text-fg">Revision history</h3>
            {trend && <Tag className={trend === 'Improving' ? '!bg-ok/15 !text-ok-ink' : '!bg-bad/15 !text-bad-ink'}>{trend}</Tag>}
          </div>
          {seq.length > 0 && (
            <div className="flex items-center gap-1 mb-3 flex-wrap" aria-label="Rating sequence, oldest first">
              {seq.map(r => <span key={r.id} title={`${fmt(r.date)}: ${r.rating}`} className={cx('h-2.5 w-6 rounded-full', r.rating === 'green' ? 'bg-ok' : r.rating === 'yellow' ? 'bg-warn' : 'bg-bad')} />)}
              <span className="text-xs text-muted ml-1">oldest → latest</span>
            </div>
          )}
          {history.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
              <BookOpen size={18} className="mx-auto mb-2" />No revisions yet. Record the first one after you solve it.
            </div>
          ) : (
            <ol className="flex flex-col gap-2">
              {history.map(r => (
                <li key={r.id} className="rounded-xl border border-line bg-surface px-3.5 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2"><RatingPill r={r.rating} /><span className="text-sm font-semibold text-fg">{fmt(r.date, 'EEE, d MMM yyyy')}</span></div>
                    <div className="flex items-center gap-2 text-xs text-muted">
                      <PhasePill p={r.phase} />
                      {r.timeMin !== null && <span className="tabular-nums">{r.timeMin} min</span>}
                      {r.independent !== null && <span>{r.independent ? 'Independent' : 'With help'}</span>}
                    </div>
                  </div>
                  {r.mistake && <p className="text-sm text-fg mt-2 leading-relaxed"><span className="text-hot-ink font-semibold">Mistake: </span>{r.mistake}</p>}
                  {r.notes && <p className="text-xs text-muted mt-1.5 leading-relaxed">{r.notes}</p>}
                  <div className="text-[11px] text-muted mt-1.5">Next review set to {fmt(r.nextReview)} · {r.source === 'session' ? 'mixed practice' : r.source === 'today' ? "today's revision" : r.source === 'import' ? 'imported' : 'quick rating'}</div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </Drawer>
  );
}

export function PatternTag({ id }: { id: string }) {
  const d = useData(); const pt = d.patterns[id];
  return <Tag>{pt?.name ?? 'Unknown'}</Tag>;
}

// Shared hook: ticking clock for timers
export function useTicker(active: boolean, ms = 1000) {
  const [, setT] = useState(0);
  useEffect(() => { if (!active) return; const h = setInterval(() => setT(x => x + 1), ms); return () => clearInterval(h); }, [active, ms]);
}
