// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import { SupabaseBackend } from './backend';
import type { BackendEvents, Change, Col } from '../backend';

// ---------------------------------------------------------------------------------------------
// A tiny in-memory stand-in for the parts of supabase-js the backend uses.

type Err = { status: number; error: { message: string; code?: string } };
class FakeDb {
  tables: Record<string, Map<string, any>> = {
    user_meta: new Map(), patterns: new Map(), problems: new Map(), revisions: new Map(), practice_sessions: new Map(), deletions: new Map(),
  };
  clock = 0;
  failNext = 0;
  failWith: Err = { status: 0, error: { message: 'TypeError: Failed to fetch' } };
  rejectRow: ((row: any) => boolean) | null = null;
  writes: { table: string; op: 'upsert' | 'delete'; n: number }[] = [];
  now() { return new Date(Date.UTC(2026, 10, 7) + ++this.clock * 1000).toISOString(); }
  from(table: string) { return new FakeQuery(this, table); }
  /** What another device would do: write straight to the server. */
  serverPut(table: string, row: any) { this.tables[table].set(row.id, { ...row, synced_at: this.now() }); this.tables.deletions.delete(`${table}/${row.id}`); }
  serverDelete(table: string, id: string, uid: string) {
    this.tables[table].delete(id);
    this.tables.deletions.set(`${table}/${id}`, { user_id: uid, tbl: table, id, deleted_at: this.now() });
  }
}

class FakeQuery {
  private filters: ((r: any) => boolean)[] = [];
  private op: 'select' | 'upsert' | 'delete' = 'select';
  private rows: any[] = [];
  private rng: [number, number] = [0, Infinity];
  constructor(private db: FakeDb, private table: string) {}
  select() { return this; }
  eq(c: string, v: unknown) { this.filters.push(r => r[c] === v); return this; }
  gt(c: string, v: string) { this.filters.push(r => Date.parse(r[c]) > Date.parse(v)); return this; }
  in(c: string, vs: unknown[]) { this.filters.push(r => vs.includes(r[c])); return this; }
  order() { return this; }
  range(a: number, b: number) { this.rng = [a, b]; return this; }
  upsert(rows: any[]) { this.op = 'upsert'; this.rows = rows; return this; }
  delete() { this.op = 'delete'; return this; }
  then(res: (v: any) => any, rej?: (e: any) => any) { return Promise.resolve().then(() => this.exec()).then(res, rej); }
  private exec() {
    const db = this.db, t = db.tables[this.table];
    if (db.failNext > 0) { db.failNext--; return { data: null, ...db.failWith }; }
    if (this.op === 'select') {
      const all = [...t.values()].filter(r => this.filters.every(f => f(r))).sort((a, b) => String(a.id).localeCompare(String(b.id)));
      return { data: all.slice(this.rng[0], this.rng[1] + 1), error: null, status: 200 };
    }
    if (this.op === 'upsert') {
      if (db.rejectRow && this.rows.some(db.rejectRow)) return { data: null, status: 400, error: { message: 'violates check constraint', code: '23514' } };
      db.writes.push({ table: this.table, op: 'upsert', n: this.rows.length });
      for (const r of this.rows) {
        const id = this.table === 'user_meta' ? 'meta' : r.id;
        t.set(id, { ...r, ...(this.table === 'user_meta' ? { id: 'meta' } : {}), synced_at: db.now() });
        db.tables.deletions.delete(`${this.table}/${id}`);
      }
      return { data: null, error: null, status: 201 };
    }
    const doomed = [...t.values()].filter(r => this.filters.every(f => f(r)));
    db.writes.push({ table: this.table, op: 'delete', n: doomed.length });
    for (const r of doomed) db.serverDelete(this.table, r.id, r.user_id);
    return { data: null, error: null, status: 204 };
  }
}

// ---------------------------------------------------------------------------------------------

