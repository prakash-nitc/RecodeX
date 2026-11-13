import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, ExternalLink, Pause, Play, SkipForward, Eye, RotateCcw, CheckCircle2, X, Keyboard, Trophy, Clock, Shapes, Target, Pencil } from 'lucide-react';
import { useData, addSessionResult, finishSession, startSession, updateProblem } from '../lib/store';
import { PHASE_HINT } from '../lib/engine';
import { fmt, fmtTimestamp } from '../lib/dates';
import { Button, Card, Dialog, DiffPill, PhasePill, RatingPill, cx, Empty, GYRBar, PageHeader, RatingDot, Textarea } from '../components/ui';
import { useApp, RatingForm, initialRatingValue, submitRating, PatternTag, useTicker, RatingFormValue } from '../components/shared';
import { MountainScene } from '../components/art/Mountains';
import type { Rating, Session } from '../types';

export const fmtDur = (sec: number) => {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.floor(sec % 60);
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
};

export default function SessionPage({ summaryId }: { summaryId?: string }) {
  const d = useData();
  const { go } = useApp();
  const active = useMemo(() => Object.values(d.sessions).filter(s => s.status === 'in_progress').sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))[0], [d.sessions]);
  if (summaryId) {
    const s = d.sessions[summaryId];
    return s ? <Summary session={s} /> : <Card><Empty title="Session not found" action={<Button onClick={() => go('history-sessions')}>All sessions</Button>} /></Card>;
  }
  if (!active) return (
    <div>
      <PageHeader title="Focus session" />
      <Card><Empty art={<MountainScene className="h-32 w-full" />} title="No session in progress" body="Start one from Today's Revision or Mixed Practice."
        action={<div className="flex gap-2"><Button variant="primary" onClick={() => go('today')}>Today's revision</Button><Button onClick={() => go('practice')}>Mixed practice</Button></div>} /></Card>
    </div>
  );
  return <Runner key={active.id} session={active} />;
}

