// Mistakes and notes are stored as plain text. This module reads the light Markdown people type or
// paste there (numbered mistakes, bullets, **bold**, `code`, "Prevention:" lines) into a small tree
// for the UI to render. The stored text is never rewritten, so CSV, backups and sync are unaffected.

export type Inline =
  | { t: 'text'; v: string }
  | { t: 'code'; v: string }
  | { t: 'bold'; c: Inline[] }
  | { t: 'em'; c: Inline[] }
  | { t: 'link'; v: string; href: string };

/** fix = what to do instead · example · cause = why it happened · key = insight worth keeping · other = any other label. */
export type LabelKind = 'fix' | 'example' | 'cause' | 'key' | 'other';
export interface Label { kind: LabelKind; text: string }
/** One line of text, with a leading "Label:" split off when it has one. */
export interface Line { label: Label | null; content: Inline[] }
export interface ListItem extends Line { num: string | null; children: Block[] }
export type Block =
  | { type: 'p'; lines: Line[] }
  | { type: 'list'; ordered: boolean; items: ListItem[] }
  | { type: 'code'; text: string }
  /** A titled entry: one numbered mistake, or a heading with what follows it. */
  | { type: 'section'; num: string | null; title: Inline[]; body: Block[] };

// ---------------------------------------------------------------------------------------------
// Inline text

const wordish = (ch: string | undefined) => !!ch && /[\p{L}\p{N}_]/u.test(ch);
const space = (ch: string | undefined) => !ch || /\s/.test(ch);

/** Index of the closing `mark`, skipping code spans. A closer must follow a non-space character. */
function findClose(s: string, from: number, mark: '**' | '*'): number {
  for (let j = from; j < s.length; j++) {
    if (s[j] === '`') { const e = s.indexOf('`', j + 1); if (e === -1) return -1; j = e; continue; }
    if (s[j] !== '*') continue;
    if (mark === '*') {
      if (s[j + 1] === '*') { j++; continue; }
      if (j > from && !space(s[j - 1]) && !wordish(s[j + 1])) return j;
    } else if (s[j + 1] === '*') {
      if (j > from && !space(s[j - 1])) return j;
      j++;
    }
  }
  return -1;
}

/**
 * `code`, **bold**, *italic*, [text](url) and bare links. Underscores are left alone (snake_case), and an
 * asterisk only opens emphasis at the start of a word, so `2**n` and `a * b` stay as typed.
 */