let n = 0;
function setup(db = new FakeDb(), uid = `user-${++n}`) {
  const mem: { meta: any } & Record<Col, Record<string, any>> = { meta: null, patterns: {}, problems: {}, revisions: {}, sessions: {} };
  const ev = {
    ready: null as boolean | null, errors: [] as string[], offline: false, pending: 0,
  };
  const events: BackendEvents = {
    onChanges(col, changes: Change[]) {
      if (col === 'meta') { mem.meta = changes[0].data; return; }
      for (const c of changes) { if (c.data === null) delete mem[col][c.id]; else mem[col][c.id] = c.data; }
    },
    onReady(h) { ev.ready = h; },
    onSlow() {},
    onError(m) { ev.errors.push(m); },
    onPending(p) { ev.pending = p; },
    onOffline(o) { ev.offline = o; },
  };
  const b = new SupabaseBackend(db as any, uid);
  b.start(events);
  return { db, uid, b, mem, ev };
}
const until = (cond: () => boolean, ms = 8000) => vi.waitFor(() => { if (!cond()) throw new Error('not yet'); }, { timeout: ms, interval: 10 });
const prob = (id: string, extra: any = {}) => ({ id, num: Number(id.slice(2)) || 1, name: `P ${id}`, patternId: 'pt-a', createdAt: '2026-11-01T00:00:00.000Z', updatedAt: '2026-11-01T00:00:00.000Z', ...extra });

