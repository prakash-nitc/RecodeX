import React, { useState } from 'react';
import { Upload, Copy, Download, FileText } from 'lucide-react';
import { Button, Dialog, Segmented, Textarea, useUi } from '../components/ui';
import { useData, settingsOf, importRows } from '../lib/store';
import { csvToRows, problemsToCsv, CSV_TEMPLATE, CsvParseResult } from '../lib/csv';
import { statusOf, revisionTypeOf } from '../lib/engine';
import { today } from '../lib/dates';

/** Downloads the text as a file; if the browser refuses, the caller shows the text to copy instead. */
export async function saveFile(filename: string, data: string, mime: string): Promise<'saved' | 'fallback' | 'declined'> {
  try {
    const url = URL.createObjectURL(new Blob([data], { type: mime }));
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.rel = 'noopener'; a.style.display = 'none';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    return 'saved';
  } catch { return 'fallback'; }
}

export function CopyBox({ text, label }: { text: string; label: string }) {
  const { toast } = useUi();
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); toast('Copied to clipboard'); }
    catch { const el = document.getElementById('copybox') as HTMLTextAreaElement | null; el?.select(); toast('Press Ctrl+C to copy the selected text', 'info'); }
  };
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between"><span className="text-sm text-muted">{label}</span><Button size="sm" variant="outline" onClick={copy}><Copy size={14} />Copy</Button></div>
      <Textarea id="copybox" readOnly value={text} rows={10} className="font-mono text-xs" onFocus={e => e.currentTarget.select()} />
    </div>
  );
}

export function readFileText(file: File): Promise<string> {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result ?? '')); r.onerror = () => rej(r.error); r.readAsText(file); });
}

export function CsvDialog({ mode, onClose }: { mode: 'import' | 'export'; onClose: () => void }) {
  const d = useData(); const s = settingsOf(d); const { toast } = useUi();
  const [text, setText] = useState('');
  const [parsed, setParsed] = useState<CsvParseResult | null>(null);
  const [dupMode, setDupMode] = useState<'skip' | 'update'>('skip');
  const [fallback, setFallback] = useState<string | null>(null);
  const csvOut = () => problemsToCsv(Object.values(d.problems).sort((a, b) => a.num - b.num), d.patterns, p => statusOf(p, s), p => revisionTypeOf(p.lastRating));

  if (mode === 'export') {
    const doSave = async () => {
      const data = csvOut();
      const r = await saveFile(`recodex-problem-bank-${today()}.csv`, data, 'text/csv');
      if (r === 'saved') { toast('CSV saved'); onClose(); } else if (r === 'fallback') setFallback(data);
    };
    return (
      <Dialog open onClose={onClose} title="Export problem bank" sub={`${Object.keys(d.problems).length} problems with ratings, dates, phases and notes`} width="max-w-2xl"
        footer={<><Button variant="ghost" onClick={onClose}>Close</Button>{!fallback && <Button variant="primary" onClick={doSave}><Download size={15} />Save CSV file</Button>}</>}>
        {fallback ? <CopyBox text={fallback} label="The download did not start. Copy the CSV and paste it into a file or Google Sheets." />
          : <p className="text-sm text-muted">The file opens in Google Sheets or Excel and can be imported back here. Revision history is not part of the CSV. Use Settings → Backup for a complete copy.</p>}
      </Dialog>
    );
  }

  const parse = (t: string) => { setText(t); setParsed(t.trim() ? csvToRows(t) : null); };
  const onFile = async (f: File | undefined) => { if (f) parse(await readFileText(f)); };
  const run = () => {
    if (!parsed?.rows.length) return;
    const r = importRows(parsed.rows, dupMode);
    toast(`Imported: ${r.added} added, ${r.updated} updated, ${r.skipped} skipped`);
    onClose();
  };
  return (
    <Dialog open onClose={onClose} title="Import problems from CSV" width="max-w-2xl"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!parsed?.rows.length} onClick={run}><Upload size={15} />Import {parsed?.rows.length ?? 0} rows</Button></>}>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted">Required columns: <code className="font-mono text-fg">name</code> and <code className="font-mono text-fg">pattern</code>. Optional: sub_pattern, difficulty, url, priority, track (active/backlog), last_rating, last_revised, next_review (YYYY-MM-DD), phase, weakness, notes. New patterns are created automatically. A file exported from here imports as-is.</p>
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-line px-4 py-6 text-center hover:border-accent/60">
          <FileText size={22} className="text-muted" />
          <span className="text-sm font-semibold text-fg">Choose a .csv file</span>
          <span className="text-xs text-muted">or paste the contents below</span>
          <input type="file" accept=".csv,text/csv" className="sr-only" onChange={e => onFile(e.target.files?.[0])} />
        </label>
        <Textarea aria-label="CSV text" rows={6} className="font-mono text-xs" placeholder={CSV_TEMPLATE} value={text} onChange={e => parse(e.target.value)} />
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-muted">When a problem already exists (same URL or name in that pattern):</span>
          <Segmented size="sm" ariaLabel="Duplicate handling" value={dupMode} onChange={setDupMode} options={[{ value: 'skip', label: 'Skip it' }, { value: 'update', label: 'Update it' }]} />
        </div>
        {parsed && (
          <div className="rounded-xl border border-line bg-surface2 px-4 py-3 text-sm">
            <div className="font-semibold text-fg">{parsed.rows.length} rows ready · {parsed.rows.filter(r => r.rating).length} with a rating</div>
            {parsed.rows.slice(0, 5).map((r, i) => <div key={i} className="text-xs text-muted mt-1 truncate">{r.name} · {r.pattern}{r.subPattern ? ` › ${r.subPattern}` : ''} · {r.difficulty}{r.rating ? ` · ${r.rating}` : ''}</div>)}
            {parsed.rows.length > 5 && <div className="text-xs text-muted mt-1">and {parsed.rows.length - 5} more</div>}
            {parsed.errors.slice(0, 6).map((e, i) => <div key={i} className="text-xs text-hot mt-1">{e}</div>)}
          </div>
        )}
      </div>
    </Dialog>
  );
}
