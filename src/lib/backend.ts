// Persistence layer. Two interchangeable backends behind one interface:
//  - CloudBackend: the artifact's private per-user document database (survives reloads, devices, republishes).
//  - LocalBackend: browser localStorage, used when the cloud store is not available in this view.
// A Supabase backend can implement the same interface later (see schema.sql).

export type Col = 'patterns' | 'problems' | 'revisions' | 'sessions';
export const COLS: Col[] = ['patterns', 'problems', 'revisions', 'sessions'];
export type Change = { id: string; data: any | null };

export interface BackendEvents {
  onChanges(col: Col | 'meta', changes: Change[]): void;
  onReady(hasMeta: boolean): void;
  onSlow(): void;
  onError(message: string): void;
  onPending(n: number): void;
}

export interface Backend {
  kind: 'cloud' | 'local';
  start(ev: BackendEvents): void;
  put(col: Col, id: string, data: any): void;
  remove(col: Col, id: string): void;
  putMeta(data: any): void;
  flushed(): Promise<void>;
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// ---------------------------------------------------------------------------------------------

export class CloudBackend implements Backend {
  kind = 'cloud' as const;
  private root: any;
  private queue = new Map<string, { col: Col | 'meta'; id: string; data: any | null }>();
  private inflight = new Set<string>();
  private ev!: BackendEvents;
  private waiters: (() => void)[] = [];

  constructor(private db: any, uid: string) {
    this.root = db.doc(`data/users/${uid}/app`);
  }

  start(ev: BackendEvents) {
    this.ev = ev;
    let metaDone = false;
    const colDone = new Set<string>();
    let readyFired = false;
    let hasMeta = false;
    const check = () => {
      if (!readyFired && metaDone && colDone.size === COLS.length) { readyFired = true; clearTimeout(slow); ev.onReady(hasMeta); }
    };
    const slow = setTimeout(() => { if (!readyFired) ev.onSlow(); }, 10000);
    this.root.onSnapshot((snap: any) => {
      hasMeta = snap.exists;
      ev.onChanges('meta', [{ id: 'meta', data: snap.exists ? snap.data() : null }]);
      if (!snap.metadata.fromCache) { metaDone = true; check(); }
    }, (e: any) => ev.onError(`Could not load your data (${e.code}). Reload the page to try again.`));
    for (const col of COLS) {
      this.root.collection(col).onSnapshot((snap: any) => {
        const changes: Change[] = snap.docChanges().map((c: any) => ({ id: c.doc.id, data: c.type === 'removed' ? null : c.doc.data() }));
        if (changes.length) ev.onChanges(col, changes);
        if (!snap.metadata.fromCache) { colDone.add(col); check(); }
      }, (e: any) => ev.onError(`Could not load ${col} (${e.code}). Reload the page to try again.`));
    }
  }

  private ref(col: Col | 'meta', id: string) {
    return col === 'meta' ? this.root : this.root.collection(col).doc(id);
  }
  put(col: Col, id: string, data: any) { this.enqueue(col, id, data); }
  remove(col: Col, id: string) { this.enqueue(col, id, null); }
  putMeta(data: any) { this.enqueue('meta', 'meta', data); }

  private enqueue(col: Col | 'meta', id: string, data: any | null) {
    this.queue.set(`${col}/${id}`, { col, id, data: data === null ? null : JSON.parse(JSON.stringify(data)) });
    this.pump();
  }
  private count() { return this.queue.size + this.inflight.size; }
  private pump() {
    this.ev?.onPending(this.count());
    for (const [key, job] of this.queue) {
      if (this.inflight.size >= 4) break;
      if (this.inflight.has(key)) continue;   // one write at a time per document
      this.queue.delete(key);
      this.inflight.add(key);
      this.run(job).finally(() => {
        this.inflight.delete(key);
        this.pump();
        if (this.count() === 0) { const w = this.waiters; this.waiters = []; w.forEach(f => f()); }
      });
    }
  }
  private async run(job: { col: Col | 'meta'; id: string; data: any | null }) {
    for (let attempt = 0; attempt < 7; attempt++) {
      try {
        const r = this.ref(job.col, job.id);
        if (job.data === null) await r.delete(); else await r.set(job.data);
        return;
      } catch (e: any) {
        const code = e?.code;
        if ((code === 'unavailable' || code === 'resource_exhausted') && attempt < 6) {
          await sleep(300 * 2 ** attempt + Math.random() * 300);
          continue;
        }
        this.ev?.onError(code === 'quota_exceeded'
          ? 'Storage is full. Delete old sessions or problems, or export a backup and reset.'
          : `A change could not be saved (${code ?? 'error'}). It is still shown here; reload to see what is stored.`);
        return;
      }
    }
  }
  flushed() { return this.count() === 0 ? Promise.resolve() : new Promise<void>(r => this.waiters.push(r)); }
}

// ---------------------------------------------------------------------------------------------

const LS_KEY = 'dsa-revision-manager-v1';

export class LocalBackend implements Backend {
  kind = 'local' as const;
  private data: { meta: any | null } & Record<Col, Record<string, any>> = { meta: null, patterns: {}, problems: {}, revisions: {}, sessions: {} };
  private timer: any = null;
  private ev!: BackendEvents;

  start(ev: BackendEvents) {
    this.ev = ev;
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) this.data = { ...this.data, ...JSON.parse(raw) };
    } catch { /* storage blocked: keep in memory */ }
    if (this.data.meta) ev.onChanges('meta', [{ id: 'meta', data: this.data.meta }]);
    for (const col of COLS) {
      const ch = Object.entries(this.data[col]).map(([id, data]) => ({ id, data }));
      if (ch.length) ev.onChanges(col, ch);
    }
    setTimeout(() => ev.onReady(!!this.data.meta), 0);
  }
  private save() {
    clearTimeout(this.timer);
    this.ev?.onPending(1);
    this.timer = setTimeout(() => {
      try { localStorage.setItem(LS_KEY, JSON.stringify(this.data)); }
      catch { this.ev?.onError('This browser blocked local storage, so changes last only until you close the page. Export a backup to keep them.'); }
      this.ev?.onPending(0);
    }, 250);
  }
  put(col: Col, id: string, data: any) { this.data[col][id] = data; this.save(); }
  remove(col: Col, id: string) { delete this.data[col][id]; this.save(); }
  putMeta(data: any) { this.data.meta = data; this.save(); }
  flushed() { return new Promise<void>(r => setTimeout(r, 300)); }
}

export async function createBackend(): Promise<Backend> {
  try {
    const c = (window as any).claude;
    if (c?.use) {
      const [db, user] = await Promise.all([c.use('db'), c.use('user')]);
      const uid = user ? await user.id() : null;
      if (db && uid) return new CloudBackend(db, uid);
    }
  } catch { /* fall through */ }
  return new LocalBackend();
}

export async function getDownloads(): Promise<any | null> {
  try { const c = (window as any).claude; return c?.use ? await c.use('downloads') : null; } catch { return null; }
}
