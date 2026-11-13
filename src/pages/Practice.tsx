import React, { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Zap, Shuffle, AlertOctagon, Play, RefreshCw, X, History, SlidersHorizontal, Swords, Layers, Filter, Compass } from 'lucide-react';
import { useData, settingsOf, startSession } from '../lib/store';
import { PRESETS, baseConfig, candidatePool, generateSession } from '../lib/engine';
import type { SessionConfig, Phase, DiffChoice, Strategy } from '../types';
import { PHASES } from '../types';
import { fmtTimestamp } from '../lib/dates';
import { Button, Card, CardHeader, Checkbox, Field, Input, PageHeader, Segmented, Select, cx, DiffPill, RatingPill, Empty, GYRBar, Chip } from '../components/ui';
import { useApp, PatternTag } from '../components/shared';
import { MountainScene } from '../components/art/Mountains';
import { fmtDur } from './Session';

const ICONS: Record<keyof typeof PRESETS, React.ReactNode> = {
  daily: <CalendarClock size={18} />, weakness: <Zap size={18} />, overdue: <AlertOctagon size={18} />,
};
// Only the overdue preset carries a colour meaning (sunrise orange); the rest use the accent.
const TONE: Record<string, string> = { overdue: 'text-hot-ink bg-hot/15' };

