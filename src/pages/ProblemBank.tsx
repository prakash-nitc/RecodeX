import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Plus, Upload, Download, Trash2, ChevronLeft, ChevronRight, MoreHorizontal, ArrowUpDown, X, Pencil, History, Flame, SlidersHorizontal, Library } from 'lucide-react';
import { useData, settingsOf, bulkUpdate, deleteProblems, markNotReviewed, activateProblems } from '../lib/store';
import { statusOf, PRIORITY_RANK } from '../lib/engine';
import { fmt, today, addDays, relDay, diffDays } from '../lib/dates';
import type { Problem, Status, Priority } from '../types';
import { STATUSES, PHASES, PRIORITIES, DIFFICULTIES } from '../types';
import {
  Button, Card, PageHeader, SearchInput, Select, Checkbox, DiffPill, RatingPill, StatusPill, PriorityPill, PhasePill, Tag, cx, Empty, Dialog, Field, Input, useUi, LinkButton, Segmented, RatingDot,
} from '../components/ui';
import { useApp, QuickRate } from '../components/shared';
import { MountainScene } from '../components/art/Mountains';
import { CsvDialog } from './CsvDialog';

export interface Filters {
  q: string; pattern: string; difficulty: string; rating: string; priority: string; phase: string; status: string;
  sort: 'next' | 'priority' | 'last' | 'num' | 'name';
}
export const EMPTY_FILTERS: Filters = { q: '', pattern: '', difficulty: '', rating: '', priority: '', phase: '', status: '', sort: 'next' };