export function parseInline(s: string): Inline[] {
  const out: Inline[] = []; let buf = '';
  const flush = () => { if (buf) { out.push({ t: 'text', v: buf }); buf = ''; } };
  for (let i = 0; i < s.length;) {
    const ch = s[i], prev = s[i - 1];
    if (ch === '`') {
      const ticks = /^`+/.exec(s.slice(i))![0];
      const end = s.indexOf(ticks, i + ticks.length);
      const inner = end === -1 ? '' : s.slice(i + ticks.length, end);
      if (inner.trim()) { flush(); out.push({ t: 'code', v: inner.trim() }); i = end + ticks.length; continue; }
    } else if (ch === '*' && !wordish(prev) && prev !== '*') {
      const bold = s[i + 1] === '*';
      const from = i + (bold ? 2 : 1);
      if (!space(s[from]) && s[from] !== '*') {
        const end = findClose(s, from, bold ? '**' : '*');
        if (end !== -1) {
          flush(); out.push({ t: bold ? 'bold' : 'em', c: parseInline(s.slice(from, end)) });
          i = end + (bold ? 2 : 1); continue;
        }
      }
    } else if (ch === '[') {
      const m = /^\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/.exec(s.slice(i));
      if (m) { flush(); out.push({ t: 'link', v: m[1], href: m[2] }); i += m[0].length; continue; }
    } else if (ch === 'h' && !wordish(prev)) {
      const m = /^https?:\/\/[^\s<>]+/.exec(s.slice(i));
      if (m) {
        let url = m[0];
        while (/[.,;:!?'"]$/.test(url) || (url.endsWith(')') && !url.includes('('))) url = url.slice(0, -1);
        if (url.length > 8) { flush(); out.push({ t: 'link', v: url, href: url }); i += url.length; continue; }
      }
    }
    buf += ch; i++;
  }
  flush();
  return out;
}

export function plain(c: Inline[]): string {
  return c.map(x => (x.t === 'bold' || x.t === 'em' ? plain(x.c) : x.v)).join('');
}

// ---------------------------------------------------------------------------------------------
// Labels ("Prevention: …", "**Example:** …")

const LABEL_WORDS: Record<LabelKind, string[]> = {
  fix: ['prevention', 'prevent', 'fix', 'avoid', 'how to avoid', 'solution', 'rule', 'rule of thumb', 'remember', 'lesson', 'takeaway',
    'key takeaway', 'tip', 'correction', 'correct approach', 'instead', 'do instead', 'next time'],
  example: ['example', 'examples', 'for example', 'e.g', 'e.g.', 'eg', 'counterexample', 'test case', 'dry run'],
  cause: ['cause', 'root cause', 'why', 'reason', 'why it happened'],
  key: ['insight', 'key insight', 'key idea', 'idea', 'intuition', 'invariant', 'trick', 'pattern'],
  other: ['mistake', 'bug', 'issue', 'symptom', 'note', 'approach', 'edge case', 'edge cases', 'time', 'space', 'complexity',
    'time complexity', 'space complexity'],
};
const LABEL_KIND = new Map<string, LabelKind>();
for (const k of Object.keys(LABEL_WORDS) as LabelKind[]) for (const w of LABEL_WORDS[k]) LABEL_KIND.set(w, k);
const labelKind = (text: string) => LABEL_KIND.get(text.trim().toLowerCase());

/** Splits a leading label off a line: any bold `**Label:**`, or a plain `Label:` when the word is a known one. */
export function parseLine(s: string): Line {
  const bold = /^\*\*([^*`]{1,48}?)\s*:\s*\*\*\s*(.*)$/.exec(s) ?? /^\*\*([^*`]{1,48}?)\*\*\s*:\s*(.*)$/.exec(s);
  if (bold) return { label: { kind: labelKind(bold[1]) ?? 'other', text: bold[1].trim() }, content: parseInline(bold[2]) };
  const word = /^([A-Za-z][A-Za-z .]{0,24}?)\s*:(?:\s+(.*))?$/.exec(s);
  const kind = word && labelKind(word[1]);
  if (word && kind) return { label: { kind, text: word[1].trim() }, content: parseInline(word[2] ?? '') };
  return { label: null, content: parseInline(s) };
}

// ---------------------------------------------------------------------------------------------
// Blocks

const indentOf = (l: string) => /^ */.exec(l)![0].length;
const isBlank = (l: string) => l.trim() === '' || /^\s*([-*_])\1{2,}\s*$/.test(l);   // a "---" rule separates like a blank line
const isFence = (l: string) => /^\s*```/.test(l);

function listMatch(line: string) {
  let m = /^( *)[-*+•](?:\s+(.*))?$/.exec(line);
  if (m) return { indent: m[1].length, ordered: false, num: null as string | null, text: m[2] ?? '' };
  m = /^( *)(\d+)[.)](?:\s+(.*))?$/.exec(line);
  if (m) return { indent: m[1].length, ordered: true, num: m[2], text: m[3] ?? '' };
  return null;
}

/**
 * A line that titles an entry: a Markdown heading, a line that is bold from end to end ("**2. Off by one**"
 * or "2. **Off by one**"), or, when `ordered` is set, any top-level numbered line.
 */
function sectionTitle(line: string, ordered: boolean): { num: string | null; title: string } | null {
  if (/^\s/.test(line)) return null;
  const numbered = (text: string, num: string | null = null) => {
    const m = /^(\d+)[.)]\s+(.*)$/.exec(text);
    return { num: m ? m[1] : num, title: (m ? m[2] : text).replace(/\s*:$/, '') };
  };
  let m = /^#{1,6}\s+(.+?)\s*#*$/.exec(line);
  if (m) return numbered(m[1].replace(/^\*\*((?:(?!\*\*).)+)\*\*$/, '$1'));
  m = /^(?:(\d+)[.)]\s+)?\*\*((?:(?!\*\*).)+)\*\*\s*:?$/.exec(line);
  if (m) {
    const inner = m[2].trim();
    if (!m[1] && labelKind(inner.replace(/\s*:$/, ''))) return null;   // "**Prevention:**" on its own is a label
    return numbered(inner, m[1] ?? null);
  }
  if (ordered) { m = /^(\d+)[.)]\s+(.+)$/.exec(line); if (m) return { num: m[1], title: m[2] }; }
  return null;
}

