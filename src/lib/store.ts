// Application state: an in-memory mirror of the database plus every mutation the UI performs.
import { useSyncExternalStore } from 'react';
import type { Backend, Col, Change } from './backend';
import type {
  Meta, Pattern, Problem, Revision, Session, Settings, Rating, Phase, Priority, Difficulty, Track, SessionResult,
} from '../types';
import { DEFAULT_SETTINGS } from '../types';
import { applyRevision, RevisionInput, suggestPhase, priorityFor } from './engine';
import { nowIso, today, addDays } from './dates';
import { SEED, linkToUrl } from '../seed';

export interface DataState {
  status: 'booting' | 'slow' | 'ready' | 'error';
  needsImport: boolean;
  backendKind: 'cloud' | 'local' | null;
  pending: number;
  offline: boolean;
  error: string | null;
  meta: Meta | null;
  patterns: Record<string, Pattern>;
  problems: Record<string, Problem>;
  revisions: Record<string, Revision>;
  sessions: Record<string, Session>;
}

const initialState = (): DataState => ({
  status: 'booting', needsImport: false, backendKind: null, pending: 0, offline: false, error: null,
  meta: null, patterns: {}, problems: {}, revisions: {}, sessions: {},
});
let state: DataState = initialState();
let backend: Backend | null = null;
const listeners = new Set<() => void>();
function emit() { listeners.forEach(l => l()); }
function set(patch: Partial<DataState>) { state = { ...state, ...patch }; emit(); }
export function getState() { return state; }
export function useData(): DataState {
  return useSyncExternalStore(cb => { listeners.add(cb); return () => listeners.delete(cb); }, () => state);
}
export function settingsOf(s: DataState = state): Settings {
  return { ...DEFAULT_SETTINGS, ...(s.meta?.settings ?? {}) };
}

function applyChanges(col: Col | 'meta', changes: Change[]) {
  if (col === 'meta') {
    const meta = changes[0].data as Meta | null;
    // Another device finished the first-run import while this one showed the import screen.
    set(meta?.importedAt && state.needsImport ? { meta, needsImport: false } : { meta });
    return;
  }
  const next = { ...state[col] } as Record<string, any>;
  for (const c of changes) { if (c.data === null) delete next[c.id]; else next[c.id] = c.data; }
  set({ [col]: next } as any);
}

/** An account needs the first-run import until it has been imported (or started empty) and holds no problems. */
function isEmptyAccount(hasMeta: boolean) {
  if (!hasMeta) return true;
  return !state.meta?.importedAt && Object.keys(state.problems).length === 0;
}

export function boot(b: Backend) {
  backend?.stop?.();
  backend = b;
  state = { ...initialState(), backendKind: b.kind };
  emit();
  const mine = b;
  const live = <A extends unknown[]>(fn: (...a: A) => void) => (...a: A) => { if (backend === mine) fn(...a); };
  b.start({
    onChanges: live(applyChanges),
    onReady: live((hasMeta: boolean) => set({ status: 'ready', needsImport: isEmptyAccount(hasMeta) })),
    onSlow: live(() => { if (state.status === 'booting') set({ status: 'slow' }); }),
    onError: live((msg: string) => set({ error: msg })),
    onPending: live((n: number) => { if (n !== state.pending) set({ pending: n }); }),
    onOffline: live((offline: boolean) => { if (offline !== state.offline) set({ offline }); }),
  });
}

/** Stops the current backend and empties memory (sign-out). With clearDevice, cached data is removed too. */
export async function shutdown(clearDevice = false) {
  const b = backend;
  backend = null;
  b?.stop?.();
  if (clearDevice) await b?.clearLocal?.();
  state = initialState();
  emit();
}
export function clearError() { set({ error: null }); }
export function flushed() { return backend?.flushed() ?? Promise.resolve(); }

// ---------------------------------------------------------------------------------------------
// low-level writes (optimistic: update memory, then persist)

