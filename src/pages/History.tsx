import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, X, History as HistoryIcon } from 'lucide-react';
import { useData } from '../lib/store';
import { fmt, today, addDays } from '../lib/dates';
import { Button, Card, PageHeader, Select, Input, Segmented, RatingPill, PhasePill, Tag, Empty, GYRBar, SearchInput } from '../components/ui';
import { useApp } from '../components/shared';
import { RecentSessions } from './Practice';
import { countRatings } from '../lib/stats';

const PAGE = 50;
const SOURCE_LABEL = { quick: 'Quick rating', today: "Today's revision", session: 'Mixed practice', import: 'Imported' } as const;

export default function History({ initialTab }: { initialTab?: 'revisions' | 'sessions' }) {
  const d = useData(); const { openProblem } = useApp();
  const [tab, setTab] = useState<'revisions' | 'sessions'>(initialTab ?? 'revisions');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [pattern, setPattern] = useState('');
  const [rating, setRating] = useState('');
  const [source, setSource] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  const patterns = Object.values(d.patterns).sort((a, b) => a.order - b.order);
  const list = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return Object.values(d.revisions).filter(r => {
      const p = d.problems[r.problemId]; if (!p) return false;
      return (!from || r.date >= from) && (!to || r.date <= to) && (!pattern || p.patternId === pattern) && (!rating || r.rating === rating) && (!source || r.source === source) && (!qq || p.name.toLowerCase().includes(qq) || r.mistake.toLowerCase().includes(qq));
    }).sort((a, b) => (a.at < b.at ? 1 : -1));
  }, [d.revisions, d.problems, from, to, pattern, rating, source, q]);
  const c = countRatings(list);
  const pages = Math.max(1, Math.ceil(list.length / PAGE));
  const rows = list.slice(page * PAGE, page * PAGE + PAGE);
  const anyFilter = from || to || pattern || rating || source || q;
  const preset = (days: number) => { setFrom(addDays(today(), -days + 1)); setTo(today()); setPage(0); };

  return (
    <div>
      <PageHeader title="Revision History" sub="Every revision is its own record. Nothing is overwritten." />
      <div className="mb-4"><Segmented ariaLabel="Section" value={tab} onChange={setTab} options={[{ value: 'revisions', label: `Revisions (${Object.keys(d.revisions).length})` }, { value: 'sessions', label: `Sessions (${Object.keys(d.sessions).length})` }]} /></div>
      {tab === 'sessions' ? <RecentSessions /> : (
        <>
          <div className="flex flex-col gap-2.5 mb-4">
            <div className="flex flex-wrap gap-2">
              <SearchInput id="hist-q" value={q} onChange={v => { setQ(v); setPage(0); }} placeholder="Search problem or mistake text" />
              <div className="flex items-center gap-1.5"><Input aria-label="From date" type="date" className="!w-auto" value={from} onChange={e => { setFrom(e.target.value); setPage(0); }} /><span className="text-muted text-sm">to</span><Input aria-label="To date" type="date" className="!w-auto" value={to} onChange={e => { setTo(e.target.value); setPage(0); }} /></div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="md" variant="outline" onClick={() => preset(7)}>Last 7 days</Button>
              <Button size="md" variant="outline" onClick={() => preset(30)}>Last 30 days</Button>
              <Select aria-label="Pattern" value={pattern} onChange={e => { setPattern(e.target.value); setPage(0); }}><option value="">Pattern: All</option>{patterns.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
              <Select aria-label="Rating" value={rating} onChange={e => { setRating(e.target.value); setPage(0); }}><option value="">Rating: All</option><option value="green">Green</option><option value="yellow">Yellow</option><option value="red">Red</option></Select>
              <Select aria-label="Source" value={source} onChange={e => { setSource(e.target.value); setPage(0); }}><option value="">Source: All</option>{Object.entries(SOURCE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
              {anyFilter && <Button variant="ghost" onClick={() => { setFrom(''); setTo(''); setPattern(''); setRating(''); setSource(''); setQ(''); setPage(0); }}><X size={14} />Clear</Button>}
            </div>
          </div>
          <Card className="mb-3 flex flex-wrap items-center gap-4 px-4 py-3">
            <span className="text-sm text-muted"><b className="text-fg tabular-nums">{list.length}</b> revisions on <b className="text-fg tabular-nums">{new Set(list.map(r => r.problemId)).size}</b> problems</span>
            <div className="flex-1 min-w-[140px] max-w-xs"><GYRBar g={c.green} y={c.yellow} r={c.red} /></div>
            <span className="text-xs text-muted tabular-nums"><span className="text-ok-ink">{c.green}</span> / <span className="text-warn-ink">{c.yellow}</span> / <span className="text-bad-ink">{c.red}</span></span>
          </Card>
          <Card className="overflow-hidden">
            {list.length === 0 ? <Empty icon={<HistoryIcon size={26} />} title={anyFilter ? 'No revisions match these filters' : 'No revisions yet'} body="Rate a problem from the dashboard to create the first record." /> : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[900px]">
                    <thead><tr className="border-b border-line text-left text-[11px] font-semibold uppercase tracking-wider text-muted">
                      <th className="px-4 py-2.5">Date</th><th className="px-2 py-2.5">Problem</th><th className="px-2 py-2.5">Pattern</th><th className="px-2 py-2.5">Rating</th><th className="px-2 py-2.5">Phase</th><th className="px-2 py-2.5 text-right">Time</th><th className="px-2 py-2.5">Mistake</th><th className="px-2 py-2.5 pr-4">Notes</th>
                    </tr></thead>
                    <tbody>
                      {rows.map(r => {
                        const p = d.problems[r.problemId]!;
                        return (
                          <tr key={r.id} className="border-b border-line/60 last:border-0 hover:bg-surface2/60 cursor-pointer align-top" onClick={() => openProblem(p.id)}>
                            <td className="px-4 py-2.5 whitespace-nowrap"><div className="text-fg tabular-nums">{fmt(r.date, 'd MMM yyyy')}</div><div className="text-[11px] text-muted">{SOURCE_LABEL[r.source]}</div></td>
                            <td className="px-2 py-2.5 max-w-[240px]"><div className="font-semibold text-fg truncate">{p.name}</div><div className="text-[11px] text-muted font-mono">#{p.num}</div></td>
                            <td className="px-2 py-2.5"><Tag>{d.patterns[p.patternId]?.name}</Tag></td>
                            <td className="px-2 py-2.5"><RatingPill r={r.rating} /></td>
                            <td className="px-2 py-2.5"><PhasePill p={r.phase} /></td>
                            <td className="px-2 py-2.5 text-right tabular-nums text-muted">{r.timeMin !== null ? `${r.timeMin}m` : '—'}</td>
                            <td className="px-2 py-2.5 max-w-[260px] text-fg"><span className="line-clamp-2">{r.mistake || <span className="text-muted">—</span>}</span></td>
                            <td className="px-2 py-2.5 pr-4 max-w-[220px] text-muted"><span className="line-clamp-2">{r.notes || '—'}</span></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-between border-t border-line px-4 py-2.5 text-xs text-muted">
                  <span className="tabular-nums">{page * PAGE + 1}–{Math.min(list.length, page * PAGE + PAGE)} of {list.length}</span>
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost" disabled={page === 0} onClick={() => setPage(page - 1)} aria-label="Previous page"><ChevronLeft size={16} /></Button>
                    <span className="tabular-nums">{page + 1} / {pages}</span>
                    <Button size="icon" variant="ghost" disabled={page >= pages - 1} onClick={() => setPage(page + 1)} aria-label="Next page"><ChevronRight size={16} /></Button>
                  </div>
                </div>
              </>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
