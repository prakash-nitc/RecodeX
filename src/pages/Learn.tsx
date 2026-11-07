import React, { useMemo, useState } from 'react';
import { GraduationCap, Rocket, CheckCircle2, Plus, BookOpen } from 'lucide-react';
import { useData, setLearningState, activateProblems, setLearned } from '../lib/store';
import { Button, Card, PageHeader, Progress, Segmented, Checkbox, DiffPill, Empty, cx, Select, useUi, LinkButton, StatusPill } from '../components/ui';
import { useApp } from '../components/shared';
import { settingsOf } from '../lib/store';
import { statusOf } from '../lib/engine';
import { fmt } from '../lib/dates';
import { patternRoute } from './Patterns';
import type { Pattern } from '../types';

export default function Learn() {
  const d = useData(); const s = settingsOf(d);
  const { openProblem, go, addProblemDialog } = useApp();
  const { toast, confirm } = useUi();
  const [addId, setAddId] = useState('');
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
      <PageHeader title="Yet to Learn" sub="Topics you have not studied yet. Their problems stay out of the daily queue until you activate them." />
      <Card className="mb-4 flex flex-wrap items-center gap-3 px-4 py-3">
        <span className="text-sm text-muted">Hold back another topic:</span>
        <Select aria-label="Topic to move" value={addId} onChange={e => setAddId(e.target.value)}>
          <option value="">Choose a pattern…</option>
          {activeTopics.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
        <Button size="sm" variant="outline" disabled={!addId} onClick={moveToBacklog}><Plus size={14} />Move to Yet to Learn</Button>
      </Card>
      {topics.length === 0 ? (
        <Card><Empty icon={<CheckCircle2 size={28} />} title="No topics in the backlog" body="Every pattern is in active revision." /></Card>
      ) : (
        <div className="flex flex-col gap-4">{topics.map(t => <Topic key={t.id} topic={t} />)}</div>
      )}
    </div>
  );
}

function Topic({ topic }: { topic: Pattern }) {
  const d = useData(); const s = settingsOf(d);
  const { openProblem, go, addProblemDialog } = useApp();
  const { toast } = useUi();
  const probs = Object.values(d.problems).filter(p => p.patternId === topic.id).sort((a, b) => a.num - b.num);
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
          <div className={cx('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', topic.learning === 'completed' ? 'bg-ok/12 text-ok-ink' : topic.learning === 'learning' ? 'bg-accent/12 text-accent-ink' : 'bg-surface2 text-muted')}><GraduationCap size={19} /></div>
          <div className="min-w-0">
            <button onClick={() => go(patternRoute(topic.id))} className="font-display text-lg font-bold text-fg hover:text-accent-ink">{topic.name}</button>
            <div className="text-xs text-muted">{probs.length} problems · {topic.subPatterns.join(' · ')}</div>
          </div>
        </div>
        <Segmented size="sm" ariaLabel={`${topic.name} learning state`} value={topic.learning}
          onChange={v => { setLearningState(topic.id, v); if (v === 'learning') setOpen(true); toast(`${topic.name}: ${v === 'learning' ? 'currently learning' : v === 'completed' ? 'marked learned' : 'yet to learn'}`); }}
          options={[{ value: 'yet_to_learn', label: 'Yet to learn' }, { value: 'learning', label: 'Learning' }, { value: 'completed', label: 'Learned' }]} />
      </div>
      <div className="px-4 sm:px-5 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm mb-1.5">
          <span className="text-muted">Solved while learning <b className="text-fg tabular-nums">{learned.length}/{probs.length}</b> · In revision <b className="text-fg tabular-nums">{active.length}</b></span>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={!learnedBacklog.length} onClick={() => activate(learnedBacklog.map(p => p.id), 'solved problems')}><Rocket size={14} />Activate solved ({learnedBacklog.length})</Button>
            <Button size="sm" variant="ghost" disabled={!backlog.length} onClick={() => activate(backlog.map(p => p.id), 'problems')}>Activate all ({backlog.length})</Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(!open)}>{open ? 'Hide problems' : 'Show problems'}</Button>
          </div>
        </div>
        <Progress value={probs.length ? learned.length / probs.length : 0} tone="ok" />
        {topic.learning === 'completed' && backlog.length > 0 && <p className="text-xs text-hot-ink mt-2">Marked learned, but {backlog.length} problems are still held back. Activate them to start spaced revision.</p>}
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
