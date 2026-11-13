import React, { useMemo, useState } from 'react';
import { GraduationCap, Rocket, CheckCircle2, Plus, Mountain, Flag, ChevronDown, ChevronUp } from 'lucide-react';
import { useData, setLearningState, activateProblems, setLearned } from '../lib/store';
import { Button, Card, PageHeader, Progress, Segmented, Checkbox, DiffPill, Empty, cx, Select, useUi, LinkButton, StatusPill, SectionLabel } from '../components/ui';
import { useApp } from '../components/shared';
import { settingsOf } from '../lib/store';
import { statusOf } from '../lib/engine';
import { fmt } from '../lib/dates';
import { compareInPattern } from '../lib/order';
import { patternRoute } from './Patterns';
import { MountainScene } from '../components/art/Mountains';
import type { Pattern } from '../types';

// ---------------------------------------------------------------------------
// Visual learning roadmap: a winding trail from base camp (bottom) to summit

function RoadmapTrail({ topics, allProbs, go }: { topics: Pattern[]; allProbs: Record<string, import('../types').Problem>; go: (r: string) => void }) {
  if (topics.length === 0) return null;
  const probs = Object.values(allProbs);
  return (
    <div className="relative">
      {/* Mountain art backdrop */}
      <div className="absolute inset-x-0 top-0 h-40 overflow-hidden rounded-t-2xl opacity-25 pointer-events-none">
        <MountainScene className="w-full h-full" />
      </div>

      <div className="relative flex flex-col gap-0 py-6 px-2 sm:px-4">
        {/* Summit flag */}
        <div className="flex items-center justify-center gap-2 mb-6 relative z-10">
          <div className="flex items-center gap-2 rounded-2xl border border-ok/30 bg-ok/8 px-4 py-2.5 shadow-card">
            <Flag size={16} className="text-ok-ink" />
            <span className="font-display text-sm font-bold text-ok-ink">Summit · Full Mastery</span>
          </div>
        </div>

        {/* Trail from summit (top) to base camp (bottom) — topics in reverse order */}
        <div className="relative">
          {/* Vertical trail line */}
          <div className="absolute left-6 sm:left-8 top-0 bottom-0 w-0.5 bg-gradient-to-b from-ok/40 via-accent/30 to-line" aria-hidden />

          <div className="flex flex-col gap-3">
            {topics.slice().reverse().map((topic, i) => {
              const ps = probs.filter(p => p.patternId === topic.id);
              const learned = ps.filter(p => p.learnedAt || p.lastRating).length;
              const pct = ps.length ? learned / ps.length : 0;
              const isLearning = topic.learning === 'learning';
              const altitude = topics.length - i;

              return (
                <button
                  key={topic.id}
                  onClick={() => go(patternRoute(topic.id))}
                  className="group relative flex items-start gap-4 sm:gap-5 text-left pl-2 sm:pl-4"
                >
                  {/* Camp marker on the trail */}
                  <div className={cx(
                    'relative z-10 flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl border-2 transition-colors',
                    isLearning ? 'border-accent/50 bg-accent/12 text-accent-ink' :
                    'border-line bg-surface2 text-muted',
                  )}>
                    <Mountain size={18} />
                  </div>

                  <div className="flex-1 min-w-0 rounded-2xl border border-line bg-surface p-3.5 sm:p-4 shadow-card group-hover:border-accent/40 group-hover:shadow-lift transition-[border-color,box-shadow]">
                    <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-muted tabular-nums">CAMP {altitude}</span>
                          <span className={cx(
                            'rounded-lg px-1.5 py-0.5 text-[10px] font-bold',
                            isLearning ? 'bg-accent/12 text-accent-ink' :
                            'bg-surface2 text-muted',
                          )}>
                            {isLearning ? 'Learning' : 'Yet to learn'}
                          </span>
                        </div>
                        <div className="font-display text-base sm:text-lg font-semibold text-fg mt-0.5 group-hover:text-accent-ink transition-colors">{topic.name}</div>
                      </div>
                      <span className={cx('font-display text-xl font-bold tabular-nums leading-none', pct >= 1 ? 'text-ok-ink' : pct > 0 ? 'text-fg' : 'text-muted')}>
                        {Math.round(pct * 100)}%
                      </span>
                    </div>
                    <Progress value={pct} tone="ok" className="mb-2" />
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
                      <span className="tabular-nums">{learned}/{ps.length} solved</span>
                      {topic.subPatterns.length > 0 && <span>· {topic.subPatterns.slice(0, 3).join(', ')}{topic.subPatterns.length > 3 ? ` +${topic.subPatterns.length - 3}` : ''}</span>}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Base camp marker */}
          <div className="relative flex items-center gap-4 sm:gap-5 pl-2 sm:pl-4 mt-3">
            <div className="relative z-10 flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl border-2 border-line bg-surface2 text-muted">
              <GraduationCap size={18} />
            </div>
            <div className="text-sm font-semibold text-muted">Base Camp · Start here</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Topic card with problems list

function Topic({ topic }: { topic: Pattern }) {
  const d = useData(); const s = settingsOf(d);
  const { openProblem, go, addProblemDialog } = useApp();
  const { toast } = useUi();
  const probs = Object.values(d.problems).filter(p => p.patternId === topic.id).sort((a, b) => compareInPattern(a, b, topic));
  const backlog = probs.filter(p => p.track === 'backlog');
  const learned = probs.filter(p => p.learnedAt || p.lastRating);
  const active = probs.filter(p => p.track === 'active');
  const learnedBacklog = backlog.filter(p => p.learnedAt);
  const [open, setOpen] = useState(topic.learning === 'learning');
  const activate = (ids: string[], label: string) => { activateProblems(ids); toast(`${ids.length} ${label} moved into active revision`); };
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 sm:px-5 pt-4 pb-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className={cx('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', topic.learning === 'learning' ? 'bg-accent/12 text-accent-ink' : 'bg-surface2 text-muted')}><GraduationCap size={19} /></div>
          <div className="min-w-0">
            <button onClick={() => go(patternRoute(topic.id))} className="font-display text-lg font-bold text-fg hover:text-accent-ink transition-colors">{topic.name}</button>
            <div className="text-xs text-muted">{probs.length} problems · {topic.subPatterns.join(' · ')}</div>
          </div>
        </div>
        <Segmented size="sm" ariaLabel={`${topic.name} learning state`} value={topic.learning}
          onChange={v => {
            const held = backlog.length;
            setLearningState(topic.id, v); if (v === 'learning') setOpen(true);
            toast(v === 'active' ? `${topic.name} moved into revision${held ? ` · ${held} problem${held === 1 ? '' : 's'} activated` : ''}` : `${topic.name}: ${v === 'learning' ? 'currently learning' : 'yet to learn'}`);
          }}
          options={[{ value: 'yet_to_learn', label: 'Yet to learn' }, { value: 'learning', label: 'Learning' }, { value: 'active', label: 'Learned · start revising' }]} />
      </div>
      <div className="px-4 sm:px-5 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm mb-1.5">
          <span className="text-muted">Solved while learning <b className="text-fg tabular-nums">{learned.length}/{probs.length}</b> · In revision <b className="text-fg tabular-nums">{active.length}</b></span>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={!learnedBacklog.length} onClick={() => activate(learnedBacklog.map(p => p.id), 'solved problems')}><Rocket size={14} />Activate solved ({learnedBacklog.length})</Button>
            <Button size="sm" variant="ghost" disabled={!backlog.length} onClick={() => activate(backlog.map(p => p.id), 'problems')}>Activate all ({backlog.length})</Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(!open)}>
              {open ? <><ChevronUp size={14} />Hide</> : <><ChevronDown size={14} />Show problems</>}
            </Button>
          </div>
        </div>
        <Progress value={probs.length ? learned.length / probs.length : 0} tone="ok" />
      </div>
      {open && (
        <ul className="divide-y divide-line/70 border-t border-line/70">
          {probs.map(p => (
            <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 sm:px-5 py-2">
              <Checkbox checked={!!(p.learnedAt || p.lastRating)} disabled={!!p.lastRating} onChange={v => setLearned(p.id, v)} label={<span className="sr-only">Solved while learning</span>} />
              <button className="min-w-0 flex-1 text-left" onClick={() => openProblem(p.id)}>
                <div className="text-sm font-semibold text-fg truncate">{p.name}</div>
                <div className="text-xs text-muted">{p.subPattern}{p.learnedAt ? ` · solved ${fmt(p.learnedAt, 'd MMM')}` : ''}</div>
              </button>
              <DiffPill d={p.difficulty} />
              <LinkButton url={p.url} />
              {p.track === 'backlog'
                ? <Button size="sm" variant="outline" onClick={() => activate([p.id], 'problem')}>Activate</Button>
                : <StatusPill s={statusOf(p, s)} />}
            </li>
          ))}
          <li className="px-4 sm:px-5 py-2"><Button size="sm" variant="ghost" onClick={() => addProblemDialog({ patternId: topic.id, initial: 'backlog' })}><Plus size={14} />Add a problem to {topic.name}</Button></li>
        </ul>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main page

export default function Learn() {
  const d = useData(); const s = settingsOf(d);
  const { openProblem, go, addProblemDialog } = useApp();
  const { toast, confirm } = useUi();
  const [addId, setAddId] = useState('');
  const [view, setView] = useState<'roadmap' | 'list'>('roadmap');
  const topics = Object.values(d.patterns).filter(p => p.learning !== 'active').sort((a, b) => a.order - b.order);
  const activeTopics = Object.values(d.patterns).filter(p => p.learning === 'active').sort((a, b) => a.order - b.order);

  const moveToBacklog = async () => {
    const pt = d.patterns[addId]; if (!pt) return;
    if (await confirm({ title: `Move ${pt.name} to Yet to Learn?`, body: 'Its never-reviewed problems leave the daily queue until you activate them. Problems you already rated stay in revision.', confirmLabel: 'Move to Yet to Learn' })) {
      setLearningState(pt.id, 'yet_to_learn'); setAddId(''); toast(`${pt.name} moved to Yet to Learn`);
    }
  };

  return (
    <div>
      <PageHeader eyebrow={<span className="inline-flex items-center gap-1.5"><GraduationCap size={13} />Learning roadmap</span>} title="Yet to Learn"
        sub="Topics you haven't studied yet. Their problems stay out of the daily queue until you activate them."
        right={<Segmented ariaLabel="View mode" value={view} onChange={setView} options={[{ value: 'roadmap', label: 'Roadmap' }, { value: 'list', label: 'Detail list' }]} />} />

      <Card className="mb-4 flex flex-wrap items-center gap-3 px-4 py-3">
        <span className="text-sm text-muted">Hold back another topic:</span>
        <Select aria-label="Topic to move" value={addId} onChange={e => setAddId(e.target.value)}>
          <option value="">Choose a pattern…</option>
          {activeTopics.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
        <Button size="sm" variant="outline" disabled={!addId} onClick={moveToBacklog}><Plus size={14} />Move to Yet to Learn</Button>
      </Card>

      {topics.length === 0 ? (
        <Card>
          <Empty
            art={<MountainScene className="h-32 w-full" />}
            icon={<CheckCircle2 size={28} />}
            title="No topics in the backlog"
            body="Every pattern is in active revision. You're on top of everything."
          />
        </Card>
      ) : view === 'roadmap' ? (
        <Card className="overflow-hidden">
          <RoadmapTrail topics={topics} allProbs={d.problems} go={go} />
        </Card>
      ) : (
        <div className="flex flex-col gap-4">{topics.map(t => <Topic key={t.id} topic={t} />)}</div>
      )}
    </div>
  );
}