/** Focus mode: one problem at a time, a large timer, rating controls and a clear progress bar. */
function Runner({ session }: { session: Session }) {
  const d = useData();
  const { go } = useApp();
  const ids = session.problemIds.filter(id => d.problems[id]);
  const index = Math.min(session.index, ids.length);
  const pid = ids[index];
  const p = pid ? d.problems[pid] : null;
  const [clock, setClock] = useState<{ base: number; since: number | null }>({ base: 0, since: Date.now() });
  const [formState, setFormState] = useState<{ pid: string; v: RatingFormValue } | null>(null);
  const form = p ? (formState && formState.pid === p.id ? formState.v : initialRatingValue(p)) : null;
  const setForm = (v: RatingFormValue) => { if (p) setFormState({ pid: p.id, v }); };
  const [timeTouched, setTimeTouched] = useState(false);
  const [peek, setPeek] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const [flash, setFlash] = useState<Rating | null>(null);
  const [notesDraft, setNotesDraft] = useState<string | null>(null); // non-null while editing the problem's notes
  useTicker(clock.since !== null);

  useEffect(() => {
    if (p) { setClock({ base: 0, since: Date.now() }); setTimeTouched(false); setPeek(false); setNotesDraft(null); }
  }, [pid]);

  useEffect(() => {
    if (index >= ids.length && session.status === 'in_progress') {
      finishSession(session.id, 'completed', session.elapsedSec);
      go(`summary-${session.id}`);
    }
  }, [index, ids.length]);

  const ms = clock.base + (clock.since !== null ? Date.now() - clock.since : 0);
  const sec = Math.floor(ms / 1000);
  const running = clock.since !== null;
  const totalSec = session.elapsedSec + sec;
  const formWithTime = form ? (timeTouched ? form : { ...form, timeMin: sec >= 30 ? String(Math.max(1, Math.round(sec / 60))) : form.timeMin }) : null;
  const toggle = () => setClock(c => c.since !== null ? { base: c.base + Date.now() - c.since, since: null } : { ...c, since: Date.now() });

  const saveNext = () => {
    if (!p || !formWithTime) return;
    const r = submitRating(p.id, formWithTime, session.kind === 'today' ? 'today' : 'session', session.id);
    if (!r) return;
    setFlash(r.rating); setTimeout(() => setFlash(null), 650);
    addSessionResult(session.id, { problemId: p.id, outcome: 'rated', rating: r.rating, timeSec: sec, revisionId: r.id }, session.elapsedSec + sec);
  };
  const skip = () => { if (p) addSessionResult(session.id, { problemId: p.id, outcome: 'skipped', rating: null, timeSec: sec, revisionId: null }, session.elapsedSec + sec); };
  const exit = (finish: boolean) => {
    setExitOpen(false);
    finishSession(session.id, 'abandoned', totalSec);
    go(finish ? `summary-${session.id}` : 'dashboard');
  };

  // Keyboard: 1/2/3 rate, Enter saves, S skips, P pauses. Ignored while typing or when a dialog is open.
  const latest = useRef({ form: formWithTime, saveNext, skip, toggle, exitOpen, setForm });
  latest.current = { form: formWithTime, saveNext, skip, toggle, exitOpen, setForm };
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      const L = latest.current;
      if (!L.form || L.exitOpen || e.metaKey || e.ctrlKey || e.altKey) return;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el?.isContentEditable) return;
      const pick = (r: Rating) => L.setForm({ ...L.form!, rating: r, independent: L.form!.independent ?? (r === 'green') });
      if (e.key === '1') pick('green');
      else if (e.key === '2') pick('yellow');
      else if (e.key === '3') pick('red');
      else if (e.key === 'Enter' && tag !== 'BUTTON' && tag !== 'A' && L.form.rating) { e.preventDefault(); L.saveNext(); }
      else if (e.key.toLowerCase() === 's') L.skip();
      else if (e.key.toLowerCase() === 'p') L.toggle();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  if (!p || !form || !formWithTime) return null;
  const resultOf = (id: string) => session.results.find(r => r.problemId === id);
  const pct = ids.length ? index / ids.length : 0;
  const site = p.url ? (/leetcode/.test(p.url) ? 'LeetCode' : /geeksforgeeks/.test(p.url) ? 'GeeksforGeeks' : 'site') : null;

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      <header className="sticky top-0 z-20 border-b border-line bg-surface/85 backdrop-blur-md mobile-bar">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-2 sm:px-4">
          <Button variant="ghost" size="sm" onClick={() => setExitOpen(true)} aria-label="Exit focus mode"><X size={16} /><span className="hidden sm:inline">Exit</span></Button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-fg">{session.title}</div>
            <div className="text-[11px] text-muted tabular-nums">Problem {index + 1} of {ids.length} · {fmtDur(totalSec)} total</div>
          </div>
          <span className="hidden sm:inline text-xs font-semibold text-muted tabular-nums">{Math.round(pct * 100)}%</span>
        </div>
        <div className="h-1 w-full bg-surface2" role="progressbar" aria-label="Session progress" aria-valuenow={Math.round(pct * 100)} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full bg-accent transition-[width] duration-500 ease-out" style={{ width: `${pct * 100}%` }} />
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 gap-5 px-4 py-6 lg:grid-cols-[1.2fr_1fr] lg:py-10">
        <section key={p.id} className="flex flex-col animate-rise">
          {p.subPattern && <div className="text-xs text-muted">{p.subPattern}</div>}
          <h1 className="mt-2 font-display text-[28px] sm:text-4xl font-semibold leading-tight tracking-tight text-fg text-balance">{p.name}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-1.5"><PatternTag id={p.patternId} /><DiffPill d={p.difficulty} /><RatingPill r={p.lastRating} /><PhasePill p={form.phaseUsed} /></div>

          <div className="mt-6 rounded-2xl border border-line bg-surface px-4 py-3">
            <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">{form.phaseUsed}</div>
            <p className="mt-1 text-sm text-fg leading-relaxed">{PHASE_HINT[form.phaseUsed]}</p>
          </div>

          <div className="mt-6 flex flex-col items-center gap-3 rounded-3xl border border-line bg-surface px-4 py-6 shadow-card">
            <div className={cx('font-mono text-6xl sm:text-7xl font-semibold tabular-nums tracking-tight transition-colors', running ? 'text-fg' : 'text-muted')} aria-live="off" aria-label={`Timer ${fmtDur(sec)}`}>{fmtDur(sec)}</div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button variant="outline" onClick={toggle} aria-label={running ? 'Pause timer' : 'Resume timer'}>{running ? <><Pause size={15} />Pause</> : <><Play size={15} />Resume</>}</Button>
              {p.url && (
                <a href={p.url} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-accentfg shadow-[0_6px_16px_-6px_rgb(var(--accent)/0.55)] hover:bg-accent/90">
                  <ExternalLink size={15} />Open on {site}
                </a>
              )}
            </div>
            {!p.url && <span className="text-xs text-muted">No link saved for this problem.</span>}
          </div>

          {notesDraft !== null ? (
            <div className="mt-4 rounded-2xl border border-line bg-surface px-4 py-3 animate-page-in">
              <label htmlFor="run-pnotes" className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">Problem notes</label>
              <Textarea id="run-pnotes" rows={4} className="mt-1.5" autoFocus value={notesDraft} onChange={e => setNotesDraft(e.target.value)}
                placeholder="Approach, key insight, edge cases. Shown with this problem from now on." />
              <div className="mt-2 flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setNotesDraft(null)}>Cancel</Button>
                <Button size="sm" variant="primary" onClick={() => { updateProblem(p.id, { notes: notesDraft.trim() }); setNotesDraft(null); setPeek(true); }}>Save notes</Button>
              </div>
            </div>
          ) : (p.weakness || p.notes) ? (
            <div className="mt-4">
              {!peek ? (
                <Button variant="ghost" size="sm" onClick={() => setPeek(true)}><Eye size={14} />Show last weakness and notes</Button>
              ) : (
                <div className="rounded-2xl border border-hot/35 bg-hot/8 px-4 py-3 text-sm animate-page-in">
                  {p.weakness && <p className="text-fg"><span className="font-semibold text-hot-ink">Last weakness: </span>{p.weakness}</p>}
                  {p.notes && <p className="text-muted mt-1.5 whitespace-pre-wrap">{p.notes}</p>}
                  <button className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-accent-ink hover:underline" onClick={() => setNotesDraft(p.notes)}><Pencil size={12} />{p.notes ? 'Edit notes' : 'Add notes'}</button>
                </div>
              )}
              {!peek && form.phaseUsed === 'Reconstruction' && <p className="text-xs text-muted mt-1 ml-1">Reconstruction works best without peeking.</p>}
            </div>
          ) : (
            <div className="mt-4"><Button variant="ghost" size="sm" onClick={() => setNotesDraft('')}><Pencil size={14} />Add notes for this problem</Button></div>
          )}
        </section>

        <section className={cx('relative rounded-3xl border border-line bg-surface p-5 sm:p-6 shadow-card self-start transition-shadow', flash && 'animate-pop-in')}>
          <h2 className="font-display text-xl font-semibold text-fg mb-4">How did it go?</h2>
          <RatingForm problem={p} value={formWithTime} idPrefix="run" collapsible keys
            onChange={v => { if (v.timeMin !== formWithTime.timeMin) setTimeTouched(true); setForm(v); }} />
          <div className="flex items-center justify-between gap-2 mt-5">
            <Button variant="ghost" onClick={skip}><SkipForward size={15} />Skip</Button>
            <Button variant="primary" size="lg" disabled={!form.rating} onClick={saveNext}>{index + 1 === ids.length ? 'Save & finish' : 'Save & next'}<ArrowRight size={16} /></Button>
          </div>
          <p className="mt-4 flex items-start gap-1.5 text-[11px] text-muted"><Keyboard size={13} className="shrink-0 mt-px" /><span><kbd className="font-mono">1</kbd>/<kbd className="font-mono">2</kbd>/<kbd className="font-mono">3</kbd> rate · <kbd className="font-mono">Enter</kbd> save · <kbd className="font-mono">S</kbd> skip · <kbd className="font-mono">P</kbd> pause. Opening or skipping never rates a problem.</span></p>
          {flash && <div className={cx('pointer-events-none absolute inset-0 rounded-3xl ring-4 animate-pop-in', flash === 'green' ? 'ring-ok/40' : flash === 'yellow' ? 'ring-warn/50' : 'ring-bad/40')} aria-hidden />}
        </section>
      </main>

      <footer className="border-t border-line bg-surface/60 px-4 py-3">
        <div className="mx-auto flex max-w-6xl flex-wrap gap-1.5" aria-label="Queue">
          {ids.map((id, i) => {
            const r = resultOf(id); const q = d.problems[id];
            return (
              <span key={id} title={q?.name} className={cx('inline-flex h-7 min-w-7 items-center justify-center gap-1 rounded-lg border px-1.5 text-xs font-semibold tabular-nums',
                i === index ? 'border-accent bg-accent/12 text-accent-ink' : r ? 'border-line bg-surface2 text-muted' : 'border-line text-muted')}>
                {r?.rating ? <RatingDot r={r.rating} size={7} /> : r ? '–' : null}{i + 1}
              </span>
            );
          })}
        </div>
      </footer>

      <Dialog open={exitOpen} onClose={() => setExitOpen(false)} title="Leave this session?" width="max-w-md"
        footer={<>
          <Button variant="ghost" onClick={() => setExitOpen(false)}>Keep going</Button>
          <Button variant="outline" onClick={() => exit(false)}>Leave</Button>
          <Button variant="primary" onClick={() => exit(true)}>End and see summary</Button>
        </>}>
        <p className="text-sm text-muted leading-relaxed">
          You have done {session.results.length} of {ids.length}. Ratings you already saved stay in your history, but the session is recorded as
          <b className="text-fg"> not completed</b> and does not count toward completed sessions.
        </p>
      </Dialog>
    </div>
  );
}