function parseBlocks(lines: string[]): Block[] {
  const blocks: Block[] = [];
  let i = 0;
  const nextText = (from: number) => { let j = from; while (j < lines.length && isBlank(lines[j])) j++; return j; };
  while (i < lines.length) {
    const line = lines[i];
    if (isBlank(line)) { i++; continue; }
    if (isFence(line)) {
      const body: string[] = []; i++;
      while (i < lines.length && !isFence(lines[i])) body.push(lines[i++]);
      i++;
      const cut = Math.min(...body.filter(l => l.trim()).map(indentOf), 99);
      if (body.some(l => l.trim())) blocks.push({ type: 'code', text: body.map(l => l.slice(Math.min(cut, indentOf(l)))).join('\n') });
      continue;
    }
    const first = listMatch(line);
    if (first) {
      const base = first.indent, items: ListItem[] = [];
      while (i < lines.length) {
        const m = listMatch(lines[i]);
        if (!m || m.ordered !== first.ordered || m.indent > base + 1) break;
        i++;
        // Deeper-indented lines belong to this item: nested lists, or text continuing it.
        const kids: string[] = [];
        while (i < lines.length) {
          if (isBlank(lines[i])) { const j = nextText(i); if (j < lines.length && indentOf(lines[j]) > base + 1) { kids.push(''); i++; continue; } break; }
          if (indentOf(lines[i]) <= base + 1) break;
          kids.push(lines[i++]);
        }
        const cut = Math.min(...kids.filter(l => l.trim()).map(indentOf), 99);
        const children = parseBlocks(kids.map(l => l.slice(Math.min(cut, indentOf(l)))));
        if (m.text.trim() || children.length) items.push({ num: m.num, ...parseLine(m.text.trim()), children });
        const j = nextText(i);
        const sib = j < lines.length ? listMatch(lines[j]) : null;
        if (sib && sib.ordered === first.ordered && sib.indent <= base + 1) i = j; else break;
      }
      if (items.length) blocks.push({ type: 'list', ordered: first.ordered, items });
      continue;
    }
    const para: Line[] = [];
    while (i < lines.length && !isBlank(lines[i]) && !isFence(lines[i]) && !listMatch(lines[i])) para.push(parseLine(lines[i++].trim()));
    blocks.push({ type: 'p', lines: para });
  }
  return blocks;
}

/**
 * Restores the line breaks of a structured note that was saved on one line ("**1. Title** - point - point
 * **2. Title** - point"). Text that already has line breaks, or has no such structure, is returned as it is.
 */
export function reflow(text: string): string {
  const t = text.trim();
  if (t.includes('\n')) return text;
  const heads = t.match(/(?:^|\s)\*\*\d+[.)]\s/g)?.length ?? 0;
  if (heads < 2 && !(heads === 1 && /^\*\*\d/.test(t) && /\*\*\s+-\s+[A-Z`*]/.test(t))) return text;
  const code: string[] = [];
  return t
    .replace(/`[^`]*`/g, m => { code.push(m); return `\u0000${code.length - 1}\u0000`; })   // dashes inside code are not bullets
    .replace(/\s+(?=\*\*\d+[.)]\s)/g, '\n\n')
    .replace(/[ \t]+-[ \t]+(?=[A-Z\u0000]|\*\*)/g, '\n- ')
    .replace(/\u0000(\d+)\u0000/g, (_, n) => code[Number(n)]);
}

export function parseNote(raw: string): Block[] {
  const lines = reflow(raw).replace(/\r\n?/g, '\n').replace(/\t/g, '    ').split('\n').map(l => l.replace(/\s+$/, ''));
  // "1. Title" directly followed by bullets is a numbered entry with its points, not a list item.
  let fence = false;
  const ordered = lines.some((l, i) => {
    if (isFence(l)) { fence = !fence; return false; }
    if (fence || !/^\d+[.)]\s+\S/.test(l)) return false;
    let j = i + 1; while (j < lines.length && isBlank(lines[j])) j++;
    return j < lines.length && /^ *[-*+•]\s+\S/.test(lines[j]);
  });
  const out: Block[] = [];
  let head: string[] = [];
  let cur: { num: string | null; title: string; lines: string[] } | null = null;
  const close = () => { if (cur) out.push({ type: 'section', num: cur.num, title: parseInline(cur.title), body: parseBlocks(cur.lines) }); };
  fence = false;
  for (const l of lines) {
    if (isFence(l)) fence = !fence;
    const t = fence || isFence(l) ? null : sectionTitle(l, ordered);
    if (t) { close(); cur = { ...t, lines: [] }; } else (cur ? cur.lines : head).push(l);
  }
  close();
  return [...parseBlocks(head), ...out];
}

/**
 * A one-line plain-text digest for lists and truncated previews. A note made of numbered entries is
 * summarised by its titles, and `count` is how many numbered entries it has (0 for free text).
 */