function putDoc<C extends Col>(col: C, doc: DataState[C][string]) {
  const rec = { ...state[col], [(doc as any).id]: doc };
  set({ [col]: rec } as any);
  backend?.put(col, (doc as any).id, doc);
}
function delDoc(col: Col, id: string) {
  const rec = { ...state[col] } as Record<string, any>; delete rec[id];
  set({ [col]: rec } as any);
  backend?.remove(col, id);
}
function putMeta(meta: Meta) { set({ meta }); backend?.putMeta(meta); }

export function rid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
export function slug(s: string) {
  return s.toLowerCase().replace(/&/g, 'and').replace(/'/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'pattern';
}
export function normName(s: string) {
  return s.toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}
export function normUrl(u: string) {
  return u.trim().toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
}

function baseMeta(): Meta {
  return state.meta ?? { settings: { ...DEFAULT_SETTINGS }, nextNum: 101, importedAt: null, schemaVersion: 1 };
}
function takeNum(): number {
  const m = baseMeta();
  const num = Math.max(m.nextNum, ...Object.values(state.problems).map(p => p.num + 1), 101);
  putMeta({ ...m, nextNum: num + 1 });
  return num;
}

// ---------------------------------------------------------------------------------------------
// settings

export function updateSettings(patch: Partial<Settings>) {
  const m = baseMeta();
  putMeta({ ...m, settings: { ...settingsOf(), ...patch } });
}

// ---------------------------------------------------------------------------------------------
// problems

export interface ProblemFields {
  name: string; patternId: string; subPattern: string; difficulty: Difficulty; url: string;
  priority: Priority; track: Track; notes: string; weakness?: string; phase?: Phase; phaseManual?: boolean;
  initial?: 'not_reviewed' | 'due_today' | 'backlog';
}

export function findDuplicates(name: string, url: string, excludeId?: string): Problem[] {
  const n = normName(name), u = url ? normUrl(url) : '';
  return Object.values(state.problems).filter(p => p.id !== excludeId && ((n && normName(p.name) === n) || (u && p.url && normUrl(p.url) === u)));
}

export function addProblem(f: ProblemFields): Problem {
  const num = takeNum();
  const t = today();
  const p: Problem = {
    id: `p-${num}`, num, name: f.name.trim(), patternId: f.patternId, subPattern: f.subPattern.trim(),
    difficulty: f.difficulty, url: f.url.trim(), priority: f.priority,
    track: f.initial === 'backlog' ? 'backlog' : 'active',
    lastRating: null, lastRevised: null, nextReview: null,
    phase: 'Reconstruction', phaseManual: false, consecutiveGreen: 0, revisionCount: 0,
    weakness: f.weakness ?? '', notes: f.notes ?? '', learnedAt: null, createdAt: nowIso(), updatedAt: nowIso(),
  };
  if (f.initial === 'due_today') p.nextReview = t;
  ensureSubPattern(p.patternId, p.subPattern);
  putDoc('problems', p);
  return p;
}

export function updateProblem(id: string, patch: Partial<Problem>) {
  const p = state.problems[id]; if (!p) return;
  const next = { ...p, ...patch, updatedAt: nowIso() };
  if (patch.subPattern !== undefined || patch.patternId !== undefined) ensureSubPattern(next.patternId, next.subPattern);
  putDoc('problems', next);
}

export function deleteProblems(ids: string[]) {
  const set_ = new Set(ids);
  for (const r of Object.values(state.revisions)) if (set_.has(r.problemId)) delDoc('revisions', r.id);
  for (const id of ids) delDoc('problems', id);
}

export function bulkUpdate(ids: string[], fn: (p: Problem) => Partial<Problem>) {
  for (const id of ids) { const p = state.problems[id]; if (p) updateProblem(id, fn(p)); }
}

export function markNotReviewed(ids: string[]) {
  bulkUpdate(ids, () => ({ lastRating: null, lastRevised: null, nextReview: null, consecutiveGreen: 0, phase: 'Reconstruction', phaseManual: false }));
}

export function activateProblems(ids: string[]) {
  const s = settingsOf(); const t = today();
  bulkUpdate(ids, p => p.track === 'active' ? {} : ({
    track: 'active',
    // A problem solved while learning gets its first spaced review; otherwise it waits as Not Reviewed.
    nextReview: p.lastRating ? p.nextReview : (p.learnedAt ? addDays(t, s.activationDelayDays) : null),
    lastRating: p.lastRating, phase: 'Reconstruction',
  }));
}

/** A problem solved while learning has a first review scheduled but no rating yet. */
export function setLearned(id: string, learned: boolean) {
  const p = state.problems[id]; if (!p) return;
  updateProblem(id, { learnedAt: learned ? today() : null });
}

// ---------------------------------------------------------------------------------------------
// revisions

export function recordRevision(problemId: string, input: RevisionInput): Revision | null {
  const p = state.problems[problemId]; if (!p) return null;
  const { problem, revision } = applyRevision(p, input, settingsOf(), rid('r'));
  if (!problem.learnedAt && p.track === 'backlog') problem.learnedAt = revision.date;
  putDoc('revisions', revision);
  putDoc('problems', problem);
  return revision;
}

export function latestRevisionOf(problemId: string): Revision | null {
  let best: Revision | null = null;
  for (const r of Object.values(state.revisions)) if (r.problemId === problemId && (!best || r.at > best.at)) best = r;
  return best;
}

export function undoRevision(revisionId: string): boolean {
  const r = state.revisions[revisionId]; if (!r) return false;
  const latest = latestRevisionOf(r.problemId);
  const p = state.problems[r.problemId];
  if (!latest || latest.id !== r.id || !p || !r.prev) return false;
  putDoc('problems', { ...p, ...r.prev, updatedAt: nowIso() });
  delDoc('revisions', r.id);
  return true;
}

// ---------------------------------------------------------------------------------------------
// patterns

export function ensureSubPattern(patternId: string, sub: string) {
  const pt = state.patterns[patternId];
  if (!pt || !sub.trim() || pt.subPatterns.includes(sub.trim())) return;
  putDoc('patterns', { ...pt, subPatterns: [...pt.subPatterns, sub.trim()] });
}

export function addPattern(name: string, learning: Pattern['learning'] = 'active', description = ''): Pattern {
  let id = `pt-${slug(name)}`; let i = 2;
  while (state.patterns[id]) id = `pt-${slug(name)}-${i++}`;
  const order = Math.max(0, ...Object.values(state.patterns).map(p => p.order)) + 1;
  const pt: Pattern = { id, name: name.trim(), order, subPatterns: [], learning, description, createdAt: nowIso() };
  putDoc('patterns', pt);
  return pt;
}
export function updatePattern(id: string, patch: Partial<Pattern>) {
  const pt = state.patterns[id]; if (pt) putDoc('patterns', { ...pt, ...patch });
}
export function deletePattern(id: string, moveTo: string | null) {
  const probs = Object.values(state.problems).filter(p => p.patternId === id);
  if (moveTo) bulkUpdate(probs.map(p => p.id), () => ({ patternId: moveTo }));
  else deleteProblems(probs.map(p => p.id));
  delDoc('patterns', id);
}
export function setLearningState(id: string, learning: Pattern['learning']) {
  updatePattern(id, { learning });
  if (learning === 'yet_to_learn') {
    // Move never-reviewed problems back into the backlog so they leave the daily queue.
    bulkUpdate(Object.values(state.problems).filter(p => p.patternId === id && !p.lastRating).map(p => p.id), () => ({ track: 'backlog' }));
  }
}

// ---------------------------------------------------------------------------------------------
// sessions

export function startSession(s: Omit<Session, 'id' | 'startedAt' | 'endedAt' | 'status' | 'results' | 'index' | 'elapsedSec'>): Session {
  // Only one session runs at a time: an older unfinished one is marked abandoned.
  for (const old of Object.values(state.sessions)) if (old.status === 'in_progress') putDoc('sessions', { ...old, status: 'abandoned', endedAt: nowIso() });
  const sess: Session = { ...s, id: rid('s'), startedAt: nowIso(), endedAt: null, status: 'in_progress', results: [], index: 0, elapsedSec: 0 };
  putDoc('sessions', sess);
  return sess;
}
export function updateSession(id: string, patch: Partial<Session>) {
  const s = state.sessions[id]; if (s) putDoc('sessions', { ...s, ...patch });
}
export function addSessionResult(id: string, result: SessionResult, elapsedSec: number) {
  const s = state.sessions[id]; if (!s) return;
  const results = [...s.results.filter(r => r.problemId !== result.problemId), result];
  putDoc('sessions', { ...s, results, index: s.index + 1, elapsedSec });
}
export function finishSession(id: string, status: 'completed' | 'abandoned', elapsedSec: number) {
  const s = state.sessions[id]; if (s) putDoc('sessions', { ...s, status, endedAt: nowIso(), elapsedSec });
}
export function deleteSession(id: string) { delDoc('sessions', id); }

// ---------------------------------------------------------------------------------------------
// import / backup

export interface SeedSelection { include: Set<string>; backlogNames: Set<string>; }

export function seedKey(patternName: string, i: number) { return `${patternName}::${i}`; }

export function importSeed(sel: SeedSelection) {
  const s = settingsOf();
  const meta = baseMeta();
  let num = meta.nextNum;
  let order = 1;
  for (const sp of SEED) {
    const anyIncluded = sp.rows.some((_, i) => sel.include.has(seedKey(sp.name, i)));
    if (!anyIncluded) continue;
    const backlog = sel.backlogNames.has(sp.name);
    const pt: Pattern = {
      id: `pt-${slug(sp.name)}`, name: sp.name, order: order++, learning: backlog ? 'yet_to_learn' : 'active',
      subPatterns: [...new Set(sp.rows.map(r => r.sub))], description: sp.description, createdAt: nowIso(),
    };
    putDoc('patterns', pt);
    sp.rows.forEach((row, i) => {
      if (!sel.include.has(seedKey(sp.name, i))) return;
      const n = num++;
      const reviewed = !!row.rating;
      const streak = row.rating === 'green' ? 1 : 0;
      const p: Problem = {
        id: `p-${n}`, num: n, name: row.name, patternId: pt.id, subPattern: row.sub, difficulty: row.difficulty,
        url: linkToUrl(row.link), priority: row.rating ? priorityFor(row.rating) : 'Medium',
        track: backlog && !reviewed ? 'backlog' : 'active',
        lastRating: row.rating ?? null, lastRevised: row.lastRevised ?? null, nextReview: row.nextReview ?? null,
        phase: row.phase ?? suggestPhase(row.rating ?? null, streak, null), phaseManual: false,
        consecutiveGreen: streak, revisionCount: reviewed ? 1 : 0,
        weakness: row.weakness ?? '', notes: '', learnedAt: null,
        importedName: row.original !== row.name ? row.original : undefined,
        createdAt: nowIso(), updatedAt: nowIso(),
      };
      if (p.importedName === undefined) delete p.importedName;
      putDoc('problems', p);
      if (reviewed && row.lastRevised && row.nextReview) {
        const r: Revision = {
          id: `r-import-${n}`, problemId: p.id, date: row.lastRevised, at: `${row.lastRevised}T12:00:00.000Z`,
          rating: row.rating!, phase: row.phase ?? suggestPhase(null, 0, null), timeMin: null, independent: null,
          mistake: row.weakness ?? '', notes: 'Imported from the Revision Master sheet.', sessionId: null,
          source: 'import', nextReview: row.nextReview, prev: null,
        };
        putDoc('revisions', r);
      }
    });
  }
  putMeta({ ...meta, settings: { ...s }, nextNum: num, importedAt: nowIso() });
  set({ needsImport: false });
}

export function startEmpty() {
  putMeta({ ...baseMeta(), importedAt: nowIso() });
  set({ needsImport: false });
}

/** Backups from the old "DSA Revision Manager" use the legacy app id and restore unchanged. */
export const BACKUP_APP_IDS: string[] = ['recodex', 'dsa-revision-manager'];
export interface Backup {
  app: 'recodex' | 'dsa-revision-manager'; version: 1; exportedAt: string;
  meta: Meta | null; patterns: Pattern[]; problems: Problem[]; revisions: Revision[]; sessions: Session[];
}
export function makeBackup(): Backup {
  return {
    app: 'recodex', version: 1, exportedAt: nowIso(), meta: state.meta,
    patterns: Object.values(state.patterns), problems: Object.values(state.problems),
    revisions: Object.values(state.revisions), sessions: Object.values(state.sessions),
  };
}
export function wipeAll() {
  for (const col of ['revisions', 'sessions', 'problems', 'patterns'] as Col[])
    for (const id of Object.keys(state[col])) delDoc(col, id);
}
export function restoreBackup(b: Backup) {
  wipeAll();
  b.patterns.forEach(p => putDoc('patterns', p));
  b.problems.forEach(p => putDoc('problems', p));
  b.revisions.forEach(r => putDoc('revisions', r));
  b.sessions.forEach(s => putDoc('sessions', s));
  putMeta(b.meta ?? baseMeta());
  set({ needsImport: false });
}
export function resetToImport() {
  wipeAll();
  putMeta({ ...baseMeta(), nextNum: 101, importedAt: null });
  set({ needsImport: true });
}

/** CSV rows → problems (+ an import revision when a rating and date are present). */
export function importRows(rows: ImportRow[], mode: 'skip' | 'update'): { added: number; updated: number; skipped: number } {
  const s = settingsOf();
  let added = 0, updated = 0, skipped = 0;
  const byName = new Map<string, Pattern>(Object.values(state.patterns).map(p => [p.name.toLowerCase(), p]));
  for (const r of rows) {
    let pt = byName.get(r.pattern.toLowerCase());
    if (!pt) { pt = addPattern(r.pattern); byName.set(pt.name.toLowerCase(), pt); }
    const dup = findDuplicates(r.name, r.url).find(p => p.patternId === pt!.id) ?? (r.url ? findDuplicates('', r.url)[0] : undefined);
    if (dup && mode === 'skip') { skipped++; continue; }
    const fields: Partial<Problem> = {
      name: r.name, patternId: pt.id, subPattern: r.subPattern, difficulty: r.difficulty, url: r.url, priority: r.priority,
      track: r.track, notes: r.notes, weakness: r.weakness,
    };
    if (r.rating) {
      Object.assign(fields, {
        lastRating: r.rating, lastRevised: r.lastRevised, nextReview: r.nextReview,
        consecutiveGreen: r.consecutiveGreen ?? (r.rating === 'green' ? 1 : 0),
        revisionCount: Math.max(1, r.revisionCount ?? 1),
        phase: r.phase ?? suggestPhase(r.rating, r.rating === 'green' ? 1 : 0, null),
      });
    } else if (r.phase) fields.phase = r.phase;
    let target: Problem;
    if (dup) { updateProblem(dup.id, fields); target = state.problems[dup.id]; updated++; }
    else {
      target = addProblem({ name: r.name, patternId: pt.id, subPattern: r.subPattern, difficulty: r.difficulty, url: r.url, priority: r.priority, track: r.track, notes: r.notes, weakness: r.weakness, initial: r.track === 'backlog' ? 'backlog' : 'not_reviewed' });
      updateProblem(target.id, fields); target = state.problems[target.id]; added++;
    }
    const hasImportRev = Object.values(state.revisions).some(x => x.problemId === target.id);
    if (r.rating && r.lastRevised && !hasImportRev) {
      putDoc('revisions', {
        id: rid('r'), problemId: target.id, date: r.lastRevised, at: `${r.lastRevised}T12:00:00.000Z`, rating: r.rating,
        phase: target.phase, timeMin: null, independent: null, mistake: r.weakness, notes: 'Imported from CSV.',
        sessionId: null, source: 'import', nextReview: r.nextReview ?? addDays(r.lastRevised, s.yellowDays), prev: null,
      });
    }
  }
  return { added, updated, skipped };
}

export interface ImportRow {
  name: string; pattern: string; subPattern: string; difficulty: Difficulty; url: string; priority: Priority; track: Track;
  rating: Rating | null; lastRevised: string | null; nextReview: string | null; phase: Phase | null;
  consecutiveGreen: number | null; revisionCount: number | null; weakness: string; notes: string;
}
