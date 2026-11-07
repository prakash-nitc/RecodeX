// SupabaseBackend: the Backend interface on top of Supabase tables.
//
//  * Opens instantly from a cache of the last loaded data (IndexedDB; localStorage is too small for years
//    of revisions), then syncs with the server.
//  * Sync is incremental: rows whose server-set synced_at is newer than the last sync, plus ids listed in
//    `deletions`. The first load (no cache) fetches everything.
//  * Writes are optimistic. They go through a queue that coalesces by row, sends one write per row at a
//    time, batches upserts/deletes in chunks, retries with backoff and is persisted to localStorage, so
//    changes made offline (or right before closing the tab) are sent later.
//  * Refetches when the window regains focus or the browser comes back online.
import type { SupabaseClient } from '@supabase/supabase-js';
import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval';
import type { Backend, BackendEvents, Change, Col } from '../backend';
import { COLS } from '../backend';
import { COL_OF, TABLE_OF, fromRow, toRow, type Table } from './mapping';

interface Job { col: Col | 'meta'; id: string; data: any | null; solo?: boolean }
interface Batch { table: Table; op: 'put' | 'del'; jobs: Job[] }
type Mirror = { meta: any | null } & Record<Col, Record<string, any>>;
interface CacheShape extends Mirror { v: 1; since: string | null }

const PAGE = 1000;              // PostgREST returns at most 1000 rows per request on Supabase
const CHUNK = 500;              // rows per bulk upsert
const DEL_CHUNK = 100;          // ids per bulk delete (they travel in the URL)
const MAX_INFLIGHT = 4;         // concurrent write requests
const OVERLAP_MS = 5 * 60_000;  // incremental sync re-reads this window to cover commit-order races
const SYNC_THROTTLE_MS = 5_000;
const DATA_TABLES: Table[] = ['patterns', 'problems', 'revisions', 'practice_sessions'];

const keyOf = (col: Col | 'meta', id: string) => `${col}/${id}`;
const emptyMirror = (): Mirror => ({ meta: null, patterns: {}, problems: {}, revisions: {}, sessions: {} });
const later = (a: string | null, b: string | null) => (!a ? b : !b ? a : Date.parse(b) > Date.parse(a) ? b : a);

type Failure = 'network' | 'retry' | 'fatal';
function classify(error: any, status?: number): Failure {
  const msg = String(error?.message ?? error ?? '');
  if (status === 0 || /failed to fetch|networkerror|load failed|fetch failed|network request failed/i.test(msg)) return 'network';
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'network';
  const code = String(error?.code ?? '');
  // Auth problems (expired token, signed out mid-write) are retried: the session refreshes or the user signs in again.
  if (status === 401 || status === 403 || code === '42501' || code.startsWith('PGRST30')) return 'retry';
  if (status === 408 || status === 429 || (status !== undefined && status >= 500)) return 'retry';
  return 'fatal';
}

export class SupabaseBackend implements Backend {
  kind = 'cloud' as const;
  private ev!: BackendEvents;
  private data: Mirror = emptyMirror();
  private since: string | null = null;
  private queue = new Map<string, Job>();
  private inflight = new Map<string, Job>();
  private inflightBatches = 0;
  private touched = new Map<string, number>();
  private waiters: (() => void)[] = [];
  private backoff = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private slowTimer: ReturnType<typeof setTimeout> | null = null;
  private cacheTimer: ReturnType<typeof setTimeout> | null = null;
  private queueTimer: ReturnType<typeof setTimeout> | null = null;
  private syncing: Promise<void> | null = null;
  private lastSync = 0;
  private ready = false;
  private offline = false;
  private stopped = false;
  private readonly cacheKey: string;
  private readonly queueKey: string;

  constructor(private sb: SupabaseClient, private uid: string) {
    this.cacheKey = `recodex-cache-${uid}`;
    this.queueKey = `recodex-queue-${uid}`;
  }

  // -------------------------------------------------------------------------------------------
  // lifecycle

  start(ev: BackendEvents) {
    this.ev = ev;
    this.loadQueue();
    window.addEventListener('focus', this.onFocus);
    document.addEventListener('visibilitychange', this.onVisible);
    window.addEventListener('online', this.onOnline);
    window.addEventListener('offline', this.onOffline);
    window.addEventListener('pagehide', this.persistNow);
    this.slowTimer = setTimeout(() => { if (!this.ready && !this.stopped) ev.onSlow(); }, 10_000);
    if (navigator.onLine === false) this.setOffline(true);
    void this.init();
  }

