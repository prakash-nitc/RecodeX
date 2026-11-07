// The one place where app records (camelCase, src/types.ts) are mapped to table rows (snake_case).
import type { Col } from '../backend';

export type Table = 'patterns' | 'problems' | 'revisions' | 'practice_sessions' | 'user_meta';
export const TABLE_OF: Record<Col | 'meta', Table> = {
  patterns: 'patterns', problems: 'problems', revisions: 'revisions', sessions: 'practice_sessions', meta: 'user_meta',
};
export const COL_OF: Record<Table, Col | 'meta'> = {
  patterns: 'patterns', problems: 'problems', revisions: 'revisions', practice_sessions: 'sessions', user_meta: 'meta',
};

// kind: 'ts' = timestamptz (normalised to toISOString), 'int' = integer column, 'opt' = optional field omitted when null.
type Kind = 'plain' | 'ts' | 'int' | 'opt';
type Field = [camel: string, snake: string, kind?: Kind, fallback?: unknown];

const FIELDS: Record<Table, Field[]> = {
  user_meta: [
    ['settings', 'settings', 'plain', {}], ['nextNum', 'next_num', 'int', 101], ['importedAt', 'imported_at', 'ts', null],
    ['schemaVersion', 'schema_version', 'int', 1],
  ],
  patterns: [
    ['id', 'id'], ['name', 'name', 'plain', ''], ['order', 'sort_order', 'plain', 0], ['subPatterns', 'sub_patterns', 'plain', []],
    ['learning', 'learning', 'plain', 'active'], ['description', 'description', 'plain', ''], ['createdAt', 'created_at', 'ts'],
  ],
  problems: [
    ['id', 'id'], ['num', 'num', 'int', 0], ['name', 'name', 'plain', ''], ['patternId', 'pattern_id', 'plain', ''],
    ['subPattern', 'sub_pattern', 'plain', ''], ['difficulty', 'difficulty', 'plain', 'Medium'], ['url', 'url', 'plain', ''],
    ['priority', 'priority', 'plain', 'Medium'], ['track', 'track', 'plain', 'active'], ['lastRating', 'last_rating', 'plain', null],
    ['lastRevised', 'last_revised', 'plain', null], ['nextReview', 'next_review', 'plain', null],
    ['phase', 'phase', 'plain', 'Reconstruction'], ['phaseManual', 'phase_manual', 'plain', false],
    ['consecutiveGreen', 'consecutive_green', 'int', 0], ['revisionCount', 'revision_count', 'int', 0],
    ['weakness', 'weakness', 'plain', ''], ['notes', 'notes', 'plain', ''], ['learnedAt', 'learned_at', 'plain', null],
    ['importedName', 'imported_name', 'opt', null], ['createdAt', 'created_at', 'ts'], ['updatedAt', 'updated_at', 'ts'],
  ],
  revisions: [
    ['id', 'id'], ['problemId', 'problem_id', 'plain', ''], ['date', 'revised_on'], ['at', 'revised_at', 'ts'],
    ['rating', 'rating'], ['phase', 'phase', 'plain', 'Reconstruction'], ['timeMin', 'time_min', 'plain', null],
    ['independent', 'independent', 'plain', null], ['mistake', 'mistake', 'plain', ''], ['notes', 'notes', 'plain', ''],
    ['sessionId', 'session_id', 'plain', null], ['source', 'source', 'plain', 'quick'], ['nextReview', 'next_review'],
    ['prev', 'prev_state', 'plain', null],
  ],
  practice_sessions: [
    ['id', 'id'], ['kind', 'kind', 'plain', 'custom'], ['title', 'title', 'plain', ''], ['config', 'config', 'plain', null],
    ['problemIds', 'problem_ids', 'plain', []], ['results', 'results', 'plain', []], ['index', 'position', 'int', 0],
    ['startedAt', 'started_at', 'ts'], ['endedAt', 'ended_at', 'ts', null], ['status', 'status', 'plain', 'in_progress'],
    ['elapsedSec', 'elapsed_sec', 'int', 0],
  ],
};

const isoTs = (v: unknown) => {
  if (v === null || v === undefined || v === '') return null;
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? String(v) : d.toISOString();
};

/** App record → row for upsert. Missing fields get the column default so old backups still load. */
export function toRow(table: Table, rec: any, userId: string): Record<string, unknown> {
  const row: Record<string, unknown> = { user_id: userId };
  for (const [camel, snake, kind = 'plain', fallback] of FIELDS[table]) {
    let v = rec?.[camel];
    if (v === undefined) {
      if (fallback === undefined) {
        if (kind === 'ts') continue;           // let the column default (now()) fill it
        v = null;
      } else v = fallback;
    }
    if (kind === 'int' && typeof v === 'number') v = Math.round(v);
    row[snake] = v;
  }
  return row;
}

/** Row from Postgres → app record. Timestamps are normalised so string comparisons of `at` keep working. */
export function fromRow(table: Table, row: any): any {
  const rec: Record<string, unknown> = {};
  for (const [camel, snake, kind = 'plain'] of FIELDS[table]) {
    const v = row[snake];
    if (kind === 'ts') rec[camel] = isoTs(v);
    else if (kind === 'opt') { if (v !== null && v !== undefined) rec[camel] = v; }
    else rec[camel] = v === undefined ? null : v;
  }
  return rec;
}
