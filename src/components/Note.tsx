// Reading and writing mistakes and notes. The text is stored as typed; lib/notes.ts gives it structure:
// numbered mistakes, bullets, `code`, and "Prevention:" lines, which stand out as what to do instead.
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Bold, Code, Eye, List, PenLine, Plus, ShieldCheck } from 'lucide-react';
import {
  parseNote, noteSummary, enterEdit, wrapEdit, bulletEdit, lineEdit, mistakeEdit,
  type Block, type Edit, type Inline, type LabelKind, type Line,
} from '../lib/notes';
import { cx } from './ui';

export type NoteTone = 'mistake' | 'notes';

// ---------------------------------------------------------------------------------------------
// Rendering

function Inl({ c }: { c: Inline[] }) {
  return <>{c.map((x, i) => {
    switch (x.t) {
      case 'text': return <React.Fragment key={i}>{x.v}</React.Fragment>;
      // No ligatures: `==`, `!=` and `<=` should read exactly as they are typed in code.
      case 'code': return <code key={i} className="box-decoration-clone rounded-md border border-line/80 bg-surface2 px-1 py-px font-mono text-[0.86em] text-fg [font-variant-ligatures:none]">{x.v}</code>;
      case 'bold': return <strong key={i} className="font-semibold text-fg"><Inl c={x.c} /></strong>;
      case 'em': return <em key={i}><Inl c={x.c} /></em>;
      case 'link': return <a key={i} href={x.href} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="font-medium text-accent-ink underline underline-offset-2">{x.v}</a>;
    }
  })}</>;
}

const LABEL_CLS: Record<Exclude<LabelKind, 'fix'>, string> = {
  example: 'text-muted', cause: 'text-hot-ink', key: 'text-accent-ink', other: 'text-fg',
};

/** "Prevention", "Fix", "Rule"…: the part of a mistake worth rereading, so it gets its own callout. */
function FixCallout({ l }: { l: Line }) {
  return (
    <div className="rounded-lg border border-ok/30 bg-ok/10 px-2.5 py-1.5">
      <div className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-[0.08em] text-ok-ink"><ShieldCheck size={12} strokeWidth={2.5} />{l.label!.text}</div>
      {l.content.length > 0 && <div className="mt-0.5 text-fg"><Inl c={l.content} /></div>}
    </div>
  );
}
function LineView({ l }: { l: Line }) {
  if (!l.label) return <Inl c={l.content} />;
  if (l.label.kind === 'fix') return <FixCallout l={l} />;
  return <><span className={cx('font-semibold', LABEL_CLS[l.label.kind])}>{l.label.text}:</span>{l.content.length > 0 && <> <Inl c={l.content} /></>}</>;
}

function Blocks({ blocks, tone }: { blocks: Block[]; tone: NoteTone }) {
  return <>{blocks.map((b, i) => {
    if (b.type === 'p') return <div key={i} className="flex flex-col gap-1">{b.lines.map((l, j) => <div key={j}><LineView l={l} /></div>)}</div>;
    if (b.type === 'code') return <pre key={i} className="scroll-thin overflow-x-auto rounded-lg border border-line bg-surface2 px-3 py-2 font-mono text-xs leading-relaxed text-fg [font-variant-ligatures:none]">{b.text}</pre>;
    if (b.type === 'list') {
      const L = b.ordered ? 'ol' : 'ul';
      return (
        <L key={i} className="flex flex-col gap-1.5">
          {b.items.map((it, j) => {
            const kids = it.children.length > 0 && <div className="mt-1.5 flex flex-col gap-1.5"><Blocks blocks={it.children} tone={tone} /></div>;
            if (it.label?.kind === 'fix') return <li key={j}><FixCallout l={it} />{kids}</li>;
            return (
              <li key={j} className="flex gap-2">
                {b.ordered
                  ? <span aria-hidden className="min-w-[1.1em] shrink-0 text-right font-medium tabular-nums text-muted">{it.num}.</span>
                  : <span aria-hidden className="mt-[0.62em] h-[5px] w-[5px] shrink-0 rounded-full bg-muted/70" />}
                <div className="min-w-0 flex-1"><LineView l={it} />{kids}</div>
              </li>
            );
          })}
        </L>
      );
    }
    return (
      <section key={i} className={cx('flex items-start gap-2.5', i > 0 && 'border-t border-line/60 pt-3')}>
        {b.num !== null && (
          <span aria-hidden className={cx('mt-px flex h-[22px] min-w-[22px] shrink-0 items-center justify-center rounded-md px-1 text-[11px] font-bold tabular-nums',
            tone === 'mistake' ? 'bg-hot/15 text-hot-ink' : 'bg-surface2 text-muted')}>{b.num}</span>
        )}
        <div className="min-w-0 flex-1">
          <h4 className="font-semibold leading-snug text-fg">{b.num !== null && <span className="sr-only">{b.num}. </span>}<Inl c={b.title} /></h4>
          {b.body.length > 0 && <div className="mt-1.5 flex flex-col gap-2"><Blocks blocks={b.body} tone={tone} /></div>}
        </div>
      </section>
    );
  })}</>;
}

