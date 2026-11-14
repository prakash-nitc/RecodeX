import { describe, expect, it } from 'vitest';
import {
  parseNote, parseInline, parseLine, plain, reflow, noteSummary, enterEdit, wrapEdit, bulletEdit, lineEdit, mistakeEdit, MISTAKE_TITLE,
  type Block, type Edit,
} from './notes';

type Section = Extract<Block, { type: 'section' }>;
type List = Extract<Block, { type: 'list' }>;
const run = (v: string, e: Edit) => v.slice(0, e.start) + e.text + v.slice(e.end);

const MISTAKES = [
  '**1. Confused the closest sum with the difference from the target**',
  '- Initially stored `target - sum` in the `closest` variable.',
  '- The problem asks us to return the actual sum of the three elements, not the difference.',
  '- **Prevention:** Maintain `bestSum` as the actual triplet sum. Use `Math.abs(target - sum)` only to compare candidates.',
  '',
  '**2. Ignored sums greater than the target**',
  '- Initially checked `closest > 0`, which ignored negative differences when `sum > target`.',
  '- Example: target = 5, sum = 8 gives `target - sum = -3`.',
  '- **Prevention:** Always use `Math.abs(target - sum)` so candidates on both sides of the target are considered.',
].join('\n');

describe('parseNote', () => {
  it('reads numbered mistakes with their points and prevention lines', () => {
    const b = parseNote(MISTAKES) as Section[];
    expect(b.map(s => [s.type, s.num, plain(s.title)])).toEqual([
      ['section', '1', 'Confused the closest sum with the difference from the target'],
      ['section', '2', 'Ignored sums greater than the target'],
    ]);
    const items = (b[1].body[0] as List).items;
    expect(items.map(i => i.label?.kind ?? null)).toEqual([null, 'example', 'fix']);
    expect(items[2].label!.text).toBe('Prevention');
    expect(items[0].content).toContainEqual({ t: 'code', v: 'closest > 0' });
    expect(plain(items[1].content)).toBe('target = 5, sum = 8 gives target - sum = -3.');
  });

  it('gives the same result for a note that was saved on one line', () => {
    const flat = MISTAKES.replace(/\n+/g, ' ');
    expect(reflow(flat)).toBe(MISTAKES);
    expect(parseNote(flat)).toEqual(parseNote(MISTAKES));
  });

  it('leaves ordinary one-line text and its dashes alone', () => {
    for (const s of ['forgot the base case', 'Two pointers - Left and right - Move the smaller one', '**1. Only one** point here'])
      expect(reflow(s)).toBe(s);
    expect(parseNote('forgot the base case')).toEqual([{ type: 'p', lines: [{ label: null, content: [{ t: 'text', v: 'forgot the base case' }] }] }]);
  });

  it('keeps every line of free text and treats a blank line as a paragraph break', () => {
    const b = parseNote('first line\nsecond line\n\nnext paragraph');
    expect(b.map(x => x.type === 'p' && x.lines.map(l => plain(l.content)))).toEqual([['first line', 'second line'], ['next paragraph']]);
  });

  it('treats "1. Title" followed by bullets as numbered entries, and a plain numbered list as a list', () => {
    const secs = parseNote('1. Forgot the base case\n- returned too late\n2. Off by one\n- loop ran to n') as Section[];
    expect(secs.map(s => [s.type, s.num, plain(s.title)])).toEqual([['section', '1', 'Forgot the base case'], ['section', '2', 'Off by one']]);
    const list = parseNote('1. sort\n2. two pointers\n3. skip duplicates')[0] as List;
    expect([list.type, list.ordered, list.items.map(i => i.num)]).toEqual(['list', true, ['1', '2', '3']]);
  });

  it('nests indented bullets and reads headings, code blocks and text before the first entry', () => {
    const b = parseNote('Overall: rushed it.\n\n## Approach\n- sort first\n  - then scan\n  - skip duplicates\n- two pointers\n\n```\nint l = 0;\n  int r = n - 1;\n```');
    expect(b[0].type).toBe('p');
    const sec = b[1] as Section;
    expect([sec.num, plain(sec.title)]).toEqual([null, 'Approach']);
    const list = sec.body[0] as List;
    expect(list.items.map(i => plain(i.content))).toEqual(['sort first', 'two pointers']);
    expect((list.items[0].children[0] as List).items.map(i => plain(i.content))).toEqual(['then scan', 'skip duplicates']);
    expect(sec.body[1]).toEqual({ type: 'code', text: 'int l = 0;\n  int r = n - 1;' });
  });

  it('keeps a bold label line inside its entry instead of starting a new one', () => {
    const [sec] = parseNote('**1. Wrong window**\n**Prevention:**\n- shrink while invalid') as Section[];
    expect(sec.body.map(x => x.type)).toEqual(['p', 'list']);
    expect((sec.body[0] as Extract<Block, { type: 'p' }>).lines[0].label).toEqual({ kind: 'fix', text: 'Prevention' });
  });

  it('drops empty bullets and horizontal rules', () => {
    const list = parseNote('- a\n- \n---\n- b') as List[];
    expect(list.flatMap(l => l.items.map(i => plain(i.content)))).toEqual(['a', 'b']);
  });
});