function Summary({ session }: { session: Session }) {
  const d = useData();
  const { go, openProblem } = useApp();
  const rated = session.results.filter(r => r.outcome === 'rated' && r.rating);
  const c = { green: 0, yellow: 0, red: 0 } as Record<Rating, number>;
  rated.forEach(r => c[r.rating!]++);
  const acc = rated.length ? Math.round((c.green / rated.length) * 100) : 0;
  const patternsUsed = [...new Set(session.results.map(r => d.problems[r.problemId]?.patternId).filter(Boolean))] as string[];
  const again = rated.filter(r => r.rating !== 'green');
  const done = session.status === 'completed';
  const retry = () => {
    startSession({ kind: 'weakness', title: 'Retry: problems needing another revision', config: null, problemIds: again.map(r => r.problemId) });
    go('session');
  };
  return (
    <div className="flex flex-col gap-4">
      <section className="relative overflow-hidden rounded-3xl h-[220px] sm:h-[260px] shadow-lift animate-rise">
        <MountainScene className="absolute inset-0 h-full w-full" />
        <div className="absolute inset-0 bg-gradient-to-t from-[rgb(8_10_28/0.75)] via-[rgb(8_10_28/0.3)] to-transparent" />
        <div className="relative flex h-full flex-col justify-end p-6 sm:p-8 text-white [text-shadow:0_1px_14px_rgb(0_0_0/0.4)]">
          <div className="flex items-center gap-2 text-sm font-semibold text-white/85">{done ? <><Trophy size={16} />Session complete</> : 'Session ended early'}</div>
          <h1 className="mt-1 font-display text-3xl sm:text-4xl font-semibold tracking-tight text-balance">{done ? (acc >= 80 ? 'A clear view from up here.' : 'Another stretch of the trail behind you.') : 'Every step still counts.'}</h1>
          <p className="mt-1 text-sm text-white/80">{session.title} · {fmtTimestamp(session.startedAt)}</p>
        </div>
      </section>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {!done ? <p className="text-sm text-hot-ink">This session was not finished, so it is not counted as a completed session. The ratings you saved are kept.</p> : <span />}
        <div className="flex gap-2"><Button onClick={() => go('practice')}>New session</Button><Button variant="primary" onClick={() => go('dashboard')}>Back to dashboard</Button></div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: <Target size={16} />, label: 'Attempted', value: <>{rated.length}<span className="text-base text-muted"> / {session.problemIds.length}</span></>, cls: 'text-fg' },
          { icon: <CheckCircle2 size={16} />, label: 'Accuracy (green)', value: `${acc}%`, cls: 'text-ok-ink' },
          { icon: <Clock size={16} />, label: 'Completion time', value: fmtDur(session.elapsedSec), cls: 'text-fg' },
          { icon: <Shapes size={16} />, label: 'Patterns practiced', value: patternsUsed.length, cls: 'text-fg' },
        ].map((x, i) => (
          <Card key={x.label} className="px-4 py-3.5 animate-rise" style={{ animationDelay: `${60 * i}ms` }}>
            <div className="flex items-center gap-1.5 text-xs text-muted">{x.icon}{x.label}</div>
            <div className={cx('mt-1 font-display text-[28px] font-semibold tabular-nums leading-tight', x.cls)}>{x.value}</div>
          </Card>
        ))}
      </div>
      <Card className="p-5">
        <h2 className="font-display text-lg font-semibold text-fg mb-3">Rating distribution</h2>
        <GYRBar g={c.green} y={c.yellow} r={c.red} height={12} />
        <div className="flex flex-wrap gap-4 mt-3 text-sm">
          {(['green', 'yellow', 'red'] as Rating[]).map(r => <span key={r} className="flex items-center gap-2 text-muted capitalize"><RatingDot r={r} />{r} <b className="text-fg tabular-nums">{c[r]}</b></span>)}
          <span className="text-muted">Skipped <b className="text-fg tabular-nums">{session.results.filter(r => r.outcome === 'skipped').length}</b></span>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-4">{patternsUsed.map(id => <PatternTag key={id} id={id} />)}</div>
      </Card>
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-4 pb-3">
          <h2 className="font-display text-lg font-semibold text-fg">Needs another revision <span className="text-muted tabular-nums">· {again.length}</span></h2>
          {again.length > 0 && <Button size="sm" variant="outline" onClick={retry}><RotateCcw size={14} />Retry these now</Button>}
        </div>
        {again.length === 0 ? <div className="px-5 pb-5 text-sm text-muted">Every attempted problem was Green.</div> : (
          <ul className="divide-y divide-line/70 border-t border-line/70">
            {again.map(r => {
              const p = d.problems[r.problemId]; if (!p) return null;
              return (
                <li key={r.problemId}><button onClick={() => openProblem(p.id)} className="w-full flex items-center justify-between gap-3 px-5 py-2.5 text-left hover:bg-surface2/60">
                  <span className="min-w-0"><span className="block text-sm font-semibold text-fg truncate">{p.name}</span><span className="text-xs text-muted">{d.patterns[p.patternId]?.name} · next review {fmt(p.nextReview, 'd MMM')}</span></span>
                  <RatingPill r={r.rating} />
                </button></li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
