import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, ExternalLink, Pause, Play, SkipForward, Timer, Eye, Trophy, RotateCcw, CheckCircle2 } from 'lucide-react';
import { useData, addSessionResult, finishSession, startSession, settingsOf } from '../lib/store';
import { PHASE_HINT } from '../lib/engine';
import { fmt } from '../lib/dates';
import { Button, Card, Dialog, DiffPill, PhasePill, Progress, RatingPill, cx, Empty, GYRBar, PageHeader, RatingDot } from '../components/ui';
import { useApp, RatingForm, initialRatingValue, submitRating, PatternTag, useTicker, RatingFormValue } from '../components/shared';
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
      <PageHeader title="Practice session" />
      <Card><Empty icon={<CheckCircle2 size={28} />} title="No session in progress" body="Start one from Today's Revision or Mixed Practice."
        action={<div className="flex gap-2"><Button variant="primary" onClick={() => go('practice')}>Mixed practice</Button><Button onClick={() => go('today')}>Today's revision</Button></div>} /></Card>
    </div>
  );
  return <Runner key={active.id} session={active} />;
}

function Runner({ session }: { session: Session }) {
  const d = useData(); const s = settingsOf(d);
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
  useTicker(clock.since !== null);

  useEffect(() => {
    if (p) { setClock({ base: 0, since: Date.now() }); setTimeTouched(false); setPeek(false); }
  }, [pid]);

  useEffect(() => {
    if (index >= ids.length && session.status === 'in_progress') {
      finishSession(session.id, 'completed', session.elapsedSec);
      go(`summary-${session.id}`);
    }
  }, [index, ids.length]);

  if (!p || !form) return null;
  const ms = clock.base + (clock.since !== null ? Date.now() - clock.since : 0);
  const sec = Math.floor(ms / 1000);
  const running = clock.since !== null;
  const totalSec = session.elapsedSec + sec;
  const formWithTime = timeTouched ? form : { ...form, timeMin: sec >= 30 ? String(Math.max(1, Math.round(sec / 60))) : form.timeMin };
  const toggle = () => setClock(c => c.since !== null ? { base: c.base + Date.now() - c.since, since: null } : { ...c, since: Date.now() });

  const saveNext = () => {
    const r = submitRating(p.id, formWithTime, session.kind === 'today' ? 'today' : 'session', session.id);
    if (!r) return;
    addSessionResult(session.id, { problemId: p.id, outcome: 'rated', rating: r.rating, timeSec: sec, revisionId: r.id }, session.elapsedSec + sec);
  };
  const skip = () => addSessionResult(session.id, { problemId: p.id, outcome: 'skipped', rating: null, timeSec: sec, revisionId: null }, session.elapsedSec + sec);
  const exit = (finish: boolean) => {
    setExitOpen(false);
    finishSession(session.id, 'abandoned', totalSec);
    go(finish ? `summary-${session.id}` : 'dashboard');
  };
  const resultOf = (id: string) => session.results.find(r => r.problemId === id);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="outline" size="sm" onClick={() => setExitOpen(true)}><ArrowLeft size={14} />Exit session</Button>
          <div className="min-w-0">
            <h1 className="font-display text-xl font-extrabold text-fg truncate">{session.title}</h1>
            <div className="text-xs text-muted flex items-center gap-2"><span className="tabular-nums">Problem {index + 1} of {ids.length}</span><span>·</span><Timer size={12} /><span className="tabular-nums">{fmtDur(totalSec)} elapsed</span></div>
          </div>
        </div>
        <div className="w-full sm:w-64">
          <div className="flex justify-between text-xs text-muted mb-1"><span>Session progress</span><span className="tabular-nums">{Math.round((index / ids.length) * 100)}% ({index}/{ids.length})</span></div>
          <Progress value={index / ids.length} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <Card className="lg:col-span-3 p-5 min-w-0">
          <div className="text-xs font-mono text-muted">#{p.num}{p.subPattern ? ` · ${p.subPattern}` : ''}</div>
          <h2 className="font-display text-2xl font-extrabold text-fg mt-1 text-balance">{index + 1}. {p.name}</h2>
          <div className="flex flex-wrap items-center gap-1.5 mt-3"><PatternTag id={p.patternId} /><DiffPill d={p.difficulty} /><RatingPill r={p.lastRating} /><PhasePill p={form.phaseUsed} /></div>
          <div className="mt-5 rounded-xl border border-accent/30 bg-accent/8 px-4 py-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-accent">{form.phaseUsed}</div>
            <p className="text-sm text-fg mt-1">{PHASE_HINT[form.phaseUsed]}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-5">
            {p.url ? (
              <a href={p.url} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center gap-2 rounded-lg bg-accent px-5 text-[15px] font-semibold text-accentfg hover:bg-accent/90">
                <ExternalLink size={16} />Open on {/leetcode/.test(p.url) ? 'LeetCode' : /geeksforgeeks/.test(p.url) ? 'GeeksforGeeks' : 'site'}
              </a>
            ) : <span className="text-sm text-muted">No link saved for this problem.</span>}
            <div className="flex items-center gap-2 rounded-lg border border-line bg-surface2 pl-3 pr-1 h-11">
              <Timer size={16} className={running ? 'text-accent' : 'text-muted'} />
              <span className="font-mono text-lg font-bold text-fg tabular-nums w-[4.5ch]">{fmtDur(sec)}</span>
              <Button size="icon" variant="ghost" onClick={toggle} aria-label={running ? 'Pause timer' : 'Resume timer'}>{running ? <Pause size={16} /> : <Play size={16} />}</Button>
            </div>
          </div>
          {(p.weakness || p.notes) && (
            <div className="mt-5">
              {!peek ? (
                <Button variant="ghost" size="sm" onClick={() => setPeek(true)}><Eye size={14} />Show last weakness and notes</Button>
              ) : (
                <div className="rounded-xl border border-hot/30 bg-hot/8 px-4 py-3 text-sm">
                  {p.weakness && <p className="text-fg"><span className="font-semibold text-hot">Last weakness: </span>{p.weakness}</p>}
                  {p.notes && <p className="text-muted mt-1.5 whitespace-pre-wrap">{p.notes}</p>}
                </div>
              )}
              {!peek && form.phaseUsed === 'Reconstruction' && <p className="text-xs text-muted mt-1 ml-1">Reconstruction works best without peeking.</p>}
            </div>
          )}
          <div className="mt-6 pt-4 border-t border-line">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">Queue</div>
            <div className="flex flex-wrap gap-1.5">
              {ids.map((id, i) => {
                const r = resultOf(id); const q = d.problems[id];
                return (
                  <span key={id} title={q?.name} className={cx('inline-flex h-7 min-w-7 items-center justify-center gap-1 rounded-md border px-1.5 text-xs font-semibold tabular-nums',
                    i === index ? 'border-accent bg-accent/15 text-accent' : r ? 'border-line bg-surface2 text-muted' : 'border-line text-muted')}>
                    {r?.rating ? <RatingDot r={r.rating} size={7} /> : r ? '–' : null}{i + 1}
                  </span>
                );
              })}
            </div>
          </div>
        </Card>

        <Card className="lg:col-span-2 p-5 min-w-0">
          <h2 className="font-display text-[15px] font-bold text-fg mb-3">Mark your revision</h2>
          <RatingForm problem={p} value={formWithTime} idPrefix="run"
            onChange={v => { if (v.timeMin !== formWithTime.timeMin) setTimeTouched(true); setForm(v); }} />
          <div className="flex items-center justify-between gap-2 mt-5">
            <Button variant="ghost" onClick={skip}><SkipForward size={15} />Skip</Button>
            <Button variant="primary" size="lg" disabled={!form.rating} onClick={saveNext}>{index + 1 === ids.length ? 'Save & finish' : 'Save & next'}<ArrowRight size={16} /></Button>
          </div>
          <p className="text-[11px] text-muted mt-3">Opening or skipping a problem never rates it. Only "Save" records a revision.</p>
        </Card>
      </div>

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
  const retry = () => {
    startSession({ kind: 'weakness', title: 'Retry: problems needing another revision', config: null, problemIds: again.map(r => r.problemId) });
    go('session');
  };
  return (
    <div>
      <PageHeader title={session.status === 'completed' ? 'Session complete' : 'Session ended early'} sub={`${session.title} · ${fmt(session.startedAt.slice(0, 10))}`}
        right={<><Button onClick={() => go('practice')}>New session</Button><Button variant="primary" onClick={() => go('dashboard')}>Back to dashboard</Button></>} />
      {session.status !== 'completed' && <p className="-mt-2 mb-4 text-sm text-hot">This session was not finished, so it is not counted as a completed session. The ratings you saved are kept.</p>}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="px-4 py-3.5"><div className="text-xs text-muted">Attempted</div><div className="font-display text-2xl font-extrabold text-fg tabular-nums">{rated.length}<span className="text-base text-muted"> / {session.problemIds.length}</span></div></Card>
        <Card className="px-4 py-3.5"><div className="text-xs text-muted">Accuracy (green)</div><div className="font-display text-2xl font-extrabold text-ok tabular-nums">{acc}%</div></Card>
        <Card className="px-4 py-3.5"><div className="text-xs text-muted">Completion time</div><div className="font-display text-2xl font-extrabold text-fg tabular-nums">{fmtDur(session.elapsedSec)}</div></Card>
        <Card className="px-4 py-3.5"><div className="text-xs text-muted">Patterns practiced</div><div className="font-display text-2xl font-extrabold text-fg tabular-nums">{patternsUsed.length}</div></Card>
      </div>
      <Card className="mt-4 p-5">
        <div className="flex items-center gap-2 mb-3"><Trophy size={17} className="text-accent" /><h2 className="font-display font-bold text-fg">Rating distribution</h2></div>
        <GYRBar g={c.green} y={c.yellow} r={c.red} height={12} />
        <div className="flex flex-wrap gap-4 mt-3 text-sm">
          {(['green', 'yellow', 'red'] as Rating[]).map(r => <span key={r} className="flex items-center gap-2 text-muted capitalize"><RatingDot r={r} />{r} <b className="text-fg tabular-nums">{c[r]}</b></span>)}
          <span className="text-muted">Skipped <b className="text-fg tabular-nums">{session.results.filter(r => r.outcome === 'skipped').length}</b></span>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-4">{patternsUsed.map(id => <PatternTag key={id} id={id} />)}</div>
      </Card>
      <Card className="mt-4">
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-4 pb-3">
          <h2 className="font-display font-bold text-fg">Needs another revision <span className="text-muted tabular-nums">· {again.length}</span></h2>
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