  private async init() {
    let cache: CacheShape | undefined;
    try { cache = await idbGet<CacheShape>(this.cacheKey); } catch { /* IndexedDB blocked: start from the server */ }
    if (this.stopped) return;
    if (cache?.v === 1) {
      this.data = { meta: cache.meta, patterns: cache.patterns, problems: cache.problems, revisions: cache.revisions, sessions: cache.sessions };
      this.since = cache.since;
    }
    // Changes that were still waiting to be sent win over the cached copy.
    for (const job of [...this.inflight.values(), ...this.queue.values()]) this.applyLocal(job);
    if (cache?.v === 1 || this.queue.size) { this.emitAll(); this.markReady(); }
    this.pump();
    await this.sync(true);
  }

  /** Stops syncing (sign-out or account switch). Pending writes stay persisted for the next sign-in. */
  stop() {
    if (this.stopped) return;
    this.persistNow();
    this.stopped = true;
    window.removeEventListener('focus', this.onFocus);
    document.removeEventListener('visibilitychange', this.onVisible);
    window.removeEventListener('online', this.onOnline);
    window.removeEventListener('offline', this.onOffline);
    window.removeEventListener('pagehide', this.persistNow);
    for (const t of [this.retryTimer, this.slowTimer, this.cacheTimer, this.queueTimer]) if (t) clearTimeout(t);
  }

  /** Removes this account's cached data and unsent changes from the device. */
  async clearLocal() {
    try { localStorage.removeItem(this.queueKey); } catch { /* ignore */ }
    try { await idbDel(this.cacheKey); } catch { /* ignore */ }
  }

  private onFocus = () => { void this.sync(); };
  private onVisible = () => { if (document.visibilityState === 'visible') void this.sync(); };
  private onOnline = () => {
    this.setOffline(false);
    if (this.retryTimer) { clearTimeout(this.retryTimer); this.retryTimer = null; }
    this.backoff = 0;
    this.pump();
    void this.sync(true);
  };
  private onOffline = () => this.setOffline(true);

  private setOffline(v: boolean) {
    if (this.offline === v) return;
    this.offline = v;
    this.ev?.onOffline?.(v);
  }

  private markReady() {
    if (this.ready) return;
    this.ready = true;
    if (this.slowTimer) clearTimeout(this.slowTimer);
    this.ev.onReady(!!this.data.meta);
  }

  private emitAll() {
    if (this.data.meta) this.ev.onChanges('meta', [{ id: 'meta', data: this.data.meta }]);
    for (const col of COLS) {
      const ch = Object.entries(this.data[col]).map(([id, data]) => ({ id, data }));
      if (ch.length) this.ev.onChanges(col, ch);
    }
  }

  // -------------------------------------------------------------------------------------------
  // reading

  sync(force = false): Promise<void> {
    if (this.stopped) return Promise.resolve();
    if (this.syncing) return this.syncing;
    if (!force && Date.now() - this.lastSync < SYNC_THROTTLE_MS) return Promise.resolve();
    this.syncing = this.doSync().finally(() => { this.syncing = null; this.lastSync = Date.now(); });
    return this.syncing;
  }

  private async fetchAll(table: Table | 'deletions', since: string | null): Promise<any[]> {
    const tsCol = table === 'deletions' ? 'deleted_at' : 'synced_at';
    const out: any[] = [];
    for (let from = 0; ; from += PAGE) {
      let q = this.sb.from(table).select('*').eq('user_id', this.uid);
      if (since) q = q.gt(tsCol, since);
      q = table === 'user_meta' ? q : table === 'deletions' ? q.order('tbl').order('id') : q.order('id');
      const { data, error, status } = await q.range(from, from + PAGE - 1);
      if (error) throw Object.assign(new Error(error.message), { code: error.code, status });
      out.push(...(data ?? []));
      if (!data || data.length < PAGE) return out;
    }
  }

