import { describe, expect, it } from 'vitest';
import type { Pattern, Problem } from '../types';
import { parseCsv, csvToRows, problemsToCsv, CSV_HEADERS, CSV_TEMPLATE } from './csv';

describe('parseCsv', () => {
  it('splits simple rows and cells', () => {
    expect(parseCsv('a,b,c\n1,2,3')).toEqual([['a', 'b', 'c'], ['1', '2', '3']]);
  });

  it('handles quoted cells with commas, escaped quotes and newlines', () => {
    expect(parseCsv('name,notes\n"Two Sum, II","say ""hi""\nsecond line"\n')).toEqual([
      ['name', 'notes'], ['Two Sum, II', 'say "hi"\nsecond line'],
    ]);
  });

  it('accepts CRLF and CR line endings and strips a BOM', () => {
    expect(parseCsv('﻿a,b\r\n1,2\r3,4')).toEqual([['a', 'b'], ['1', '2'], ['3', '4']]);
  });

  it('skips blank lines but keeps empty cells', () => {
    expect(parseCsv('a,b\n\n , \n1,\n')).toEqual([['a', 'b'], ['1', '']]);
  });
});

describe('csvToRows', () => {
  it('requires a header and at least one row', () => {
    expect(csvToRows('name,pattern').errors[0]).toMatch(/header row/);
  });

  it('requires name and pattern columns', () => {
    expect(csvToRows('title,topic\nx,y').errors).toEqual(['Columns "name" and "pattern" are required.']);
  });

  it('parses the template and normalises enums', () => {
    const { rows, errors } = csvToRows(CSV_TEMPLATE);
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      name: 'Container With Most Water', pattern: 'Two Pointers', subPattern: 'Pair Sum', difficulty: 'Medium',
      priority: 'Medium', track: 'active', rating: null, lastRevised: null, nextReview: null, phase: null,
    });
  });

  it('accepts header aliases, mixed case and spaces in headers', () => {
    const { rows } = csvToRows('Problem Name,Pattern,Diff,Link,Rating,Last Revised Date,Next Review Date,Revision Phase,Main Weakness\n' +
      'Two Sum,Arrays,easy,https://x,GREEN,2026-11-01,2026-11-08,quick recall,none');
    expect(rows[0]).toMatchObject({
      name: 'Two Sum', pattern: 'Arrays', difficulty: 'Easy', url: 'https://x', rating: 'green',
      lastRevised: '2026-11-01', nextReview: '2026-11-08', phase: 'Quick Recall', weakness: 'none',
    });
  });

  it('falls back to defaults for unknown values', () => {
    const { rows } = csvToRows('name,pattern,difficulty,priority,track\nA,P,insane,urgent,whatever');
    expect(rows[0]).toMatchObject({ difficulty: 'Medium', priority: 'Medium', track: 'active' });
    expect(csvToRows('name,pattern,track\nA,P,Backlog').rows[0].track).toBe('backlog');
  });

  it('skips rows without a name or pattern and reports them by line number', () => {
    const { rows, errors } = csvToRows('name,pattern\nA,P\n,P\nB,');
    expect(rows.map(r => r.name)).toEqual(['A']);
    expect(errors).toEqual(['Row 3: missing name or pattern, skipped.', 'Row 4: missing name or pattern, skipped.']);
  });

  it('drops a rating without a valid last_revised date and reports bad dates', () => {
    const { rows, errors } = csvToRows('name,pattern,last_rating,last_revised,next_review\nA,P,red,07/11/2026,2026-11-08\nB,P,red,,');
    expect(rows[0]).toMatchObject({ rating: null, lastRevised: null }); // importRows ignores next_review without a rating
    expect(rows[1]).toMatchObject({ rating: null });
    expect(errors).toEqual(['Row 2: last_revised "07/11/2026" is not YYYY-MM-DD, ignored.']);
  });

  it('keeps dates exactly as written (no time-zone shift)', () => {
    const { rows } = csvToRows('name,pattern,last_rating,last_revised,next_review\nA,P,yellow,2026-12-31,2027-01-03');
    expect(rows[0].lastRevised).toBe('2026-12-31');
    expect(rows[0].nextReview).toBe('2027-01-03');
  });

  it('parses numeric streak and revision counts, treating junk as 0', () => {
    const { rows } = csvToRows('name,pattern,consecutive_green,revision_count\nA,P,3,7\nB,P,x,\n');
    expect([rows[0].consecutiveGreen, rows[0].revisionCount]).toEqual([3, 7]);
    expect([rows[1].consecutiveGreen, rows[1].revisionCount]).toEqual([0, null]);
  });
});

describe('problemsToCsv round trip', () => {
  const pt: Pattern = { id: 'pt-a', name: 'Sliding Window', order: 1, subPatterns: [], learning: 'active', description: '', createdAt: '' };
  const p: Problem = {
    id: 'p-101', num: 101, name: 'Max "Sum", Subarray', patternId: 'pt-a', subPattern: 'Fixed', difficulty: 'Hard',
    url: 'https://leetcode.com/problems/x/', priority: 'High', track: 'active', lastRating: 'red', lastRevised: '2026-11-06',
    nextReview: '2026-11-07', phase: 'Reconstruction', phaseManual: false, consecutiveGreen: 0, revisionCount: 2,
    weakness: 'window shrink', notes: 'line one\nline two', learnedAt: null, createdAt: '', updatedAt: '',
  };

  it('writes the documented header and escapes awkward cells', () => {
    const csv = problemsToCsv([p], { 'pt-a': pt }, () => 'Due Today', () => 'Repair');
    expect(csv.split('\n')[0]).toBe(CSV_HEADERS.join(','));
    expect(csv).toContain('"Max ""Sum"", Subarray"');
    expect(csv).toContain('"line one\nline two"');
  });

  it('an exported file imports back to the same fields', () => {
    const csv = problemsToCsv([p], { 'pt-a': pt }, () => 'Due Today', () => 'Repair');
    const { rows, errors } = csvToRows(csv);
    expect(errors).toEqual([]);
    expect(rows[0]).toEqual({
      name: p.name, pattern: 'Sliding Window', subPattern: 'Fixed', difficulty: 'Hard', url: p.url, priority: 'High',
      track: 'active', rating: 'red', lastRevised: '2026-11-06', nextReview: '2026-11-07', phase: 'Reconstruction',
      consecutiveGreen: 0, revisionCount: 2, weakness: 'window shrink', notes: 'line one\nline two',
    });
  });
});