export function noteSummary(raw: string): { count: number; text: string } {
  let hit = summaries.get(raw);
  if (!hit) {
    if (summaries.size >= 2000) summaries.clear();
    summaries.set(raw, hit = summarise(raw));
  }
  return hit;
}
// Tables ask for the same summaries on every render (one per row), so they are kept.
const summaries = new Map<string, { count: number; text: string }>();

function summarise(raw: string): { count: number; text: string } {
  const blocks = parseNote(raw);
  const titles = blocks.filter((b): b is Extract<Block, { type: 'section' }> => b.type === 'section');
  if (titles.length) return { count: titles.filter(s => s.num !== null).length, text: titles.map(s => plain(s.title)).join(' · ') };
  const parts: string[] = [];
  const line = (l: Line) => { const s = `${l.label ? `${l.label.text}: ` : ''}${plain(l.content)}`.trim(); if (s) parts.push(s); };
  const walk = (bs: Block[]) => {
    for (const b of bs) {
      if (b.type === 'p') b.lines.forEach(line);
      else if (b.type === 'list') b.items.forEach(it => { line(it); walk(it.children); });
      else if (b.type === 'code') parts.push(b.text.split('\n')[0]);
    }
  };
  walk(blocks);
  return { count: 0, text: parts.join(' · ') };
}

// ---------------------------------------------------------------------------------------------
// Editing helpers. Each returns one replacement for the textarea and the selection to leave behind.

export interface Edit { start: number; end: number; text: string; selStart: number; selEnd: number }

const lineStart = (v: string, at: number) => v.lastIndexOf('\n', at - 1) + 1;
const lineEnd = (v: string, at: number) => { const e = v.indexOf('\n', at); return e === -1 ? v.length : e; };

/** Enter inside a list starts the next item; Enter on an empty item ends the list. Null means a normal Enter. */
export function enterEdit(v: string, start: number, end: number): Edit | null {
  if (start !== end) return null;
  const ls = lineStart(v, start), le = lineEnd(v, start);
  const m = /^(\s*)(?:([-*+•])|(\d+)([.)]))\s+(.*)$/.exec(v.slice(ls, start));
  if (!m) return null;
  if (!m[5].trim() && !v.slice(start, le).trim()) return { start: ls, end: le, text: '', selStart: ls, selEnd: ls };
  const text = `\n${m[1]}${m[2] ?? `${Number(m[3]) + 1}${m[4]}`} `;
  return { start, end, text, selStart: start + text.length, selEnd: start + text.length };
}

/** Wraps the selection in `mark`; with nothing selected, leaves the caret between a pair of marks. */
export function wrapEdit(v: string, start: number, end: number, mark: string): Edit {
  const text = `${mark}${v.slice(start, end)}${mark}`;
  return { start, end, text, selStart: start + mark.length, selEnd: end + mark.length };
}

/** Turns the selected lines into bullets, or back into plain lines when they all are bullets already. */
export function bulletEdit(v: string, start: number, end: number): Edit {
  const ls = lineStart(v, start), le = lineEnd(v, end);
  const lines = v.slice(ls, le).split('\n');
  const all = lines.every(l => /^\s*[-*+•]\s/.test(l) || !l.trim());
  const text = lines.map(l => (all ? l.replace(/^(\s*)[-*+•]\s+/, '$1') : /^\s*[-*+•]\s/.test(l) ? l : `- ${l}`)).join('\n');
  return { start: ls, end: le, text, selStart: ls + text.length, selEnd: ls + text.length };
}

/** Starts a new line holding `text` after the caret's line (or on it, when that line is empty). */
export function lineEdit(v: string, at: number, text: string): Edit {
  const ls = lineStart(v, at), le = lineEnd(v, at);
  const ins = v.slice(ls, le).trim() ? `\n${text}` : text;
  return { start: le, end: le, text: ins, selStart: le + ins.length, selEnd: le + ins.length };
}

export const MISTAKE_TITLE = 'What went wrong';
/** Appends the skeleton of the next numbered mistake, with its title selected for typing over. */
export function mistakeEdit(v: string): Edit {
  const n = (v.match(/^(?:\*\*)?\d+[.)]\s/gm)?.length ?? 0) + 1;
  const at = v.replace(/\s+$/, '').length;
  const lead = `${at ? '\n\n' : ''}**${n}. `;
  const text = `${lead}${MISTAKE_TITLE}**\n- \n- **Prevention:** `;
  return { start: at, end: v.length, text, selStart: at + lead.length, selEnd: at + lead.length + MISTAKE_TITLE.length };
}