/**
 * A mistake or note, laid out for reading. `collapse` (px) folds a long one behind "Show all";
 * `className` sets size and colour (the default is the body text of a card).
 */
export function NoteView({ text, tone = 'notes', collapse, className }: { text: string; tone?: NoteTone; collapse?: number; className?: string }) {
  const blocks = useMemo(() => parseNote(text), [text]);
  const count = useMemo(() => (collapse ? noteSummary(text).count : 0), [text, collapse]);
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [over, setOver] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current; if (!el || !collapse) return;
    // A note only a few lines over the limit is shown whole: folding it would hide less than the button takes.
    const check = () => setOver(el.scrollHeight > collapse + 48);
    check();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(check); ro.observe(el);
    return () => ro.disconnect();
  }, [text, collapse]);
  const folded = !!collapse && over && !open;
  const fade = 'linear-gradient(#000 calc(100% - 44px), transparent)';
  return (
    <div>
      <div ref={ref} className={cx('flex flex-col gap-3 break-words text-sm leading-relaxed text-fg', className)}
        style={folded ? { maxHeight: collapse, overflow: 'hidden', WebkitMaskImage: fade, maskImage: fade } : undefined}>
        <Blocks blocks={blocks} tone={tone} />
      </div>
      {!!collapse && over && (
        <button type="button" aria-expanded={open} onClick={e => { e.stopPropagation(); setOpen(!open); }} className="mt-1.5 text-xs font-semibold text-accent-ink hover:underline">
          {open ? 'Show less' : tone === 'mistake' && count > 1 ? `Show all ${count} mistakes` : 'Show all'}
        </button>
      )}
    </div>
  );
}