describe('parseInline and parseLine', () => {
  it('reads bold, italic, code and links', () => {
    expect(parseInline('use **`Math.abs`** and *not* `a - b`, see https://leetcode.com/problems/3sum-closest/.')).toEqual([
      { t: 'text', v: 'use ' }, { t: 'bold', c: [{ t: 'code', v: 'Math.abs' }] }, { t: 'text', v: ' and ' }, { t: 'em', c: [{ t: 'text', v: 'not' }] },
      { t: 'text', v: ' ' }, { t: 'code', v: 'a - b' }, { t: 'text', v: ', see ' },
      { t: 'link', v: 'https://leetcode.com/problems/3sum-closest/', href: 'https://leetcode.com/problems/3sum-closest/' }, { t: 'text', v: '.' },
    ]);
    expect(parseInline('[editorial](https://example.com/a)')).toEqual([{ t: 'link', v: 'editorial', href: 'https://example.com/a' }]);
  });

  it('leaves operators, pointers and snake_case as typed', () => {
    for (const s of ['2**n grows, 3**n too', 'a * b * c', 'i*j and k*l', '*args and **kwargs', 'max_sum_so_far and _tmp_', 'x *= 2; y *= 3', '[1,2](3)', 'javascript:alert(1)'])
      expect(parseInline(s)).toEqual([{ t: 'text', v: s }]);
  });

  it('splits bold labels and known plain labels, and nothing else', () => {
    expect(parseLine('**Prevention:** check `n < 3`')).toMatchObject({ label: { kind: 'fix', text: 'Prevention' } });
    expect(parseLine('**Time complexity**: O(n log n)')).toMatchObject({ label: { kind: 'other', text: 'Time complexity' } });
    expect(parseLine('Fix: sort first')).toMatchObject({ label: { kind: 'fix', text: 'Fix' }, content: [{ t: 'text', v: 'sort first' }] });
    expect(parseLine('Invariant: left <= right')).toMatchObject({ label: { kind: 'key' } });
    expect(parseLine('Root cause: skipped the dry run')).toMatchObject({ label: { kind: 'cause' } });
    expect(parseLine('default: return -1').label).toBeNull();
    expect(parseLine('Ratio 2:1 holds').label).toBeNull();
  });
});

describe('noteSummary', () => {
  it('summarises numbered entries by their titles and free text by its lines', () => {
    expect(noteSummary(MISTAKES)).toEqual({ count: 2, text: 'Confused the closest sum with the difference from the target · Ignored sums greater than the target' });
    expect(noteSummary('forgot the **base case**\n- used `i <= n`')).toEqual({ count: 0, text: 'forgot the base case · used i <= n' });
    expect(noteSummary('')).toEqual({ count: 0, text: '' });
  });
});

describe('editing helpers', () => {
  it('continues a list on Enter and ends it on an empty item', () => {
    let v = '- first';
    expect(run(v, enterEdit(v, v.length, v.length)!)).toBe('- first\n- ');
    v = '  3) third';
    expect(run(v, enterEdit(v, v.length, v.length)!)).toBe('  3) third\n  4) ');
    v = 'a\n- ';
    const e = enterEdit(v, v.length, v.length)!;
    expect([run(v, e), e.selStart]).toEqual(['a\n', 2]);
    expect(enterEdit('plain text', 5, 5)).toBeNull();
    expect(enterEdit('**bold** line', 13, 13)).toBeNull();
    expect(enterEdit('- first', 2, 7)).toBeNull();
  });

  it('wraps a selection, toggles bullets and inserts lines', () => {
    const w = wrapEdit('use abs here', 4, 7, '`');
    expect([run('use abs here', w), w.selStart, w.selEnd]).toEqual(['use `abs` here', 5, 8]);
    expect(run('a\nb', bulletEdit('a\nb', 0, 3))).toBe('- a\n- b');
    expect(run('- a\n- b', bulletEdit('- a\n- b', 0, 7))).toBe('a\nb');
    expect(run('- a\nb', bulletEdit('- a\nb', 0, 5))).toBe('- a\n- b');
    expect(run('- point', lineEdit('- point', 3, '- **Prevention:** '))).toBe('- point\n- **Prevention:** ');
    expect(run('', lineEdit('', 0, '- **Prevention:** '))).toBe('- **Prevention:** ');
  });

  it('adds the next numbered mistake with its title selected', () => {
    const first = mistakeEdit('');
    const one = run('', first);
    expect(one).toBe(`**1. ${MISTAKE_TITLE}**\n- \n- **Prevention:** `);
    expect(one.slice(first.selStart, first.selEnd)).toBe(MISTAKE_TITLE);
    const v = '**1. Off by one**\n- loop ran to n\n';
    const second = mistakeEdit(v);
    const two = run(v, second);
    expect(two).toBe(`**1. Off by one**\n- loop ran to n\n\n**2. ${MISTAKE_TITLE}**\n- \n- **Prevention:** `);
    expect(two.slice(second.selStart, second.selEnd)).toBe(MISTAKE_TITLE);
    expect((parseNote(two) as Section[]).map(s => s.num)).toEqual(['1', '2']);
  });
});