  private async doSync() {
    const started = performance.now();
    const full = !this.since;
    const sinceIso = this.since ? new Date(Date.parse(this.since) - OVERLAP_MS).toISOString() : null;
    let meta: any[], rows: any[][], deletions: any[];
    try {
      [meta, rows, deletions] = await Promise.all([
        this.fetchAll('user_meta', sinceIso),
        Promise.all(DATA_TABLES.map(t => this.fetchAll(t, sinceIso))),
        sinceIso ? this.fetchAll('deletions', sinceIso) : Promise.resolve([]),
      ]);
    } catch (e: any) {
      if (this.stopped) return;
      const kind = classify(e, e?.status);
      if (kind === 'network') { this.setOffline(true); return; }
      this.ev.onError(e?.code === '42P01' || /does not exist|schema cache/i.test(String(e?.message))
        ? 'The RecodeX tables are missing in Supabase. Run supabase/migrations/20261107000000_init.sql in the SQL Editor, then reload.'
        : `Could not load your data (${e?.message ?? 'error'}). It keeps trying when you come back to the window.`);
      return;
    }
    if (this.stopped) return;
    this.setOffline(false);

    // Skip rows with a local change that is unsent, in flight, or made after this sync started.
    const skip = (key: string) => this.queue.has(key) || this.inflight.has(key) || (this.touched.get(key) ?? 0) > started;
    let maxSeen = this.since;

    if (meta[0]) {
      maxSeen = later(maxSeen, meta[0].synced_at);
      if (!skip('meta/meta')) { this.data.meta = fromRow('user_meta', meta[0]); this.ev.onChanges('meta', [{ id: 'meta', data: this.data.meta }]); }
    }

    DATA_TABLES.forEach((table, i) => {
      const col = COL_OF[table] as Col;
      const changes: Change[] = [];
      const seen = new Set<string>();
      for (const row of rows[i]) {
        maxSeen = later(maxSeen, row.synced_at);
        seen.add(row.id);
        if (skip(keyOf(col, row.id))) continue;
        const rec = fromRow(table, row);
        this.data[col][row.id] = rec;
        changes.push({ id: row.id, data: rec });
      }
      if (full) {
        for (const id of Object.keys(this.data[col])) {
          if (!seen.has(id) && !skip(keyOf(col, id))) { delete this.data[col][id]; changes.push({ id, data: null }); }
        }
      }
      if (changes.length) this.ev.onChanges(col, changes);
    });

    const removed = new Map<Col, Change[]>();
    for (const d of deletions) {
      maxSeen = later(maxSeen, d.deleted_at);
      const col = COL_OF[d.tbl as Table] as Col | undefined;
      if (!col || col === ('meta' as any) || skip(keyOf(col, d.id)) || !(d.id in this.data[col])) continue;
      delete this.data[col][d.id];
      removed.set(col, [...(removed.get(col) ?? []), { id: d.id, data: null }]);
    }
    for (const [col, ch] of removed) this.ev.onChanges(col, ch);

    this.since = maxSeen ?? new Date(0).toISOString();
    for (const [k, t] of this.touched) if (t <= started) this.touched.delete(k);
    this.markReady();
    this.saveCacheSoon();
  }

  // -------------------------------------------------------------------------------------------
  // writing

  put(col: Col, id: string, data: any) { this.enqueue(col, id, data); }
  remove(col: Col, id: string) { this.enqueue(col, id, null); }
  putMeta(data: any) { this.enqueue('meta', 'meta', data); }

  private enqueue(col: Col | 'meta', id: string, data: any | null) {
    const key = keyOf(col, id);
    const job: Job = { col, id, data: data === null ? null : JSON.parse(JSON.stringify(data)) };
    this.queue.delete(key);               // re-insert at the end so the newest change is sent last
    this.queue.set(key, job);
    this.touched.set(key, performance.now());
    this.applyLocal(job);
    this.saveQueueSoon();
    this.saveCacheSoon();
    this.schedulePump();
  }

  // Send after the current task, so a synchronous burst of writes (import, restore) is batched into chunks.
  private pumpScheduled = false;
  private schedulePump() {
    if (this.pumpScheduled) return;
    this.pumpScheduled = true;
    queueMicrotask(() => { this.pumpScheduled = false; this.pump(); });
  }

  private applyLocal(job: Job) {
    if (job.col === 'meta') this.data.meta = job.data;
    else if (job.data === null) delete this.data[job.col][job.id];
    else this.data[job.col][job.id] = job.data;
  }

  private count() { return this.queue.size + this.inflight.size; }

  private nextBatch(): Batch | null {
    let first: [string, Job] | null = null;
    for (const entry of this.queue) if (!this.inflight.has(entry[0])) { first = entry; break; }
    if (!first) return null;
    const [, head] = first;
    const op: Batch['op'] = head.data === null ? 'del' : 'put';
    const table = TABLE_OF[head.col];
    const picked: [string, Job][] = [first];
    if (!head.solo && head.col !== 'meta') {
      for (const entry of this.queue) {
        if (picked.length >= (op === 'del' ? DEL_CHUNK : CHUNK)) break;
        const [k, j] = entry;
        if (entry === first || j.solo || j.col !== head.col || (j.data === null) !== (op === 'del') || this.inflight.has(k)) continue;
        picked.push(entry);
      }
    }
    for (const [k, j] of picked) { this.queue.delete(k); this.inflight.set(k, j); }
    return { table, op, jobs: picked.map(([, j]) => j) };
  }