/** A labelled mistake or note inside a card. A mistake made of numbered entries says how many there are. */
export function NoteSection({ label, text, tone = 'notes', collapse, className }: { label: string; text: string; tone?: NoteTone; collapse?: number; className?: string }) {
  const count = useMemo(() => (tone === 'mistake' ? noteSummary(text).count : 0), [text, tone]);
  return (
    <div className={className}>
      <div className={cx('mb-1.5 text-[11px] font-bold uppercase tracking-[0.08em]', tone === 'mistake' ? 'text-hot-ink' : 'text-muted')}>
        {count > 1 && label === 'Mistake' ? <span className="tabular-nums">{count} mistakes</span> : <>{label}{count > 1 && <span className="tabular-nums"> · {count} mistakes</span>}</>}
      </div>
      <NoteView text={text} tone={tone} collapse={collapse} />
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Editing

const MAX_H = 440;

function Tool({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  // Formatting buttons act on the textarea's selection, so they must not take the focus (or a Tab stop) from it.
  return (
    <button type="button" tabIndex={-1} title={label} aria-label={label} onMouseDown={e => e.preventDefault()} onClick={onClick}
      className="inline-flex h-7 min-w-7 items-center justify-center gap-1 rounded-lg px-1.5 text-xs font-semibold text-muted transition-colors hover:bg-hover hover:text-fg">
      {children}
    </button>
  );
}

/**
 * The textarea for a mistake or note. It grows with its content, continues lists on Enter, has buttons and
 * shortcuts for the few marks the reader understands, and can show the result before saving.
 */
export function NoteEditor({ id, value, onChange, tone = 'notes', placeholder, rows = 2, autoFocus }: {
  id: string; value: string; onChange: (v: string) => void; tone?: NoteTone; placeholder?: string; rows?: number; autoFocus?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const pending = useRef<[number, number] | null>(null);
  const [preview, setPreview] = useState(false);
  const showPreview = preview && !!value.trim();

  useLayoutEffect(() => {
    const el = ref.current; if (!el || showPreview) return;
    // Measuring needs height:auto for a moment, which can make a scrolled dialog or page jump: put it back.
    const box = el.closest<HTMLElement>('.overflow-y-auto'); const top = box?.scrollTop; const y = window.scrollY;
    el.style.height = 'auto';
    const h = el.scrollHeight + 2;
    el.style.height = `${Math.min(h, MAX_H)}px`;
    el.style.overflowY = h > MAX_H ? 'auto' : 'hidden';
    if (box && top !== undefined && box.scrollTop !== top) box.scrollTop = top;
    if (window.scrollY !== y) window.scrollTo(window.scrollX, y);
    if (pending.current) { el.setSelectionRange(pending.current[0], pending.current[1]); pending.current = null; }
  }, [value, showPreview]);
  useEffect(() => { if (!value.trim()) setPreview(false); }, [value]);

  const apply = (e: Edit) => {
    const el = ref.current; if (!el) return;
    el.focus();
    el.setSelectionRange(e.start, e.end);
    // insertText keeps the browser's undo history; where it is unavailable the value is replaced directly.
    let done = false;
    try { done = e.text ? document.execCommand('insertText', false, e.text) : e.start === e.end || document.execCommand('delete'); } catch { /* fall through */ }
    if (done) { el.setSelectionRange(e.selStart, e.selEnd); return; }
    pending.current = [e.selStart, e.selEnd];
    onChange(value.slice(0, e.start) + e.text + value.slice(e.end));
  };
  const sel = (fn: (v: string, a: number, b: number) => Edit) => { const el = ref.current; if (el) apply(fn(el.value, el.selectionStart, el.selectionEnd)); };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey && !e.nativeEvent.isComposing) {
      const ed = enterEdit(el.value, el.selectionStart, el.selectionEnd);
      if (ed) { e.preventDefault(); apply(ed); }
    } else if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && (e.key === 'b' || e.key === 'e')) {
      e.preventDefault();
      apply(wrapEdit(el.value, el.selectionStart, el.selectionEnd, e.key === 'b' ? '**' : '`'));
    }
  };

  return (
    <div className="min-w-0">
      <textarea ref={ref} id={id} rows={rows} autoFocus={autoFocus} value={value} placeholder={placeholder}
        onChange={e => onChange(e.target.value)} onKeyDown={onKeyDown}
        className={cx(showPreview ? 'hidden' : 'block', 'w-full min-h-[72px] resize-none rounded-xl border border-line bg-surface px-3 py-2 text-sm leading-relaxed text-fg placeholder:text-muted/70 transition-colors hover:border-muted/40 focus:border-focus focus:outline-none focus:ring-2 focus:ring-focus/40')} />
      {showPreview && (
        <div className="min-h-[72px] rounded-xl border border-dashed border-line bg-surface px-3 py-2.5"><NoteView text={value} tone={tone} /></div>
      )}
      <div className="mt-1 flex flex-wrap items-center gap-0.5">
        {!showPreview && <>
          <Tool label="Bold (Ctrl+B)" onClick={() => sel((v, a, b) => wrapEdit(v, a, b, '**'))}><Bold size={14} /></Tool>
          <Tool label="Code (Ctrl+E)" onClick={() => sel((v, a, b) => wrapEdit(v, a, b, '`'))}><Code size={14} /></Tool>
          <Tool label="Bullet list" onClick={() => sel(bulletEdit)}><List size={14} /></Tool>
          {tone === 'mistake' && <>
            <Tool label="Add a numbered mistake" onClick={() => sel(v => mistakeEdit(v))}><Plus size={13} />Mistake</Tool>
            <Tool label="Add a prevention line" onClick={() => sel((v, a) => lineEdit(v, a, '- **Prevention:** '))}><ShieldCheck size={13} />Prevention</Tool>
          </>}
        </>}
        {!!value.trim() && (
          <button type="button" aria-pressed={showPreview}
            onClick={() => { setPreview(!showPreview); if (showPreview) setTimeout(() => ref.current?.focus(), 0); }}
            className="ml-auto inline-flex h-7 items-center gap-1 rounded-lg px-1.5 text-xs font-semibold text-accent-ink hover:bg-hover">
            {showPreview ? <><PenLine size={13} />Write</> : <><Eye size={13} />Preview</>}
          </button>
        )}
      </div>
    </div>
  );
}