function Group({ icon, title, children, className }: { icon: React.ReactNode; title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cx('rounded-2xl border border-line bg-surface2/40 p-4', className)}>
      <h3 className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-muted">{icon}{title}</h3>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

export default function Practice({ preset: initialPreset }: { preset?: string }) {
  const d = useData(); const s = settingsOf(d);
  const { go, openProblem } = useApp();
  const patterns = Object.values(d.patterns).sort((a, b) => a.order - b.order);
  const activePatterns = patterns.filter(p => Object.values(d.problems).some(x => x.patternId === p.id && x.track === 'active'));
  const [cfg, setCfg] = useState<SessionConfig>(() => baseConfig(s));
  const [customCount, setCustomCount] = useState('');
  const [customPatterns, setCustomPatterns] = useState('');
  const [editingCount, setEditingCount] = useState(false);
  const [editingPatterns, setEditingPatterns] = useState(false);
  const [preview, setPreview] = useState<string[] | null>(null);
  const [tab, setTab] = useState<'create' | 'recent'>('create');

  const pick = (key: keyof typeof PRESETS) => {
    const pr = PRESETS[key];
    setCfg({ ...baseConfig(s), ...pr.config, preset: key, count: pr.config.count ?? s.defaultSessionSize }); setPreview(null);
  };
  useEffect(() => { if (initialPreset && initialPreset in PRESETS) pick(initialPreset as keyof typeof PRESETS); }, [initialPreset]);
  const up = (patch: Partial<SessionConfig>) => { setCfg(c => ({ ...c, ...patch })); setPreview(null); };
  const finishCountEdit = () => {
    setEditingCount(false);
    if (!customCount.trim()) return;
    const n = Number(customCount);
    up({ count: Math.min(100, Math.max(1, Number.isFinite(n) ? Math.round(n) : 1)) });
  };
  const finishPatternEdit = () => {
    setEditingPatterns(false);
    if (!customPatterns.trim()) return;
    const n = Number(customPatterns);
    up({ patternCount: Math.min(30, Math.max(1, Number.isFinite(n) ? Math.round(n) : 1)) });
  };

  const problems = Object.values(d.problems);
  const pool = useMemo(() => candidatePool(problems, cfg), [d.problems, cfg]);
  const title = cfg.preset in PRESETS ? PRESETS[cfg.preset as keyof typeof PRESETS].title : 'Custom Mixed Practice';

  const generate = () => { const r = generateSession(problems, cfg); setPreview(r.ids); };
  const start = (ids: string[]) => {
    startSession({ kind: cfg.preset, title, config: cfg, problemIds: ids });
    go('session');
  };
  const togglePattern = (id: string) => up({ patternIds: cfg.patternIds.includes(id) ? cfg.patternIds.filter(x => x !== id) : [...cfg.patternIds, id] });
  const togglePhase = (ph: Phase) => up({ phases: cfg.phases.includes(ph) ? cfg.phases.filter(x => x !== ph) : [...cfg.phases, ph] });
  const sessions = Object.values(d.sessions).filter(x => x.kind !== 'today').sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
  const inProgress = Object.values(d.sessions).find(x => x.status === 'in_progress');
  const countOpts = [5, 10, 15, 20];
  const patOpts = [0, 2, 3, 5];
  const previewPatterns = preview ? preview.map(id => d.problems[id]?.patternId).filter(Boolean) as string[] : [];
  const patternIndex = new Map([...new Set(previewPatterns)].map((p, i) => [p, i]));

  return (
    <div>
      <PageHeader eyebrow={<span className="inline-flex items-center gap-1.5"><Swords size={13} />Arena</span>} title="Mixed Practice" sub="Problems from several patterns in one sitting, so you have to recognise the pattern yourself." />
      {inProgress && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-accent/40 bg-accent/8 px-4 py-3">
          <span className="text-sm text-fg"><b>{inProgress.title}</b> is in progress · {inProgress.results.length} of {inProgress.problemIds.length} done</span>
          <Button size="sm" variant="primary" onClick={() => go('session')}><Play size={14} />Resume</Button>
        </div>
      )}
      <div className="mb-4"><Segmented ariaLabel="Section" value={tab} onChange={setTab} options={[{ value: 'create', label: 'Create session' }, { value: 'recent', label: `Recent sessions (${sessions.length})` }]} /></div>

      {tab === 'recent' ? <RecentSessions /> : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 mb-5">
            {(Object.keys(PRESETS) as (keyof typeof PRESETS)[]).map(k => {
              const on = cfg.preset === k;
              return (
                <button key={k} onClick={() => pick(k)} aria-pressed={on}
                  className={cx('group relative flex items-start gap-3 overflow-hidden rounded-2xl border bg-surface px-4 py-4 text-left transition-[border-color,box-shadow] shadow-card',
                    on ? 'border-accent shadow-lift ring-2 ring-accent/25' : 'border-line hover:border-accent/40 hover:shadow-lift')}>
                  <div className={cx('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', TONE[k] ?? 'text-accent-ink bg-accent/12')}>{ICONS[k]}</div>
                  <div className="min-w-0">
                    <div className="font-display text-[17px] font-semibold text-fg">{PRESETS[k].title}</div>
                    <div className="text-xs text-muted mt-0.5 leading-relaxed">{PRESETS[k].blurb}</div>
                  </div>
                  {on && <span className="absolute top-3 right-3 h-2 w-2 rounded-full bg-accent" aria-hidden />}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
            <Card className="xl:col-span-3 min-w-0">
              <CardHeader icon={<SlidersHorizontal size={17} />} title="Session configuration" sub={cfg.preset === 'custom' ? 'Custom settings' : `Preset: ${PRESETS[cfg.preset as keyof typeof PRESETS]?.title} · adjust anything below`} />
              <div className="px-4 sm:px-5 pb-5 grid grid-cols-1 md:grid-cols-2 gap-3">
                <Group icon={<Layers size={13} />} title="Size and difficulty">
                  <Field label="Number of problems">
                    <div className="flex flex-wrap items-center gap-2">
                      <Segmented ariaLabel="Number of problems" value={countOpts.includes(cfg.count) ? cfg.count : -1} onChange={v => { if (v > 0) up({ count: v }); else document.getElementById('pm-custom-count')?.focus(); }} options={[...countOpts.map(n => ({ value: n, label: String(n) })), { value: -1, label: 'Custom' }]} />
                      <Input id="pm-custom-count" aria-label="Custom number of problems" type="number" min={1} max={100} className="!w-20" placeholder="#"
                        value={editingCount ? customCount : countOpts.includes(cfg.count) ? '' : String(cfg.count)}
                        onFocus={() => { setCustomCount(countOpts.includes(cfg.count) ? '' : String(cfg.count)); setEditingCount(true); }}
                        onChange={e => setCustomCount(e.target.value)} onBlur={finishCountEdit} />
                    </div>
                  </Field>
                  <Field label="Difficulty">
                    <Segmented ariaLabel="Difficulty" value={cfg.difficulty} onChange={(v: DiffChoice) => up({ difficulty: v })}
                      options={[{ value: 'all', label: 'Mixed' }, { value: 'Easy', label: 'Easy' }, { value: 'Medium', label: 'Medium' }, { value: 'Hard', label: 'Hard' }, { value: 'easy-medium', label: 'Easy+Med' }]} />
                  </Field>
                </Group>
                <Group icon={<Shuffle size={13} />} title="Pattern mixing">
                  <Field label="Number of patterns" hint="Patterns are chosen by the strategy, then problems alternate between them.">
                    <div className="flex flex-wrap items-center gap-2">
                      <Segmented ariaLabel="Number of patterns" value={patOpts.includes(cfg.patternCount) ? cfg.patternCount : -1} onChange={v => { if (v >= 0) up({ patternCount: v }); else document.getElementById('pm-custom-patterns')?.focus(); }} options={[{ value: 0, label: 'All' }, { value: 2, label: '2' }, { value: 3, label: '3' }, { value: 5, label: '5' }, { value: -1, label: 'Custom' }]} />
                      <Input id="pm-custom-patterns" aria-label="Custom number of patterns" type="number" min={1} max={30} className="!w-20" placeholder="#"
                        value={editingPatterns ? customPatterns : patOpts.includes(cfg.patternCount) ? '' : String(cfg.patternCount)}
                        onFocus={() => { setCustomPatterns(patOpts.includes(cfg.patternCount) ? '' : String(cfg.patternCount)); setEditingPatterns(true); }}
                        onChange={e => setCustomPatterns(e.target.value)} onBlur={finishPatternEdit} />
                    </div>
                  </Field>
                  <Field label="Selection strategy" htmlFor="pm-strategy">
                    <Select id="pm-strategy" className="!w-full" value={cfg.strategy} onChange={e => up({ strategy: e.target.value as Strategy })}>
                      <option value="balanced">Balanced (weakness + overdue + variety)</option>
                      <option value="weakest">Weakest first</option>
                      <option value="overdue">Overdue first</option>
                      <option value="random">Random</option>
                    </Select>
                  </Field>
                </Group>
                <Group icon={<Filter size={13} />} title="Include" className="md:col-span-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <Checkbox id="pm-solved" checked={cfg.includeSolved} onChange={v => up({ includeSolved: v })} label="Previously solved problems" />
                    <Checkbox id="pm-new" checked={cfg.includeNew} onChange={v => up({ includeNew: v })} label="Never-reviewed problems" />
                    <Checkbox id="pm-due" checked={cfg.onlyDue} onChange={v => up({ onlyDue: v, onlyOverdue: v ? false : cfg.onlyOverdue })} label="Only due or overdue" />
                    <Checkbox id="pm-od" checked={cfg.onlyOverdue} onChange={v => up({ onlyOverdue: v, onlyDue: v ? false : cfg.onlyDue })} label="Only overdue" />
                    <Checkbox id="pm-weak" checked={cfg.onlyWeak} onChange={v => up({ onlyWeak: v })} label="Only Red and Yellow" />
                    <div className="flex items-center gap-2">
                      <Checkbox id="pm-recent" checked={cfg.excludeRecentDays > 0} onChange={v => up({ excludeRecentDays: v ? s.recentDays : 0 })} label="Exclude revised in last" />
                      <Input aria-label="Days" type="number" min={1} className="!w-16 !h-8" value={cfg.excludeRecentDays || s.recentDays} onChange={e => up({ excludeRecentDays: Math.max(1, Number(e.target.value) || 1) })} />
                      <span className="text-sm text-muted">days</span>
                    </div>
                  </div>
                  <Field label={`Only these patterns ${cfg.patternIds.length ? `(${cfg.patternIds.length})` : '(any)'}`}>
                    <div className="flex flex-wrap gap-1.5">
                      {activePatterns.map(p => <Chip key={p.id} on={cfg.patternIds.includes(p.id)} onClick={() => togglePattern(p.id)}>{p.name}</Chip>)}
                    </div>
                  </Field>
                  <Field label={`Only these revision phases ${cfg.phases.length ? '' : '(any)'}`}>
                    <div className="flex flex-wrap gap-1.5">
                      {PHASES.map(ph => <Chip key={ph} on={cfg.phases.includes(ph)} onClick={() => togglePhase(ph)}>{ph}</Chip>)}
                    </div>
                  </Field>
                </Group>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 sm:px-5 py-3.5">
                <span className="text-sm text-muted"><b className="text-fg tabular-nums">{pool.length}</b> eligible problems in <b className="text-fg tabular-nums">{new Set(pool.map(p => p.patternId)).size}</b> patterns</span>
                <Button variant="primary" disabled={!pool.length} onClick={generate}><Compass size={15} />Generate session ({Math.min(cfg.count, pool.length)})</Button>
              </div>
            </Card>

            <Card className="xl:col-span-2 min-w-0 flex flex-col xl:sticky xl:top-6 self-start w-full">
              <CardHeader title="Session preview" sub={preview ? `${preview.length} problems from ${patternIndex.size} patterns` : 'Generate to see the problems before you start'}
                right={preview && <Button size="sm" variant="ghost" onClick={generate}><RefreshCw size={14} />Reroll</Button>} />
              {!preview ? (
                <Empty art={<MountainScene className="h-28 w-full" />} title={pool.length ? 'Ready when you are' : 'No eligible problems'} body={pool.length ? 'Pick a preset or adjust the settings, then press Generate.' : 'Loosen the filters: include never-reviewed problems, or turn off "Only due".'} />
              ) : preview.length === 0 ? <Empty title="Nothing matched" /> : (
                <>
                  <div className="px-4 sm:px-5 pb-3">
                    <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted mb-1.5">Pattern sequence</div>
                    <div className="flex flex-wrap gap-1" aria-label="Pattern of each problem in order">
                      {previewPatterns.map((pid, i) => (
                        <span key={i} title={d.patterns[pid]?.name} className="flex h-6 min-w-6 items-center justify-center rounded-md bg-surface2 px-1 text-[10px] font-bold text-fg/75">{String.fromCharCode(65 + (patternIndex.get(pid) ?? 0) % 26)}</span>
                      ))}
                    </div>
                  </div>
                  <ol className="divide-y divide-line/70 border-t border-line/70">
                    {preview.map((id, i) => {
                      const p = d.problems[id]; if (!p) return null;
                      return (
                        <li key={id} className="flex items-center gap-3 px-4 sm:px-5 py-2">
                          <span className="w-5 text-xs font-mono text-muted tabular-nums">{i + 1}</span>
                          <button className="min-w-0 flex-1 text-left" onClick={() => openProblem(id)}>
                            <div className="text-sm font-semibold text-fg truncate">{p.name}</div>
                            <div className="flex flex-wrap gap-1.5 mt-1"><PatternTag id={p.patternId} /><DiffPill d={p.difficulty} /><RatingPill r={p.lastRating} /></div>
                          </button>
                          <Button size="icon" variant="ghost" aria-label="Remove from session" onClick={() => setPreview(preview.filter(x => x !== id))}><X size={14} /></Button>
                        </li>
                      );
                    })}
                  </ol>
                  <div className="mt-auto px-4 sm:px-5 py-4"><Button variant="primary" size="lg" className="w-full" onClick={() => start(preview)}><Play size={16} />Enter the arena · {preview.length}</Button></div>
                </>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

export function RecentSessions({ limit }: { limit?: number }) {
  const d = useData(); const { go } = useApp();
  const list = Object.values(d.sessions).sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1)).slice(0, limit ?? 100);
  if (!list.length) return <Card><Empty icon={<History size={26} />} title="No sessions yet" body="Completed and unfinished sessions appear here with their results." /></Card>;
  return (
    <Card className="overflow-hidden">
      <div className="relative overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead><tr className="border-b border-line bg-surface2/50 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-muted">
            <th className="px-4 py-2.5">Session</th><th className="px-2 py-2.5">Date</th><th className="px-2 py-2.5">Status</th><th className="px-2 py-2.5">Attempted</th><th className="px-2 py-2.5 w-40">Ratings</th><th className="px-2 py-2.5">Accuracy</th><th className="px-2 py-2.5 pr-4">Time</th>
          </tr></thead>
          <tbody>
            {list.map(s => {
              const rated = s.results.filter(r => r.rating);
              const g = rated.filter(r => r.rating === 'green').length, y = rated.filter(r => r.rating === 'yellow').length, r = rated.filter(r => r.rating === 'red').length;
              return (
                <tr key={s.id} className="border-b border-line/60 last:border-0 hover:bg-surface2/60 cursor-pointer" onClick={() => go(s.status === 'in_progress' ? 'session' : `summary-${s.id}`)}>
                  <td className="px-4 py-2.5 font-semibold text-fg">{s.title}</td>
                  <td className="px-2 py-2.5 text-muted whitespace-nowrap">{fmtTimestamp(s.startedAt, 'd MMM yyyy')}</td>
                  <td className="px-2 py-2.5"><span className={cx('rounded-lg px-1.5 py-0.5 text-[11px] font-semibold', s.status === 'completed' ? 'bg-ok/15 text-ok-ink' : s.status === 'in_progress' ? 'bg-accent/12 text-accent-ink' : 'bg-surface2 text-muted')}>{s.status === 'completed' ? 'Completed' : s.status === 'in_progress' ? 'In progress' : 'Not finished'}</span></td>
                  <td className="px-2 py-2.5 tabular-nums text-muted">{rated.length} / {s.problemIds.length}</td>
                  <td className="px-2 py-2.5"><GYRBar g={g} y={y} r={r} /></td>
                  <td className="px-2 py-2.5 tabular-nums text-fg">{rated.length ? `${Math.round((g / rated.length) * 100)}%` : '—'}</td>
                  <td className="px-2 py-2.5 pr-4 tabular-nums text-muted">{fmtDur(s.elapsedSec)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