  private pump() {
    if (this.stopped) return;
    this.ev?.onPending(this.count());
    if (this.retryTimer || (this.offline && navigator.onLine === false)) return;
    while (this.inflightBatches < MAX_INFLIGHT) {
      const batch = this.nextBatch();
      if (!batch) break;
      this.inflightBatches++;
      void this.runBatch(batch).finally(() => {
        this.inflightBatches--;
        this.saveQueueSoon();
        this.pump();
        if (this.count() === 0) { const w = this.waiters; this.waiters = []; w.forEach(f => f()); }
      });
    }
  }

  private async runBatch(b: Batch) {
    let error: any = null, status: number | undefined;
    try {
      if (b.op === 'put') {
        const rows = b.jobs.map(j => toRow(b.table, j.data, this.uid));
        ({ error, status } = await this.sb.from(b.table).upsert(rows, { onConflict: b.table === 'user_meta' ? 'user_id' : 'user_id,id' }));
      } else {
        ({ error, status } = await this.sb.from(b.table).delete().eq('user_id', this.uid).in('id', b.jobs.map(j => j.id)));
      }
    } catch (e) { error = e; status = 0; }

    const keys = b.jobs.map(j => keyOf(j.col, j.id));
    keys.forEach(k => this.inflight.delete(k));
    if (!error) {
      this.backoff = 0;
      this.setOffline(false);
      return;
    }
    if (this.stopped) { this.requeue(b.jobs); return; }
    const kind = classify(error, status);
    if (kind !== 'fatal') {
      if (kind === 'network') this.setOffline(true);
      this.requeue(b.jobs);
      this.scheduleRetry();
      return;
    }
    if (b.jobs.length > 1) {
      // One bad row should not sink a whole chunk: resend the chunk one row at a time.
      this.requeue(b.jobs.map(j => ({ ...j, solo: true })));
      return;
    }
    this.since = null; // the cache now holds a change the server rejected: reload everything next time
    this.ev.onError(`A change could not be saved (${error?.message ?? 'error'}). It is still shown here; reload to see what is stored.`);
  }

  private requeue(jobs: Job[]) {
    for (const j of jobs) { const k = keyOf(j.col, j.id); if (!this.queue.has(k)) this.queue.set(k, j); }
  }

  private scheduleRetry() {
    if (this.retryTimer) return;
    this.backoff = Math.min(this.backoff ? this.backoff * 2 : 1000, 60_000);
    this.retryTimer = setTimeout(() => { this.retryTimer = null; this.pump(); }, this.backoff + Math.random() * 500);
  }

  flushed() { return this.count() === 0 ? Promise.resolve() : new Promise<void>(r => this.waiters.push(r)); }

  // -------------------------------------------------------------------------------------------
  // persistence on this device

  private loadQueue() {
    try {
      const raw = localStorage.getItem(this.queueKey);
      if (!raw) return;
      for (const j of JSON.parse(raw) as Job[]) this.queue.set(keyOf(j.col, j.id), j);
    } catch { /* corrupt or blocked: nothing to resend */ }
  }

  private saveQueue() {
    try {
      const jobs = [...this.inflight.values(), ...this.queue.values()];
      if (jobs.length) localStorage.setItem(this.queueKey, JSON.stringify(jobs));
      else localStorage.removeItem(this.queueKey);
    } catch {
      this.ev?.onError('Unsent changes could not be stored on this device (storage is full or blocked). Stay online until "All changes saved" shows.');
    }
  }

  private saveQueueSoon() {
    if (this.queueTimer) clearTimeout(this.queueTimer);
    this.queueTimer = setTimeout(() => { this.queueTimer = null; this.saveQueue(); }, 150);
  }

  private saveCacheSoon() {
    if (this.stopped) return;
    if (this.cacheTimer) clearTimeout(this.cacheTimer);
    this.cacheTimer = setTimeout(() => { this.cacheTimer = null; void this.saveCache(); }, 1500);
  }

  private async saveCache() {
    const c: CacheShape = { v: 1, since: this.since, ...this.data };
    try { await idbSet(this.cacheKey, c); } catch { /* cache is an optimisation only */ }
  }

  private persistNow = () => {
    if (this.stopped) return;
    if (this.queueTimer) { clearTimeout(this.queueTimer); this.queueTimer = null; }
    this.saveQueue();
    if (this.cacheTimer) { clearTimeout(this.cacheTimer); this.cacheTimer = null; void this.saveCache(); }
  };
}
