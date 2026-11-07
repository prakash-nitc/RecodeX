import type { Problem, Pattern, Rating, Phase, Difficulty, Priority } from '../types';
import type { ImportRow } from './store';
import { isValidYmd } from './dates';

export function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cell = ''; let q = false;
  const t = text.replace(/^﻿/, '');
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (q) {
      if (ch === '"') { if (t[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && t[i + 1] === '\n') i++;
      row.push(cell); cell = ''; if (row.some(c => c.trim() !== '')) rows.push(row); row = [];
    } else cell += ch;
  }
  row.push(cell); if (row.some(c => c.trim() !== '')) rows.push(row);
  return rows;
}

const esc = (v: unknown) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const CSV_HEADERS = ['problem_id', 'name', 'pattern', 'sub_pattern', 'difficulty', 'url', 'priority', 'track', 'last_rating', 'last_revised', 'next_review', 'revision_type', 'phase', 'status', 'consecutive_green', 'revision_count', 'weakness', 'notes'];

export function problemsToCsv(problems: Problem[], patterns: Record<string, Pattern>, statusOf: (p: Problem) => string, typeOf: (p: Problem) => string): string {
  const lines = [CSV_HEADERS.join(',')];
  for (const p of problems) {
    lines.push([
      p.num, p.name, patterns[p.patternId]?.name ?? '', p.subPattern, p.difficulty, p.url, p.priority, p.track,
      p.lastRating ?? '', p.lastRevised ?? '', p.nextReview ?? '', typeOf(p), p.phase, statusOf(p), p.consecutiveGreen, p.revisionCount, p.weakness, p.notes,
    ].map(esc).join(','));
  }
  return lines.join('\n');
}

const pick = <T extends string>(v: string, opts: readonly T[], fallback: T): T => {
  const x = opts.find(o => o.toLowerCase() === v.trim().toLowerCase()); return x ?? fallback;
};

export interface CsvParseResult { rows: ImportRow[]; errors: string[]; }

export function csvToRows(text: string): CsvParseResult {
  const grid = parseCsv(text);
  const errors: string[] = [];
  if (grid.length < 2) return { rows: [], errors: ['The file needs a header row and at least one problem row.'] };
  const head = grid[0].map(h => h.trim().toLowerCase().replace(/[\s-]+/g, '_'));
  const col = (...names: string[]) => names.map(n => head.indexOf(n)).find(i => i >= 0) ?? -1;
  const ci = {
    name: col('name', 'problem_name', 'problem'), pattern: col('pattern'), sub: col('sub_pattern', 'subpattern'),
    diff: col('difficulty', 'diff'), url: col('url', 'link', 'problem_url'), pri: col('priority'), track: col('track'),
    rating: col('last_rating', 'rating'), lr: col('last_revised', 'last_revised_date'), nr: col('next_review', 'next_review_date'),
    phase: col('phase', 'revision_phase'), cg: col('consecutive_green', 'consecutive_green_reviews'), rc: col('revision_count', 'total_revision_count'),
    weak: col('weakness', 'main_weakness'), notes: col('notes', 'mistake_notes'),
  };
  if (ci.name < 0 || ci.pattern < 0) return { rows: [], errors: ['Columns "name" and "pattern" are required.'] };
  const rows: ImportRow[] = [];
  grid.slice(1).forEach((r, i) => {
    const g = (k: number) => (k >= 0 ? (r[k] ?? '').trim() : '');
    const name = g(ci.name), pattern = g(ci.pattern);
    if (!name || !pattern) { errors.push(`Row ${i + 2}: missing name or pattern, skipped.`); return; }
    const ratingRaw = g(ci.rating).toLowerCase();
    const rating = (['green', 'yellow', 'red'] as Rating[]).find(x => x === ratingRaw) ?? null;
    const lr = g(ci.lr), nr = g(ci.nr);
    if (lr && !isValidYmd(lr)) errors.push(`Row ${i + 2}: last_revised "${lr}" is not YYYY-MM-DD, ignored.`);
    if (nr && !isValidYmd(nr)) errors.push(`Row ${i + 2}: next_review "${nr}" is not YYYY-MM-DD, ignored.`);
    const phaseRaw = g(ci.phase);
    rows.push({
      name, pattern, subPattern: g(ci.sub),
      difficulty: pick<Difficulty>(g(ci.diff), ['Easy', 'Medium', 'Hard'], 'Medium'),
      url: g(ci.url), priority: pick<Priority>(g(ci.pri), ['High', 'Medium', 'Low'], 'Medium'),
      track: g(ci.track).toLowerCase() === 'backlog' ? 'backlog' : 'active',
      rating: rating && isValidYmd(lr) ? rating : null,
      lastRevised: rating && isValidYmd(lr) ? lr : null,
      nextReview: rating && isValidYmd(nr) ? nr : null,
      phase: (['Reconstruction', 'Recall/Repair', 'Quick Recall'] as Phase[]).find(p => p.toLowerCase() === phaseRaw.toLowerCase()) ?? null,
      consecutiveGreen: g(ci.cg) ? Number(g(ci.cg)) || 0 : null,
      revisionCount: g(ci.rc) ? Number(g(ci.rc)) || 0 : null,
      weakness: g(ci.weak), notes: g(ci.notes),
    });
  });
  return { rows, errors };
}

export const CSV_TEMPLATE = 'name,pattern,sub_pattern,difficulty,url,priority,track,last_rating,last_revised,next_review,phase,weakness,notes\n' +
  'Container With Most Water,Two Pointers,Pair Sum,Medium,https://leetcode.com/problems/container-with-most-water/,Medium,active,,,,,,\n';