describe('SupabaseBackend', () => {
  it('reports an empty account as ready without meta', async () => {
    const { ev } = setup();
    await until(() => ev.ready !== null);
    expect(ev.ready).toBe(false);
  });

  it('loads existing rows on first open', async () => {
    const db = new FakeDb();
    db.tables.user_meta.set('meta', { id: 'meta', user_id: 'u', settings: {}, next_num: 102, imported_at: '2026-11-01T00:00:00Z', schema_version: 1, synced_at: db.now() });
    db.serverPut('problems', { user_id: 'u', id: 'p-101', num: 101, name: 'Two Sum', pattern_id: 'pt-a', last_revised: '2026-11-06', created_at: '2026-11-01T00:00:00+00:00', updated_at: '2026-11-01T00:00:00+00:00' });
    const { ev, mem } = setup(db, 'u');
    await until(() => ev.ready !== null);
    expect(ev.ready).toBe(true);
    expect(mem.meta.nextNum).toBe(102);
    expect(mem.problems['p-101']).toMatchObject({ name: 'Two Sum', lastRevised: '2026-11-06', createdAt: '2026-11-01T00:00:00.000Z' });
  });

  it('sends bulk work in chunks and coalesces repeated writes to one row', async () => {
    const { b, db, ev } = setup();
    await until(() => ev.ready !== null);
    for (let i = 0; i < 1200; i++) b.put('problems', `p-${i}`, prob(`p-${i}`));
    for (let i = 0; i < 5; i++) b.put('problems', 'p-7', prob('p-7', { name: `v${i}` }));
    await b.flushed();
    expect(db.tables.problems.size).toBe(1200);
    expect(db.tables.problems.get('p-7').name).toBe('v4');
    const ups = db.writes.filter(w => w.table === 'problems' && w.op === 'upsert');
    expect(ups.length).toBeLessThanOrEqual(4);
    expect(Math.max(...ups.map(u => u.n))).toBeLessThanOrEqual(500);
    expect(ev.pending).toBe(0);
  });

  it('uses the queued record id when its embedded id is stale', async () => {
    const { b, db, ev } = setup();
    await until(() => ev.ready !== null);
    b.put('problems', 'p-1', prob('p-1', { name: 'First' }));
    // This can happen when a caller reuses a record object after changing its key.
    // Postgres must receive unique conflict keys for this bulk upsert.
    b.put('problems', 'p-2', prob('p-1', { name: 'Second' }));
    await b.flushed();
    expect([...db.tables.problems.keys()].sort()).toEqual(['p-1', 'p-2']);
    expect(db.tables.problems.get('p-2').name).toBe('Second');
  });

  it('deletes in chunks and records deletions', async () => {
    const { b, db, ev } = setup();
    await until(() => ev.ready !== null);
    for (let i = 0; i < 250; i++) b.put('revisions', `r-${i}`, { id: `r-${i}`, problemId: 'p-1', date: '2026-11-07', at: '2026-11-07T00:00:00.000Z', rating: 'green', nextReview: '2026-11-14' });
    await b.flushed();
    for (let i = 0; i < 250; i++) b.remove('revisions', `r-${i}`);
    await b.flushed();
    expect(db.tables.revisions.size).toBe(0);
    expect(db.tables.deletions.size).toBe(250);
    expect(db.writes.filter(w => w.op === 'delete').every(w => w.n <= 100)).toBe(true);
  });

  it('keeps writes while offline and retries them', async () => {
    const { b, db, ev } = setup();
    await until(() => ev.ready !== null);
    db.failNext = 1;
    b.put('problems', 'p-1', prob('p-1'));
    await until(() => ev.offline === true);
    expect(db.tables.problems.size).toBe(0);
    await b.flushed();
    expect(db.tables.problems.get('p-1')).toBeTruthy();
    expect(ev.offline).toBe(false);
    expect(ev.errors).toEqual([]);
  });

  it('resends a rejected chunk row by row so only the bad row is lost', async () => {
    const { b, db, ev } = setup();
    await until(() => ev.ready !== null);
    db.rejectRow = r => r.name === 'BAD';
    b.put('problems', 'p-1', prob('p-1'));
    b.put('problems', 'p-2', prob('p-2', { name: 'BAD' }));
    b.put('problems', 'p-3', prob('p-3'));
    await b.flushed();
    expect([...db.tables.problems.keys()].sort()).toEqual(['p-1', 'p-3']);
    expect(ev.errors).toHaveLength(1);
  });

  it('persists unsent changes and the cache, and resumes after a restart', async () => {
    const db = new FakeDb();
    const first = setup(db, 'persist');
    await until(() => first.ev.ready !== null);
    first.b.put('problems', 'p-9', prob('p-9'));
    await first.b.flushed();
    db.failNext = 1000;
    first.b.put('problems', 'p-10', prob('p-10'));
    await until(() => first.ev.offline);
    first.b.stop();
    await new Promise(r => setTimeout(r, 50));

    db.failNext = 0;
    const second = setup(db, 'persist');
    await until(() => second.ev.ready !== null);
    expect(Object.keys(second.mem.problems).sort()).toEqual(['p-10', 'p-9']);
    await second.b.flushed();
    expect(db.tables.problems.has('p-10')).toBe(true);
  });

  it('picks up changes and deletions made on another device', async () => {
    const { b, db, ev, mem, uid } = setup();
    await until(() => ev.ready !== null);
    b.put('problems', 'p-1', prob('p-1'));
    b.put('problems', 'p-2', prob('p-2'));
    await b.flushed();
    await b.sync(true);
    db.serverPut('problems', { ...db.tables.problems.get('p-1'), name: 'renamed elsewhere' });
    db.serverDelete('problems', 'p-2', uid);
    await b.sync(true);
    expect(mem.problems['p-1'].name).toBe('renamed elsewhere');
    expect(mem.problems['p-2']).toBeUndefined();
  });

  it('does not overwrite a local change that has not reached the server yet', async () => {
    const { b, db, ev, mem } = setup();
    await until(() => ev.ready !== null);
    b.put('problems', 'p-1', prob('p-1', { name: 'v1' }));
    await b.flushed();
    db.serverPut('problems', { ...db.tables.problems.get('p-1'), name: 'other device' });
    db.failNext = 1;
    b.put('problems', 'p-1', prob('p-1', { name: 'mine' }));
    mem.problems['p-1'] = prob('p-1', { name: 'mine' });  // the store applies writes optimistically
    await b.sync(true);
    expect(mem.problems['p-1'].name).toBe('mine');
    await b.flushed();
    expect(db.tables.problems.get('p-1').name).toBe('mine');
  });
});
