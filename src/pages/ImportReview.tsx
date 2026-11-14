import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, FileSpreadsheet, Info, Sparkles } from 'lucide-react';
import { SEED, SEED_NOTES, linkToUrl } from '../seed';
import { importSeed, seedKey, startEmpty, useData, getState } from '../lib/store';
import { diffDays, fmt, today } from '../lib/dates';
import { Button, Card, Checkbox, DiffPill, RatingPill, cx, LinkButton } from '../components/ui';
import { CsvDialog } from './CsvDialog';

export default function ImportReview() {
  const d = useData();
  const t = today();
  const [include, setInclude] = useState<Set<string>>(() => new Set(SEED.flatMap(sp => sp.rows.map((_, i) => seedKey(sp.name, i)))));
  const [backlog, setBacklog] = useState<Set<string>>(() => new Set(SEED.filter(sp => sp.learning === 'yet_to_learn').map(sp => sp.name)));
  const [open, setOpen] = useState<Set<string>>(new Set(['Two Pointers']));
  const [csv, setCsv] = useState(false);
  const all = SEED.flatMap(sp => sp.rows.map((r, i) => ({ sp, r, key: seedKey(sp.name, i) })));
  const chosen = all.filter(x => include.has(x.key));
  const reviewed = chosen.filter(x => x.r.rating);
  const overdue = reviewed.filter(x => x.r.nextReview && diffDays(x.r.nextReview, t) < 0);
  const backlogCount = chosen.filter(x => backlog.has(x.sp.name) && !x.r.rating).length;
  const toggle = (k: string) => setInclude(s => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const togglePattern = (name: string, v: boolean) => setInclude(s => { const n = new Set(s); SEED.find(x => x.name === name)!.rows.forEach((_, i) => v ? n.add(seedKey(name, i)) : n.delete(seedKey(name, i))); return n; });

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <div className="inline-flex items-center gap-1.5 rounded-md bg-accent/12 px-2 py-1 text-xs font-semibold text-selected"><Sparkles size={13} />First run</div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-fg mt-3 text-balance">Review your imported problem bank</h1>
        <p className="text-sm text-muted mt-2 max-w-2xl">Extracted from your "DSA patterns Cheat Sheet – Revision Master" PDF and the Today's Focus sheet. Ratings and dates come only from the rows that had them. Untick anything you do not want, then finalize.</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        {[['Patterns', new Set(chosen.map(x => x.sp.name)).size], ['Problems', chosen.length], ['With ratings', reviewed.length], ['Overdue today', overdue.length], ['Yet to Learn', backlogCount]].map(([k, v]) => (
          <Card key={k as string} className="px-4 py-3"><div className="text-xs text-muted">{k}</div><div className={cx('font-display text-2xl font-extrabold tabular-nums', k === 'Overdue today' ? 'text-bad-ink' : 'text-fg')}>{v}</div></Card>
        ))}
      </div>
      <Card className="mb-4 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-fg mb-1.5"><Info size={15} className="text-accent-ink" />How the import was cleaned</div>
        <ul className="list-disc pl-5 text-sm text-muted space-y-1">{SEED_NOTES.map(n => <li key={n}>{n}</li>)}
          <li>Priority follows your sheet: Red → High, Yellow → Medium, Green → Low. Unreviewed problems start at Medium.</li>
          <li>Each reviewed problem gets one history record dated on its last revision, so streaks and analytics start from real data.</li>
        </ul>
      </Card>
      <div className="flex flex-col gap-2 mb-28">
        {SEED.map(sp => {
          const keys = sp.rows.map((_, i) => seedKey(sp.name, i));
          const n = keys.filter(k => include.has(k)).length;
          const isOpen = open.has(sp.name);
          const rated = sp.rows.filter(r => r.rating).length;
          return (
            <Card key={sp.name} className="overflow-hidden">
              <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                <Checkbox checked={n === keys.length} onChange={v => togglePattern(sp.name, v)} label={<span className="sr-only">Include {sp.name}</span>} />
                <button className="flex flex-1 items-center gap-2 text-left min-w-0" onClick={() => setOpen(s => { const x = new Set(s); x.has(sp.name) ? x.delete(sp.name) : x.add(sp.name); return x; })} aria-expanded={isOpen}>
                  {isOpen ? <ChevronDown size={16} className="text-muted shrink-0" /> : <ChevronRight size={16} className="text-muted shrink-0" />}
                  <span className="font-semibold text-fg truncate">{sp.name}</span>
                  <span className="text-xs text-muted tabular-nums shrink-0">{n}/{keys.length}{rated ? ` · ${rated} rated` : ''}</span>
                </button>
                <Checkbox checked={backlog.has(sp.name)} onChange={v => setBacklog(s => { const x = new Set(s); v ? x.add(sp.name) : x.delete(sp.name); return x; })} label={<span className="text-xs text-muted">Yet to Learn</span>} />
              </div>
              {isOpen && (
                <ul className="border-t border-line/70 divide-y divide-line/60">
                  {sp.rows.map((r, i) => {
                    const k = seedKey(sp.name, i);
                    return (
                      <li key={k} className={cx('flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2', !include.has(k) && 'opacity-45')}>
                        <Checkbox checked={include.has(k)} onChange={() => toggle(k)} label={<span className="sr-only">Include {r.name}</span>} />
                        <div className="min-w-0 flex-1 basis-56">
                          <div className="text-sm font-medium text-fg truncate">{r.name}</div>
                          <div className="text-[11px] text-muted truncate">{r.sub}{r.original !== r.name ? ` · source: "${r.original}"` : ''}</div>
                        </div>
                        <DiffPill d={r.difficulty} />
                        <RatingPill r={r.rating ?? null} />
                        <span className="text-[11px] text-muted tabular-nums w-36">{r.lastRevised ? `${fmt(r.lastRevised, 'd MMM')} → ${fmt(r.nextReview, 'd MMM')}` : ''}</span>
                        <LinkButton url={linkToUrl(r.link)} />
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          );
        })}
      </div>
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-line bg-surface/95 backdrop-blur import-bar">
        <div className="mx-auto max-w-5xl flex flex-wrap items-center justify-between gap-3 py-3">
          <span className="text-sm text-muted">{chosen.length} problems · {reviewed.length} with revision history · {backlogCount} held in Yet to Learn</span>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => setCsv(true)}><FileSpreadsheet size={15} />Import a CSV instead</Button>
            <Button variant="outline" onClick={startEmpty}>Start empty</Button>
            <Button variant="primary" size="lg" disabled={!chosen.length} onClick={() => importSeed({ include, backlogNames: backlog })}>Finalize import</Button>
          </div>
        </div>
      </div>
      {csv && <CsvDialog mode="import" onClose={() => { setCsv(false); if (Object.keys(getState().problems).length) startEmpty(); }} />}
    </div>
  );
}
