import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Plus, Upload, Download, Trash2, ChevronLeft, ChevronRight, ChevronDown, MoreHorizontal, ArrowUpDown, X, Pencil, History, Flame, SlidersHorizontal, Library, ArrowRight } from 'lucide-react';
import { useData, settingsOf, bulkUpdate, deleteProblems, markNotReviewed, activateProblems } from '../lib/store';
import { statusOf, PRIORITY_RANK } from '../lib/engine';
import { byStudyOrder } from '../lib/order';
import { fmt, today, addDays, relDay, diffDays } from '../lib/dates';
import type { Pattern, Problem, Status, Priority } from '../types';
import { STATUSES, PHASES, PRIORITIES, DIFFICULTIES } from '../types';
import {
  Button, Card, PageHeader, SearchInput, Select, Checkbox, DiffPill, RatingPill, StatusPill, PriorityPill, PhasePill, Tag, cx, Empty, Dialog, Field, Input, useUi, LinkButton, Segmented, RatingDot, GYRBar,
} from '../components/ui';
import { useApp, QuickRate, usePositions } from '../components/shared';
import { MountainScene } from '../components/art/Mountains';
import { patternRoute } from './Patterns';
import { CsvDialog } from './CsvDialog';

export interface Filters {
  q: string; pattern: string; difficulty: string; rating: string; priority: string; phase: string; status: string;
  sort: 'pattern' | 'next' | 'priority' | 'last' | 'num' | 'name';
}
export const EMPTY_FILTERS: Filters = { q: '', pattern: '', difficulty: '', rating: '', priority: '', phase: '', status: '', sort: 'pattern' };

/** True when anything narrows the list (search or a filter), as opposed to only a sort. */
export const isFiltering = (f: Filters, ignorePattern = false) =>
  Object.entries(f).some(([k, v]) => k !== 'sort' && v && !(ignorePattern && k === 'pattern'));