export function applyFilters(problems: Problem[], f: Filters, statusFn: (p: Problem) => Status) {
  const q = f.q.trim().toLowerCase();
  const list = problems.filter(p =>
    (!q || p.name.toLowerCase().includes(q) || String(p.num) === q.replace('#', '') || p.subPattern.toLowerCase().includes(q)) &&
    (!f.pattern || p.patternId === f.pattern) && (!f.difficulty || p.difficulty === f.difficulty) &&
    (!f.rating || (f.rating === 'none' ? !p.lastRating : p.lastRating === f.rating)) &&
    (!f.priority || p.priority === f.priority) && (!f.phase || p.phase === f.phase) && (!f.status || statusFn(p) === f.status));
  const nx = (p: Problem) => p.nextReview ?? '9999';
  const sorters: Record<Filters['sort'], (a: Problem, b: Problem) => number> = {
    next: (a, b) => (nx(a) < nx(b) ? -1 : nx(a) > nx(b) ? 1 : PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.num - b.num),
    priority: (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || (nx(a) < nx(b) ? -1 : 1),
    last: (a, b) => ((b.lastRevised ?? '') < (a.lastRevised ?? '') ? -1 : (b.lastRevised ?? '') > (a.lastRevised ?? '') ? 1 : a.num - b.num),
    num: (a, b) => a.num - b.num,
    name: (a, b) => a.name.localeCompare(b.name),
  };
  return list.sort(sorters[f.sort]);
}

export function FilterBar({ f, setF, hidePattern }: { f: Filters; setF: (f: Filters) => void; hidePattern?: boolean }) {
  const d = useData(); const manualPri = !settingsOf(d).autoPriority; // with autoPriority, priority only mirrors the rating
  const patterns = Object.values(d.patterns).sort((a, b) => a.order - b.order);
  const up = (patch: Partial<Filters>) => setF({ ...f, ...patch });
  const active = Object.entries(f).filter(([k, v]) => k !== 'sort' && k !== 'q' && v && !(hidePattern && k === 'pattern')).length;
  const [open, setOpen] = useState(active > 0);
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap gap-2">
        <SearchInput id="bank-q" value={f.q} onChange={q => up({ q })} placeholder="Search by name, #ID or sub-pattern" />
        <Button variant={open || active ? 'outline' : 'ghost'} className={cx('h-10', active > 0 && 'border-accent/50 text-accent-ink')} onClick={() => setOpen(!open)} aria-expanded={open}>
          <SlidersHorizontal size={15} />Filters{active ? ` · ${active}` : ''}
        </Button>
        <div className="flex items-center gap-1.5">
          <ArrowUpDown size={14} className="text-muted" />
          <Select aria-label="Sort" value={f.sort} onChange={e => up({ sort: e.target.value as Filters['sort'] })}>
            <option value="next">Next review ↑</option>{(manualPri || f.sort === 'priority') && <option value="priority">Priority</option>}<option value="last">Last revised ↓</option><option value="num">Problem ID</option><option value="name">Name</option>
          </Select>
        </div>
      </div>
      {open && (
        <div className="flex flex-wrap gap-2 rounded-2xl border border-line bg-surface p-2.5 animate-page-in">
          {!hidePattern && <Select aria-label="Pattern" value={f.pattern} onChange={e => up({ pattern: e.target.value })}><option value="">Pattern: All</option>{patterns.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>}
          <Select aria-label="Difficulty" value={f.difficulty} onChange={e => up({ difficulty: e.target.value })}><option value="">Difficulty: All</option>{DIFFICULTIES.map(x => <option key={x}>{x}</option>)}</Select>
          <Select aria-label="Rating" value={f.rating} onChange={e => up({ rating: e.target.value })}><option value="">Rating: All</option><option value="green">Green</option><option value="yellow">Yellow</option><option value="red">Red</option><option value="none">Not reviewed</option></Select>
          {(manualPri || f.priority) && <Select aria-label="Priority" value={f.priority} onChange={e => up({ priority: e.target.value })}><option value="">Priority: All</option>{PRIORITIES.map(x => <option key={x}>{x}</option>)}</Select>}
          <Select aria-label="Phase" value={f.phase} onChange={e => up({ phase: e.target.value })}><option value="">Phase: All</option>{PHASES.map(x => <option key={x}>{x}</option>)}</Select>
          <Select aria-label="Status" value={f.status} onChange={e => up({ status: e.target.value })}><option value="">Status: All</option>{STATUSES.map(x => <option key={x}>{x}</option>)}</Select>
          {active > 0 && <Button variant="ghost" className="h-10" onClick={() => setF({ ...EMPTY_FILTERS, q: f.q, sort: f.sort, pattern: hidePattern ? f.pattern : '' })}><X size={14} />Clear {active}</Button>}
        </div>
      )}
    </div>
  );
}

function NextCell({ p, st, t }: { p: Problem; st: Status; t: string }) {
  if (!p.nextReview) return <span className="text-muted">—</span>;
  const od = st === 'Overdue' ? diffDays(t, p.nextReview) : 0;
  return (
    <span className={cx('tabular-nums whitespace-nowrap', st === 'Overdue' ? 'text-hot-ink font-semibold' : st === 'Due Today' ? 'text-hot-ink font-semibold' : 'text-muted')} title={fmt(p.nextReview, 'EEE, d MMM yyyy')}>
      {st === 'Overdue' ? `${od}d overdue` : relDay(p.nextReview, t)}
    </span>
  );
}

const PAGE_SIZES = [50, 100, 200];

export function ProblemTable({ problems, emptyText }: { problems: Problem[]; emptyText?: string }) {
  const d = useData(); const s = settingsOf(d); const manualPri = !s.autoPriority;
  const { openProblem, editProblem, rate } = useApp();
  const { confirm, toast } = useUi();
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(PAGE_SIZES[0]);
  const [bulk, setBulk] = useState<null | 'priority' | 'pattern' | 'reschedule'>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const pages = Math.max(1, Math.ceil(problems.length / size));
  useEffect(() => { if (page >= pages) setPage(0); }, [pages]);
  useEffect(() => { setSel(x => new Set([...x].filter(id => d.problems[id]))); }, [d.problems]);
  const rows = problems.slice(page * size, page * size + size);
  const allOnPage = rows.length > 0 && rows.every(r => sel.has(r.id));
  const toggle = (id: string) => setSel(x => { const n = new Set(x); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const ids = [...sel];
  const t = today();

  const doDelete = async (list: string[]) => {
    const set = new Set(list);
    const revCount = Object.values(d.revisions).filter(r => set.has(r.problemId)).length;
    if (await confirm({ title: `Delete ${list.length} problem${list.length === 1 ? '' : 's'}?`, body: `This also removes ${revCount} revision record${revCount === 1 ? '' : 's'}. It cannot be undone. Export a CSV first if you might want them back.`, confirmLabel: 'Delete', danger: true })) {
      deleteProblems(list); setSel(new Set()); toast(`Deleted ${list.length} problem${list.length === 1 ? '' : 's'}`);
    }
  };
  const doNotReviewed = async () => {
    if (await confirm({ title: `Mark ${ids.length} as not reviewed?`, body: 'Their rating, dates and green streak are cleared. Revision history is kept.', confirmLabel: 'Mark not reviewed' })) {
      markNotReviewed(ids); toast(`${ids.length} marked not reviewed`); setSel(new Set());
    }
  };
  const actions = (p: Problem) => (
    <div className="flex items-center justify-end gap-1 relative">
      <QuickRate id={p.id} />
      <Button size="icon" variant="ghost" aria-label="More actions" aria-expanded={menu === p.id} onClick={() => setMenu(menu === p.id ? null : p.id)}><MoreHorizontal size={16} /></Button>
      {menu === p.id && (
        <div className="absolute right-0 top-9 z-20 w-48 rounded-2xl border border-line bg-surface p-1.5 shadow-pop animate-pop-in" onMouseLeave={() => setMenu(null)}>
          <MenuItem icon={<History size={14} />} onClick={() => { setMenu(null); openProblem(p.id); }}>Details & history</MenuItem>
          <MenuItem icon={<Pencil size={14} />} onClick={() => { setMenu(null); editProblem(p.id); }}>Edit</MenuItem>
          <MenuItem icon={<Flame size={14} />} onClick={() => { setMenu(null); rate(p.id); }}>Record revision</MenuItem>
          <MenuItem icon={<Trash2 size={14} />} danger onClick={() => { setMenu(null); doDelete([p.id]); }}>Delete</MenuItem>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-w-0">
      {sel.size > 0 && (
        <div className="sticky top-14 lg:top-2 z-20 mb-3 flex flex-wrap items-center gap-2 rounded-2xl border border-accent/40 bg-surface px-3 py-2 shadow-lift animate-page-in">
          <span className="text-sm font-semibold text-fg tabular-nums mr-1">{sel.size} selected</span>
          {manualPri && <Button size="sm" variant="outline" onClick={() => setBulk('priority')}>Priority</Button>}
          <Button size="sm" variant="outline" onClick={() => setBulk('pattern')}>Pattern</Button>
          <Button size="sm" variant="outline" onClick={() => setBulk('reschedule')}>Reschedule</Button>
          <Button size="sm" variant="outline" onClick={doNotReviewed}>Mark not reviewed</Button>
          <Button size="sm" variant="outline" onClick={() => { activateProblems(ids); toast('Moved to active revision'); setSel(new Set()); }}>Activate</Button>
          <Button size="sm" variant="outline" onClick={() => { bulkUpdate(ids, p => p.lastRating ? {} : { track: 'backlog' }); toast('Never-reviewed ones moved to Yet to Learn'); setSel(new Set()); }}>To backlog</Button>
          <Button size="sm" variant="ghost" className="hover:!text-bad-ink" onClick={() => doDelete(ids)}><Trash2 size={14} />Delete</Button>
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setSel(new Set())}>Clear</Button>
        </div>
      )}
      <Card className="overflow-hidden">
        {/* Desktop and tablet: compact table */}
        <div className="relative hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-surface2/50 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-muted">
                <th className="w-10 px-3 py-2.5"><Checkbox checked={allOnPage} onChange={v => setSel(x => { const n = new Set(x); rows.forEach(r => v ? n.add(r.id) : n.delete(r.id)); return n; })} label={<span className="sr-only">Select page</span>} /></th>
                <th className="px-2 py-2.5 w-12">#</th>
                <th className="px-2 py-2.5">Problem</th>
                <th className="px-2 py-2.5">Pattern</th>
                <th className="px-2 py-2.5 hidden 2xl:table-cell">Difficulty</th>
                <th className="px-2 py-2.5">Rating</th>
                <th className="px-2 py-2.5">Next review</th>
                <th className="px-2 py-2.5 hidden 2xl:table-cell">Phase</th>
                <th className="px-2 py-2.5 hidden lg:table-cell">Status</th>
                {manualPri && <th className="px-2 py-2.5 hidden 2xl:table-cell">Priority</th>}
                <th className="px-2 py-2.5 text-right hidden xl:table-cell">Revs</th>
                <th className="px-2 py-2.5 text-right pr-3"><span className="sr-only">Rate and actions</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(p => {
                const st = statusOf(p, s, t);
                return (
                  <tr key={p.id} className={cx('group border-b border-line/60 last:border-0 hover:bg-surface2/60 cursor-pointer transition-colors', sel.has(p.id) && 'bg-accent/6')} onClick={() => openProblem(p.id)}>
                    <td className="px-3 py-2" onClick={e => e.stopPropagation()}><Checkbox checked={sel.has(p.id)} onChange={() => toggle(p.id)} label={<span className="sr-only">Select {p.name}</span>} /></td>
                    <td className="px-2 py-2 font-mono text-xs text-muted tabular-nums">{p.num}</td>
                    <td className="px-2 py-2 max-w-[260px]">
                      <div className="flex items-center gap-1">
                        <span className="font-semibold text-fg truncate group-hover:text-accent-ink transition-colors" title={p.name}>{p.name}</span>
                        {p.url && <LinkButton url={p.url} size="icon" />}
                      </div>
                      {(p.subPattern || p.weakness) && <div className="text-[11px] text-muted truncate" title={p.weakness}>{p.weakness ? `⚑ ${p.weakness}` : p.subPattern}</div>}
                    </td>
                    <td className="px-2 py-2"><Tag>{d.patterns[p.patternId]?.name ?? '—'}</Tag></td>
                    <td className="px-2 py-2 hidden 2xl:table-cell"><DiffPill d={p.difficulty} /></td>
                    <td className="px-2 py-2"><RatingPill r={p.lastRating} /></td>
                    <td className="px-2 py-2"><NextCell p={p} st={st} t={t} /></td>
                    <td className="px-2 py-2 hidden 2xl:table-cell"><PhasePill p={p.phase} /></td>
                    <td className="px-2 py-2 hidden lg:table-cell"><StatusPill s={st} /></td>
                    {manualPri && <td className="px-2 py-2 hidden 2xl:table-cell"><PriorityPill p={p.priority} /></td>}
                    <td className="px-2 py-2 text-right tabular-nums text-muted hidden xl:table-cell">{p.revisionCount}</td>
                    <td className="px-2 py-2 pr-3" onClick={e => e.stopPropagation()}>{actions(p)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {/* Phone: compact cards, no sideways scrolling */}
        <ul className="md:hidden divide-y divide-line/70">
          {rows.map(p => {
            const st = statusOf(p, s, t);
            return (
              <li key={p.id} className={cx('flex items-start gap-3 px-3 py-3', sel.has(p.id) && 'bg-accent/6')}>
                <div className="pt-0.5"><Checkbox checked={sel.has(p.id)} onChange={() => toggle(p.id)} label={<span className="sr-only">Select {p.name}</span>} /></div>
                <button className="min-w-0 flex-1 text-left" onClick={() => openProblem(p.id)}>
                  <div className="flex items-center gap-2"><RatingDot r={p.lastRating} /><span className="text-sm font-semibold text-fg truncate">{p.name}</span></div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <Tag>{d.patterns[p.patternId]?.name ?? '—'}</Tag><DiffPill d={p.difficulty} />
                    {st !== 'Scheduled' && <StatusPill s={st} />}
                    <span className="text-[11px]"><NextCell p={p} st={st} t={t} /></span>
                  </div>
                </button>
                <div onClick={e => e.stopPropagation()}>{actions(p)}</div>
              </li>
            );
          })}
        </ul>
        {problems.length === 0 && <Empty art={<MountainScene className="h-28 w-full" />} title="No problems match" body={emptyText ?? 'Change the filters, or add a problem.'} />}
        {problems.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-2.5 text-xs text-muted">
            <span className="tabular-nums">Showing {page * size + 1}–{Math.min(problems.length, page * size + size)} of {problems.length}</span>
            <div className="flex items-center gap-2">
              <Select aria-label="Rows per page" className="!h-8 text-xs" value={size} onChange={e => { setSize(Number(e.target.value)); setPage(0); }}>
                {PAGE_SIZES.map(n => <option key={n} value={n}>{n} / page</option>)}
              </Select>
              <Button size="icon" variant="ghost" disabled={page === 0} onClick={() => setPage(page - 1)} aria-label="Previous page"><ChevronLeft size={16} /></Button>
              <span className="tabular-nums px-1">{page + 1} / {pages}</span>
              <Button size="icon" variant="ghost" disabled={page >= pages - 1} onClick={() => setPage(page + 1)} aria-label="Next page"><ChevronRight size={16} /></Button>
            </div>
          </div>
        )}
      </Card>
      {bulk && <BulkDialog kind={bulk} ids={ids} onClose={() => setBulk(null)} onDone={() => { setBulk(null); setSel(new Set()); }} />}
    </div>
  );
}

function MenuItem({ icon, children, onClick, danger }: { icon: React.ReactNode; children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return <button onClick={onClick} className={cx('flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-sm hover:bg-surface2', danger ? 'text-bad-ink' : 'text-fg')}>{icon}{children}</button>;
}

function BulkDialog({ kind, ids, onClose, onDone }: { kind: 'priority' | 'pattern' | 'reschedule'; ids: string[]; onClose: () => void; onDone: () => void }) {
  const d = useData(); const { toast } = useUi();
  const patterns = Object.values(d.patterns).sort((a, b) => a.order - b.order);
  const [priority, setPriority] = useState<Priority>('High');
  const [pattern, setPattern] = useState(patterns[0]?.id ?? '');
  const [sub, setSub] = useState('');
  const [mode, setMode] = useState<'date' | 'shift'>('date');
  const [date, setDate] = useState(today());
  const [shift, setShift] = useState('1');
  const apply = () => {
    if (kind === 'priority') bulkUpdate(ids, () => ({ priority }));
    if (kind === 'pattern') bulkUpdate(ids, () => ({ patternId: pattern, subPattern: sub.trim() }));
    if (kind === 'reschedule') {
      const n = Number(shift) || 0;
      bulkUpdate(ids, p => ({ nextReview: mode === 'date' ? date : addDays(p.nextReview ?? today(), n) }));
    }
    toast(`Updated ${ids.length} problem${ids.length === 1 ? '' : 's'}`); onDone();
  };
  const title = kind === 'priority' ? 'Change priority' : kind === 'pattern' ? 'Move to pattern' : 'Reschedule revisions';
  return (
    <Dialog open onClose={onClose} title={title} sub={`${ids.length} selected`} width="max-w-md"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={apply}>Apply</Button></>}>
      {kind === 'priority' && <Segmented ariaLabel="Priority" value={priority} onChange={setPriority} options={PRIORITIES.map(p => ({ value: p, label: p }))} />}
      {kind === 'pattern' && (
        <div className="flex flex-col gap-3">
          <Field label="Pattern" htmlFor="bk-pat"><Select id="bk-pat" className="!w-full" value={pattern} onChange={e => setPattern(e.target.value)}>{patterns.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
          <Field label="Sub-pattern" htmlFor="bk-sub"><Input id="bk-sub" list="bk-subs" value={sub} onChange={e => setSub(e.target.value)} placeholder="Optional" /><datalist id="bk-subs">{d.patterns[pattern]?.subPatterns.map(s => <option key={s} value={s} />)}</datalist></Field>
        </div>
      )}
      {kind === 'reschedule' && (
        <div className="flex flex-col gap-3">
          <Segmented ariaLabel="Reschedule mode" value={mode} onChange={setMode} options={[{ value: 'date', label: 'Set a date' }, { value: 'shift', label: 'Shift by days' }]} />
          {mode === 'date' ? <Field label="Next review date" htmlFor="bk-date"><Input id="bk-date" type="date" value={date} onChange={e => setDate(e.target.value)} /></Field>
            : <Field label="Days to add (negative brings it earlier)" htmlFor="bk-shift"><Input id="bk-shift" type="number" value={shift} onChange={e => setShift(e.target.value)} /></Field>}
          <p className="text-xs text-muted">Never-reviewed problems get this date as their first scheduled attempt.</p>
        </div>
      )}
    </Dialog>
  );
}

const QUICK: { status: Status; label: string; cls: string }[] = [
  { status: 'Overdue', label: 'Overdue', cls: 'text-hot-ink' },
  { status: 'Due Today', label: 'Due today', cls: 'text-hot-ink' },
  { status: 'Not Reviewed', label: 'Not reviewed', cls: 'text-idle-ink' },
  { status: 'Scheduled', label: 'Scheduled', cls: 'text-fg' },
  { status: 'Mastered', label: 'Mastered', cls: 'text-ok-ink' },
  { status: 'Yet to Learn', label: 'Yet to learn', cls: 'text-muted' },
];

export default function ProblemBank({ initial }: { initial?: Partial<Filters> }) {
  const d = useData(); const s = settingsOf(d);
  const { addProblemDialog } = useApp();
  const [f, setF] = useState<Filters>({ ...EMPTY_FILTERS, ...initial });
  const [csv, setCsv] = useState<null | 'import' | 'export'>(null);
  useEffect(() => { if (initial) setF({ ...EMPTY_FILTERS, ...initial }); }, [JSON.stringify(initial)]);
  const t = today();
  // Deferred filters keep typing responsive with thousands of problems.
  const df = useDeferredValue(f);
  const statusMap = useMemo(() => new Map(Object.values(d.problems).map(p => [p.id, statusOf(p, s, t)])), [d.problems, d.meta]);
  const list = useMemo(() => applyFilters(Object.values(d.problems), df, p => statusMap.get(p.id)!), [d.problems, df, statusMap]);
  const counts = useMemo(() => { const c = new Map<Status, number>(); for (const v of statusMap.values()) c.set(v, (c.get(v) ?? 0) + 1); return c; }, [statusMap]);
  const total = Object.keys(d.problems).length;
  return (
    <div>
      <PageHeader eyebrow={<span className="inline-flex items-center gap-1.5"><Library size={13} />Library</span>} title="Problem Bank" sub={`${total} problems across ${Object.keys(d.patterns).length} patterns`}
        right={<>
          <Button variant="outline" onClick={() => setCsv('import')}><Upload size={15} />Import CSV</Button>
          <Button variant="outline" onClick={() => setCsv('export')}><Download size={15} />Export CSV</Button>
          <Button variant="primary" onClick={() => addProblemDialog(f.pattern ? { patternId: f.pattern } : undefined)}><Plus size={16} />Add problem</Button>
        </>} />
      <div className="mb-3 -mx-1 flex gap-2 overflow-x-auto scroll-thin px-1 pb-1" role="group" aria-label="Quick status filters">
        {QUICK.map(q => {
          const on = f.status === q.status; const n = counts.get(q.status) ?? 0;
          return (
            <button key={q.status} onClick={() => setF({ ...f, status: on ? '' : q.status })} aria-pressed={on}
              className={cx('shrink-0 rounded-2xl border px-3.5 py-2 text-left transition-colors', on ? 'border-accent bg-accent/10' : 'border-line bg-surface hover:border-muted/50')}>
              <div className={cx('font-display text-lg font-semibold tabular-nums leading-none', n ? q.cls : 'text-muted')}>{n}</div>
              <div className="mt-1 text-[11px] font-semibold text-muted whitespace-nowrap">{q.label}</div>
            </button>
          );
        })}
      </div>
      <div className="mb-4"><FilterBar f={f} setF={setF} /></div>
      <ProblemTable problems={list} />
      {csv && <CsvDialog mode={csv} onClose={() => setCsv(null)} />}
    </div>
  );
}
