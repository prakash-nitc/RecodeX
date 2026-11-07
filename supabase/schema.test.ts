// Runs the migrations in PGlite (Postgres compiled to WASM) against a minimal stand-in for Supabase's
// auth schema and roles, then checks row-level security, sync bookkeeping and the app's row shapes.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { toRow } from '../src/lib/supabase/mapping';
import { DEFAULT_SETTINGS } from '../src/types';

const A = '11111111-1111-1111-1111-111111111111';
const B = '22222222-2222-2222-2222-222222222222';

const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  grant usage on schema public to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
`;

let db: PGlite;

/** Runs statements as a signed-in user, like PostgREST does with the user's JWT. */
async function as<T = any>(uid: string | null, sql: string, params: unknown[] = []): Promise<T[]> {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid ?? ''}', false); set role ${uid ? 'authenticated' : 'anon'};`);
  try { return (await db.query<T>(sql, params)).rows; } finally { await db.exec('reset role;'); }
}

const JSONB = new Set(['settings', 'config', 'results', 'prev_state']);

function upsertSql(table: string, row: Record<string, unknown>, conflict = 'user_id, id') {
  const cols = Object.keys(row);
  const vals = cols.map((_, i) => `$${i + 1}`);
  const updates = cols.filter(c => !conflict.includes(c)).map(c => `${c} = excluded.${c}`);
  return {
    sql: `insert into public.${table} (${cols.join(', ')}) values (${vals.join(', ')}) on conflict (${conflict}) do update set ${updates.join(', ')}`,
    params: cols.map(c => (JSONB.has(c) && row[c] !== null ? JSON.stringify(row[c]) : row[c])),
  };
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STUB);
  const dir = fileURLToPath(new URL('./migrations', import.meta.url));
  for (const f of readdirSync(dir).filter(f => f.endsWith('.sql')).sort()) await db.exec(readFileSync(join(dir, f), 'utf8'));
  await db.exec(`insert into auth.users (id) values ('${A}'), ('${B}');`);
}, 60_000);

const problem = (id: string, extra: object = {}) => toRow('problems', {
  id, num: 101, name: 'Two Sum', patternId: 'pt-a', subPattern: '', difficulty: 'Easy', url: '', priority: 'Low', track: 'active',
  lastRating: 'green', lastRevised: '2026-11-06', nextReview: '2026-11-13', phase: 'Quick Recall', phaseManual: false,
  consecutiveGreen: 1, revisionCount: 1, weakness: '', notes: '', learnedAt: null, createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z', ...extra,
}, A);

describe('Supabase schema', () => {
  it('accepts every app record shape', async () => {
    const rows: [string, Record<string, unknown>, string?][] = [
      ['user_meta', toRow('user_meta', { settings: DEFAULT_SETTINGS, nextNum: 102, importedAt: '2026-11-07T00:00:00.000Z', schemaVersion: 1 }, A), 'user_id'],
      ['patterns', toRow('patterns', { id: 'pt-a', name: 'Two Pointers', order: 1, subPatterns: ['Pair Sum'], learning: 'active', description: '', createdAt: '2026-11-01T00:00:00.000Z' }, A)],
      ['problems', problem('p-101')],
      ['revisions', toRow('revisions', { id: 'r-1', problemId: 'p-101', date: '2026-11-06', at: '2026-11-06T12:00:00.000Z', rating: 'green', phase: 'Quick Recall', timeMin: 12.5, independent: true, mistake: '', notes: '', sessionId: null, source: 'quick', nextReview: '2026-11-13', prev: { lastRating: null } }, A)],
      ['practice_sessions', toRow('practice_sessions', { id: 's-1', kind: 'daily', title: 'Daily', config: { count: 10 }, problemIds: ['p-101'], results: [{ problemId: 'p-101', outcome: 'rated', rating: 'green', timeSec: 60, revisionId: 'r-1' }], index: 1, startedAt: '2026-11-07T06:00:00.000Z', endedAt: null, status: 'in_progress', elapsedSec: 60 }, A)],
    ];
    for (const [table, row, conflict] of rows) {
      const { sql, params } = upsertSql(table, row, conflict);
      await as(A, sql, params);
    }
    const [p] = await as(A, `select next_review::text, last_revised::text, synced_at from public.problems where id = 'p-101'`);
    expect(p).toMatchObject({ next_review: '2026-11-13', last_revised: '2026-11-06' });
    expect(p.synced_at).toBeTruthy();
  });

  it('lets a user see and change only their own rows', async () => {
    const { sql, params } = upsertSql('problems', problem('p-101', { name: 'B version' }));
    await as(B, sql, params.map((v, i) => (i === 0 ? B : v)));
    expect((await as(A, `select name from public.problems where id = 'p-101'`))[0].name).toBe('Two Sum');
    expect((await as(B, `select name from public.problems where id = 'p-101'`))[0].name).toBe('B version');
    expect(await as(B, `select * from public.revisions`)).toEqual([]);
    // B cannot write a row that claims to be A's, nor touch A's rows.
    await expect(as(B, sql, params)).rejects.toThrow(/row-level security/);
    await as(B, `update public.problems set name = 'hacked' where user_id = '${A}'`);
    await as(B, `delete from public.problems where user_id = '${A}'`);
    expect((await as(A, `select name from public.problems where id = 'p-101'`))[0].name).toBe('Two Sum');
  });

  it('gives signed-out visitors nothing', async () => {
    await expect(as(null, `select * from public.problems`)).rejects.toThrow(/permission denied/);
  });

  it('bumps synced_at on update', async () => {
    const [before] = await as(A, `select synced_at from public.problems where id = 'p-101'`);
    await new Promise(r => setTimeout(r, 5));
    await as(A, `update public.problems set notes = 'n' where id = 'p-101'`);
    const [after] = await as(A, `select synced_at from public.problems where id = 'p-101'`);
    expect(new Date(after.synced_at).getTime()).toBeGreaterThan(new Date(before.synced_at).getTime());
  });

  it('records deletions for other devices and forgets them when the row comes back', async () => {
    await as(A, `delete from public.revisions where id = 'r-1'`);
    expect(await as(A, `select tbl, id from public.deletions`)).toEqual([{ tbl: 'revisions', id: 'r-1' }]);
    expect(await as(B, `select * from public.deletions`)).toEqual([]);
    await expect(as(A, `insert into public.deletions (user_id, tbl, id) values ('${A}', 'x', 'y')`)).rejects.toThrow(/permission denied/);
    const { sql, params } = upsertSql('revisions', toRow('revisions', { id: 'r-1', problemId: 'p-101', date: '2026-11-06', at: '2026-11-06T12:00:00.000Z', rating: 'red', phase: 'Reconstruction', source: 'quick', nextReview: '2026-11-07' }, A));
    await as(A, sql, params);
    expect(await as(A, `select * from public.deletions`)).toEqual([]);
  });

  it('rejects values outside the app enums', async () => {
    await expect(as(A, `update public.problems set last_rating = 'blue' where id = 'p-101'`)).rejects.toThrow(/check constraint/);
  });
});