export function applyFilters(problems: Problem[], f: Filters, statusFn: (p: Problem) => Status, patterns: Record<string, Pattern>) {
  const q = f.q.trim().toLowerCase();
  const list = problems.filter(p =>
    (!q || p.name.toLowerCase().includes(q) || String(p.num) === q.replace('#', '') || p.subPattern.toLowerCase().includes(q)) &&
    (!f.pattern || p.patternId === f.pattern) && (!f.difficulty || p.difficulty === f.difficulty) &&
    (!f.rating || (f.rating === 'none' ? !p.lastRating : p.lastRating === f.rating)) &&
    (!f.priority || p.priority === f.priority) && (!f.phase || p.phase === f.phase) && (!f.status || statusFn(p) === f.status));
  const nx = (p: Problem) => p.nextReview ?? '9999';
  const sorters: Record<Filters['sort'], (a: Problem, b: Problem) => number> = {
    pattern: byStudyOrder(patterns),
    next: (a, b) => (nx(a) < nx(b) ? -1 : nx(a) > nx(b) ? 1 : PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.num - b.num),
    priority: (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || (nx(a) < nx(b) ? -1 : 1),
    last: (a, b) => ((b.lastRevised ?? '') < (a.lastRevised ?? '') ? -1 : (b.lastRevised ?? '') > (a.lastRevised ?? '') ? 1 : a.num - b.num),
    num: (a, b) => a.num - b.num,
    name: (a, b) => a.name.localeCompare(b.name),
  };
  return list.sort(sorters[f.sort] ?? sorters.pattern);
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
        <SearchInput id="bank-q" value={f.q} onChange={q => up({ q })} placeholder="Search by name or sub-pattern" />
        <Button variant={open || active ? 'outline' : 'ghost'} className={cx('h-10', active > 0 && 'border-interactive/50 text-accent-ink')} onClick={() => setOpen(!open)} aria-expanded={open}>
          <SlidersHorizontal size={15} />Filters{active ? ` · ${active}` : ''}
        </Button>
        <div className="flex items-center gap-1.5">
          <ArrowUpDown size={14} className="text-muted" />
          <Select aria-label="Sort" value={f.sort} onChange={e => up({ sort: e.target.value as Filters['sort'] })}>
            <option value="pattern">Study order</option><option value="next">Next review ↑</option>{(manualPri || f.sort === 'priority') && <option value="priority">Priority</option>}<option value="last">Last revised ↓</option><option value="num">Date added</option><option value="name">Name</option>
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
const GROUP_PAGE = 50;          // rows shown per expanded group before "Show more"
const OPEN_KEY = 'recodex-bank-open';
const readOpen = (): Set<string> => { try { return new Set(JSON.parse(localStorage.getItem(OPEN_KEY) ?? '[]')); } catch { return new Set(); } };
const writeOpen = (s: Set<string>) => { try { localStorage.setItem(OPEN_KEY, JSON.stringify([...s])); } catch { /* per-device convenience only */ } };

type GroupLine = { kind: 'group'; pattern: Pattern | null; patternId: string; rows: Problem[]; total: number; open: boolean };
type MoreLine = { kind: 'more'; patternId: string; hidden: number };
type Line = GroupLine | MoreLine | { kind: 'sub'; key: string; label: string; count: number } | { kind: 'row'; p: Problem };

/**
 * The problem list. `layout`:
 *  - 'grouped': collapsible pattern sections in journey order (the bank's default)
 *  - 'flat':    one sortable, paginated table
 * `dividers` adds sub-pattern divider rows (only meaningful in study order).
 * `filtering` (search or filters active) expands every group that has matches.
 */
export function ProblemTable({ problems, emptyText, layout = 'flat', dividers = false, filtering = false, singlePattern = false }: {
  problems: Problem[]; emptyText?: string; layout?: 'grouped' | 'flat'; dividers?: boolean; filtering?: boolean;
  /** The list is one pattern's (its own page): the pattern column would repeat the same name. */
  singlePattern?: boolean;
}) {
  const d = useData(); const s = settingsOf(d); const manualPri = !s.autoPriority;
  const pos = usePositions();
  const { openProblem, editProblem, rate, go } = useApp();
  const { confirm, toast } = useUi();
  const grouped = layout === 'grouped';
  const showPattern = !grouped && !singlePattern;
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(PAGE_SIZES[0]);
  const [bulk, setBulk] = useState<null | 'priority' | 'pattern' | 'reschedule'>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [openGroups, setOpenGroups] = useState<Set<string>>(readOpen);
  const [override, setOverride] = useState<Record<string, boolean>>({}); // toggles made while filtering
  const [limits, setLimits] = useState<Record<string, number>>({});
  useEffect(() => { setOverride({}); }, [filtering]);
  const pages = Math.max(1, Math.ceil(problems.length / size));
  useEffect(() => { if (page >= pages) setPage(0); }, [pages]);
  useEffect(() => { setSel(x => new Set([...x].filter(id => d.problems[id]))); }, [d.problems]);
  const toggle = (id: string) => setSel(x => { const n = new Set(x); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const ids = [...sel];
  const t = today();
  const isOpen = (id: string) => override[id] ?? (filtering || openGroups.has(id));
  const toggleGroup = (id: string) => {
    if (filtering) { setOverride(o => ({ ...o, [id]: !isOpen(id) })); return; }
    setOpenGroups(g => { const n = new Set(g); n.has(id) ? n.delete(id) : n.add(id); writeOpen(n); return n; });
  };

  // Lines to render, and the problems currently on screen (for "select all").
  const { lines, visible } = useMemo(() => {
    const subLines = (rows: Problem[], keyPrefix: string): Line[] => {
      const out: Line[] = []; let cur: string | null = null;
      for (const p of rows) {
        if (dividers && p.subPattern !== cur) {
          cur = p.subPattern;
          const label = cur;
          out.push({ kind: 'sub', key: `${keyPrefix}|${label}`, label: label || 'No sub-pattern', count: rows.filter(x => x.subPattern === label).length });
        }
        out.push({ kind: 'row', p });
      }
      return out;
    };
    if (!grouped) {
      const rows = problems.slice(page * size, page * size + size);
      return { lines: subLines(rows, 'flat'), visible: rows };
    }
    const byPattern = new Map<string, Problem[]>();
    for (const p of problems) { const a = byPattern.get(p.patternId) ?? []; a.push(p); byPattern.set(p.patternId, a); }
    const totals = new Map<string, number>();
    for (const p of Object.values(d.problems)) totals.set(p.patternId, (totals.get(p.patternId) ?? 0) + 1);
    const order = [...byPattern.keys()].sort((a, b) => (d.patterns[a]?.order ?? Infinity) - (d.patterns[b]?.order ?? Infinity));
    const out: Line[] = []; const vis: Problem[] = [];
    for (const id of order) {
      const rows = byPattern.get(id)!; const open = override[id] ?? (filtering || openGroups.has(id));
      out.push({ kind: 'group', pattern: d.patterns[id] ?? null, patternId: id, rows, total: totals.get(id) ?? rows.length, open });
      if (!open) continue;
      const shown = rows.slice(0, limits[id] ?? GROUP_PAGE);
      out.push(...subLines(shown, id)); vis.push(...shown);
      if (shown.length < rows.length) out.push({ kind: 'more', patternId: id, hidden: rows.length - shown.length });
    }
    return { lines: out, visible: vis };
  }, [problems, grouped, page, size, dividers, openGroups, override, filtering, limits, d.patterns, d.problems]);

  const allVisible = visible.length > 0 && visible.every(r => sel.has(r.id));
  const setMany = (list: Problem[], v: boolean) => setSel(x => { const n = new Set(x); list.forEach(r => v ? n.add(r.id) : n.delete(r.id)); return n; });

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
  const posTitle = (p: Problem) => `No. ${pos.get(p.id) ?? '?'} in ${d.patterns[p.patternId]?.name ?? 'its pattern'} · added as #${p.num}`;

  const groupHeader = (l: GroupLine, phone?: boolean) => {
    const c = { g: 0, y: 0, r: 0, n: 0 };
    for (const p of l.rows) { if (p.lastRating === 'green') c.g++; else if (p.lastRating === 'yellow') c.y++; else if (p.lastRating === 'red') c.r++; else c.n++; }
    const groupSel = l.rows.length > 0 && l.rows.every(r => sel.has(r.id));
    const name = l.pattern?.name ?? 'Unknown pattern';
    return (
      <div className={cx('flex items-center gap-3', phone ? 'px-3 py-3' : 'py-2.5 pr-3')}>
        <Checkbox checked={groupSel} onChange={v => setMany(l.rows, v)} label={<span className="sr-only">Select all in {name}</span>} />
        <button className="flex min-w-0 flex-1 items-center gap-2.5 text-left" onClick={() => toggleGroup(l.patternId)} aria-expanded={l.open} aria-label={`${name}, ${l.rows.length} problems`}>
          <ChevronDown size={16} className={cx('shrink-0 text-muted transition-transform', !l.open && '-rotate-90')} />
          <span className="truncate font-display text-[15px] font-semibold text-fg">{name}</span>
          <span className="shrink-0 text-xs font-semibold tabular-nums text-muted">{filtering && l.rows.length !== l.total ? `${l.rows.length} of ${l.total}` : l.total}</span>
          <span className="hidden sm:block w-28 shrink-0 lg:w-40"><GYRBar g={c.g} y={c.y} r={c.r} n={c.n} height={6} /></span>
          {l.pattern && l.pattern.learning !== 'active' && <span className="hidden sm:inline shrink-0 rounded-lg border border-dashed border-line px-1.5 py-0.5 text-[10px] font-semibold text-muted">{l.pattern.learning === 'learning' ? 'Learning' : 'Yet to learn'}</span>}
        </button>
        {l.pattern && <Button size="sm" variant="ghost" className="shrink-0" onClick={() => go(patternRoute(l.patternId))} aria-label={`Open ${name} page`}><span className="hidden sm:inline">Open</span><ArrowRight size={14} /></Button>}
      </div>
    );
  };
  const moreButton = (l: MoreLine) => (
    <Button size="sm" variant="ghost" onClick={() => setLimits(m => ({ ...m, [l.patternId]: (m[l.patternId] ?? GROUP_PAGE) + GROUP_PAGE }))}>
      Show {Math.min(GROUP_PAGE, l.hidden)} more <span className="text-muted">({l.hidden} hidden)</span>
    </Button>
  );

  return (
    <div className="min-w-0">
      {sel.size > 0 && (
        <div className="sticky top-14 lg:top-2 z-20 mb-3 flex flex-wrap items-center gap-2 rounded-2xl border border-interactive/40 bg-surface px-3 py-2 shadow-lift animate-page-in">
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
        {/* Desktop and tablet: one table, so columns line up across groups */}
        <div className="relative hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className={cx(grouped && !visible.length && 'hidden')}>
              <tr className="border-b border-line bg-surface2/50 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-muted">
                <th className="w-10 px-3 py-2.5"><Checkbox checked={allVisible} onChange={v => setMany(visible, v)} label={<span className="sr-only">{grouped ? 'Select all shown' : 'Select page'}</span>} /></th>
                <th className="px-2 py-2.5 w-12" title="Position in its pattern">#</th>
                <th className="px-2 py-2.5">Problem</th>
                {showPattern && <th className="px-2 py-2.5">Pattern</th>}
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
              {lines.map(l => {
                if (l.kind === 'group') return (
                  <tr key={`g-${l.patternId}`} className="border-b border-line bg-surface2/40">
                    <td colSpan={20} className="pl-3">{groupHeader(l)}</td>
                  </tr>
                );
                if (l.kind === 'sub') return (
                  <tr key={`s-${l.key}`} className="border-b border-line/60">
                    <td colSpan={20} className="pl-[4.25rem] pt-3 pb-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-muted">{l.label} <span className="font-semibold tabular-nums">· {l.count}</span></td>
                  </tr>
                );
                if (l.kind === 'more') return (
                  <tr key={`m-${l.patternId}`} className="border-b border-line/60"><td colSpan={20} className="py-1.5 pl-[4.25rem]">{moreButton(l)}</td></tr>
                );
                const p = l.p; const st = statusOf(p, s, t);
                return (
                  <tr key={p.id} className={cx('group border-b border-line/60 last:border-0 hover:bg-hover/60 cursor-pointer transition-colors', sel.has(p.id) && 'bg-accent/6')} onClick={() => openProblem(p.id)}>
                    <td className="px-3 py-2" onClick={e => e.stopPropagation()}><Checkbox checked={sel.has(p.id)} onChange={() => toggle(p.id)} label={<span className="sr-only">Select {p.name}</span>} /></td>
                    <td className="px-2 py-2 text-xs text-muted tabular-nums" title={posTitle(p)}>{pos.get(p.id)}</td>
                    <td className="px-2 py-2 max-w-[320px]">
                      <div className="flex items-center gap-1">
                        <span className="font-semibold text-fg truncate group-hover:text-accent-ink transition-colors" title={p.name}>{p.name}</span>
                        {p.url && <LinkButton url={p.url} size="icon" />}
                      </div>
                      {(p.weakness || (p.subPattern && !dividers)) && <div className="text-[11px] text-muted truncate" title={p.weakness}>{p.weakness ? `⚑ ${p.weakness}` : p.subPattern}</div>}
                    </td>
                    {showPattern && <td className="px-2 py-2"><Tag>{d.patterns[p.patternId]?.name ?? '—'}</Tag></td>}
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
          {lines.map(l => {
            if (l.kind === 'group') return <li key={`g-${l.patternId}`} className="bg-surface2/40">{groupHeader(l, true)}</li>;
            if (l.kind === 'sub') return <li key={`s-${l.key}`} className="px-3 pt-3 pb-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-muted">{l.label} · {l.count}</li>;
            if (l.kind === 'more') return <li key={`m-${l.patternId}`} className="px-3 py-1.5">{moreButton(l)}</li>;
            const p = l.p; const st = statusOf(p, s, t);
            return (
              <li key={p.id} className={cx('flex items-start gap-3 px-3 py-3', sel.has(p.id) && 'bg-accent/6')}>
                <div className="pt-0.5"><Checkbox checked={sel.has(p.id)} onChange={() => toggle(p.id)} label={<span className="sr-only">Select {p.name}</span>} /></div>
                <button className="min-w-0 flex-1 text-left" onClick={() => openProblem(p.id)}>
                  <div className="flex items-center gap-2"><span className="w-5 shrink-0 text-xs tabular-nums text-muted">{pos.get(p.id)}</span><RatingDot r={p.lastRating} /><span className="text-sm font-semibold text-fg truncate">{p.name}</span></div>
                  <div className="mt-1.5 ml-7 flex flex-wrap items-center gap-1.5">
                    {showPattern && <Tag>{d.patterns[p.patternId]?.name ?? '—'}</Tag>}<DiffPill d={p.difficulty} />
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
        {problems.length > 0 && (grouped ? (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-2.5 text-xs text-muted">
            <span className="tabular-nums">{problems.length} problem{problems.length === 1 ? '' : 's'} in {new Set(problems.map(p => p.patternId)).size} patterns</span>
            {!filtering && <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={() => { const all = new Set(problems.map(p => p.patternId)); writeOpen(all); setOpenGroups(all); }}>Expand all</Button>
              <Button size="sm" variant="ghost" onClick={() => { writeOpen(new Set()); setOpenGroups(new Set()); }}>Collapse all</Button>
            </div>}
          </div>
        ) : (
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
        ))}
      </Card>
      {bulk && <BulkDialog kind={bulk} ids={ids} onClose={() => setBulk(null)} onDone={() => { setBulk(null); setSel(new Set()); }} />}
    </div>
  );
}

function MenuItem({ icon, children, onClick, danger }: { icon: React.ReactNode; children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return <button onClick={onClick} className={cx('flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-sm hover:bg-hover', danger ? 'text-bad-ink' : 'text-fg')}>{icon}{children}</button>;
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

const VIEW_KEY = 'recodex-bank-view';

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
  const [layout, setLayoutState] = useState<'grouped' | 'flat'>(() => { try { return localStorage.getItem(VIEW_KEY) === 'flat' ? 'flat' : 'grouped'; } catch { return 'grouped'; } });
  const setLayout = (v: 'grouped' | 'flat') => { setLayoutState(v); try { localStorage.setItem(VIEW_KEY, v); } catch { /* per-device only */ } };
  useEffect(() => { if (initial) setF({ ...EMPTY_FILTERS, ...initial }); }, [JSON.stringify(initial)]);
  const t = today();
  // Deferred filters keep typing responsive with thousands of problems.
  const df = useDeferredValue(f);
  const statusMap = useMemo(() => new Map(Object.values(d.problems).map(p => [p.id, statusOf(p, s, t)])), [d.problems, d.meta]);
  const list = useMemo(() => applyFilters(Object.values(d.problems), df, p => statusMap.get(p.id)!, d.patterns), [d.problems, d.patterns, df, statusMap]);
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
              className={cx('shrink-0 rounded-2xl border px-3.5 py-2 text-left transition-colors', on ? 'border-interactive bg-accent/10' : 'border-line bg-surface hover:border-muted/50')}>
              <div className={cx('font-display text-lg font-semibold tabular-nums leading-none', n ? q.cls : 'text-muted')}>{n}</div>
              <div className="mt-1 text-[11px] font-semibold text-muted whitespace-nowrap">{q.label}</div>
            </button>
          );
        })}
      </div>
      <div className="mb-4 flex flex-col gap-2.5 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1"><FilterBar f={f} setF={setF} /></div>
        <Segmented ariaLabel="Layout" value={layout} onChange={setLayout} options={[{ value: 'grouped', label: 'By pattern' }, { value: 'flat', label: 'Flat list' }]} />
      </div>
      <ProblemTable problems={list} layout={layout} dividers={layout === 'grouped' && df.sort === 'pattern'} filtering={isFiltering(df)} />
      {csv && <CsvDialog mode={csv} onClose={() => setCsv(null)} />}
    </div>
  );
}
