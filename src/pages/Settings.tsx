import React, { useState } from 'react';
import { Download, Upload, RotateCcw, Trash2, Plus, X, Database, HardDrive, LogOut, KeyRound, Settings2, Palette, Bell, Shield, Sliders, BookOpen, Smartphone } from 'lucide-react';
import { useData, settingsOf, updateSettings, makeBackup, restoreBackup, resetToImport, Backup, BACKUP_APP_IDS, shutdown } from '../lib/store';
import { supabase } from '../lib/supabase/client';
import { intervalFor } from '../lib/engine';
import { applyTheme } from '../lib/theme';
import { today, fmtTimestamp } from '../lib/dates';
import { usePwaInstall } from '../lib/pwa';
import type { Settings as S, DiffChoice } from '../types';
import { DEFAULT_SETTINGS } from '../types';
import { Button, Card, CardHeader, Field, Input, PageHeader, Segmented, Toggle, Select, useUi, Dialog, cx, SectionLabel } from '../components/ui';
import { saveFile, CopyBox, readFileText, CsvDialog } from './CsvDialog';
import { ThemePicker } from '../components/ThemePicker';

function Num({ id, value, onChange, min = 0, max = 365, suffix }: { id: string; value: number; onChange: (n: number) => void; min?: number; max?: number; suffix?: string }) {
  const [v, setV] = useState(String(value));
  React.useEffect(() => setV(String(value)), [value]);
  return (
    <div className="flex items-center gap-2">
      <Input id={id} type="number" min={min} max={max} className="!w-24" value={v} onChange={e => setV(e.target.value)}
        onBlur={() => { const n = Math.round(Number(v)); if (Number.isFinite(n) && n >= min && n <= max) onChange(n); else setV(String(value)); }} />
      {suffix && <span className="text-sm text-muted">{suffix}</span>}
    </div>
  );
}

function InstallCard() {
  const { canInstall, installed, install } = usePwaInstall();
  const { toast } = useUi();
  if (installed) return null;

  const handleInstall = async () => {
    const ok = await install();
    if (ok) toast('RecodeX installed');
  };

  return (
    <Card>
      <CardHeader
        title="Install app"
        icon={<Smartphone size={18} />}
        sub="Install RecodeX on your phone or desktop for quick access and offline use."
      />
      <div className="px-4 sm:px-5 pb-5 flex flex-col gap-2">
        <div>
          <Button variant="primary" onClick={handleInstall} disabled={!canInstall}>
            <Download size={15} />
            {canInstall ? 'Install RecodeX' : 'Install app'}
          </Button>
        </div>
        {!canInstall && (
          <p className="text-xs text-muted leading-relaxed">
            To install manually, open your browser menu and choose "Install RecodeX" or "Add to Home screen".
          </p>
        )}
      </div>
    </Card>
  );
}

function AccountCard() {
  const d = useData(); const { toast, confirm } = useUi();
  const [email, setEmail] = useState<string | null>(null);
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  React.useEffect(() => { supabase?.auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? null)); }, []);
  if (!supabase) return null;
  const changePassword = async () => {
    setBusy(true);
    const { error } = await supabase!.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) toast(error.message, 'error'); else { setPw(''); toast('Password updated'); }
  };
  const signOut = async () => {
    const body = d.pending > 0
      ? `${d.pending} change${d.pending === 1 ? ' is' : 's are'} not saved to your account yet and will be lost. Stay online until the sidebar shows "All changes saved" to keep them.`
      : 'Your data stays in your account. This device forgets its saved copy.';
    if (!(await confirm({ title: 'Sign out?', body, confirmLabel: 'Sign out', danger: d.pending > 0 }))) return;
    await shutdown(true);
    await supabase!.auth.signOut({ scope: 'local' });
  };
  return (
    <Card>
      <CardHeader title="Account" icon={<Shield size={18} />}
        sub={email ? <><span className="text-muted">Signed in as </span><span className="font-semibold text-fg">{email}</span></> : 'Signed in'} />
      <div className="px-4 sm:px-5 pb-5 flex flex-col gap-4">
        <Field label="New password" htmlFor="st-pw" hint="At least 6 characters. Useful after signing in with a magic link.">
          <div className="flex flex-wrap gap-2">
            <Input id="st-pw" type="password" autoComplete="new-password" className="!w-64 max-w-full" value={pw} onChange={e => setPw(e.target.value)} />
            <Button variant="outline" disabled={busy || pw.length < 6} onClick={changePassword}><KeyRound size={15} />Update password</Button>
          </div>
        </Field>
        <div className="border-t border-line pt-3"><Button variant="ghost" onClick={signOut}><LogOut size={15} />Sign out</Button></div>
      </div>
    </Card>
  );
}

function NameInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [v, setV] = useState(value);
  React.useEffect(() => setV(value), [value]);
  return <Input id="st-name" className="!w-72 max-w-full" maxLength={40} placeholder="e.g. Prakash" value={v} onChange={e => setV(e.target.value)} onBlur={() => { if (v.trim() !== value) onChange(v.trim()); }} />;
}

export default function Settings() {
  const d = useData(); const s = settingsOf(d); const { toast, confirm } = useUi();
  const set = (patch: Partial<S>) => { updateSettings(patch); };
  const [fallback, setFallback] = useState<string | null>(null);
  const [csv, setCsv] = useState<null | 'import' | 'export'>(null);
  const patterns = Object.values(d.patterns).sort((a, b) => a.order - b.order);

  const backup = async () => {
    const json = JSON.stringify(makeBackup(), null, 1);
    const r = await saveFile(`recodex-backup-${today()}.json`, json, 'application/json');
    if (r === 'saved') toast('Backup saved'); else if (r === 'fallback') setFallback(json);
  };
  const restore = async (file: File | undefined) => {
    if (!file) return;
    try {
      const b = JSON.parse(await readFileText(file)) as Backup;
      if (!BACKUP_APP_IDS.includes(b.app) || !Array.isArray(b.problems)) throw new Error('not a backup');
      if (await confirm({ title: 'Restore this backup?', body: `It replaces everything here with ${b.problems.length} problems, ${b.revisions.length} revisions and ${b.sessions.length} sessions from ${fmtTimestamp(b.exportedAt)}.`, confirmLabel: 'Replace and restore', danger: true })) {
        restoreBackup(b); toast('Backup restored');
      }
    } catch { toast('That file is not a RecodeX backup (.json exported from Settings).', 'error'); }
  };
  const reset = async () => {
    if (await confirm({ title: 'Delete everything and start over?', body: 'All problems, revisions and sessions are erased, and the import screen opens again. Export a backup first if you want to keep any of it.', confirmLabel: 'Delete everything', danger: true })) {
      resetToImport(); toast('Data cleared');
    }
  };
  const ladder = s.greenLadder;
  const setLadder = (l: number[]) => set({ greenLadder: l.length ? l : [7] });
  const togglePlan = (id: string) => set({ studyPlanPatternIds: s.studyPlanPatternIds.includes(id) ? s.studyPlanPatternIds.filter(x => x !== id) : [...s.studyPlanPatternIds, id] });

  return (
    <div className="max-w-4xl">
      <PageHeader eyebrow={<span className="inline-flex items-center gap-1.5"><Settings2 size={13} />Configuration</span>} title="Settings" sub="Changes save as you make them." />
      <div className="flex flex-col gap-4">
        <InstallCard />
        <AccountCard />

        {/* Appearance */}
        <Card>
          <CardHeader title="Appearance and calendar" icon={<Palette size={18} />} />
          <div className="px-4 sm:px-5 pb-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Display name" htmlFor="st-name" hint="Used in the dashboard greeting." className="md:col-span-2">
              <NameInput value={s.displayName} onChange={v => set({ displayName: v })} />
            </Field>
            <Field label="Theme" className="md:col-span-2" hint="Applies instantly, on every device signed in to your account.">
              <ThemePicker value={s.theme} onChange={v => { set({ theme: v }); applyTheme(v); }} />
            </Field>
            <Field label="Dashboard scene" hint="Server room is your own animation. Pixel den follows the theme (daytime in the light themes, night in the dark ones); Lofi window and Mountains follow the time of day. Obsidian Graphite shows all of them in grayscale. All stay still if your device reduces motion.">
              <Segmented ariaLabel="Dashboard scene" value={s.heroScene} onChange={v => set({ heroScene: v })}
                options={[{ value: 'gif', label: 'Server room' }, { value: 'pixel', label: 'Pixel den' }, { value: 'lofi', label: 'Lofi window' }, { value: 'mountains', label: 'Mountains' }]} />
            </Field>
            <Field label="Week starts on">
              <Segmented ariaLabel="Week start" value={s.weekStart} onChange={v => set({ weekStart: v })} options={[{ value: 1, label: 'Monday' }, { value: 0, label: 'Sunday' }]} />
            </Field>
            <p className="md:col-span-2 text-xs text-muted">Dates use your device's time zone ({Intl.DateTimeFormat().resolvedOptions().timeZone}). A problem becomes overdue at local midnight.</p>
          </div>
        </Card>

        {/* Daily plan */}
        <Card>
          <CardHeader title="Daily plan" icon={<BookOpen size={18} />} sub="What goes into Today's Focus" />
          <div className="px-4 sm:px-5 pb-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Daily revision target" htmlFor="st-target"><Num id="st-target" value={s.dailyTarget} min={1} max={100} onChange={n => set({ dailyTarget: n })} suffix="problems / day" /></Field>
            <Field label="New problems per day" htmlFor="st-new" hint="Never-reviewed problems added to the focus list from your study plan. 0 turns this off."><Num id="st-new" value={s.focusNewPerDay} min={0} max={20} onChange={n => set({ focusNewPerDay: n })} suffix="per day" /></Field>
            <div className="md:col-span-2 -my-1">
              <Toggle id="st-weak" checked={s.focusIncludeWeak} onChange={v => set({ focusIncludeWeak: v })} label="Include weak problems" hint="Red and Yellow problems scheduled later can fill the remaining slots." />
              {!s.autoPriority && <Toggle id="st-high" checked={s.focusIncludeHigh} onChange={v => set({ focusIncludeHigh: v })} label="Include high-priority problems" hint="Problems you marked High, even when they are not due." />}
            </div>
            <Field label={`Study plan patterns ${s.studyPlanPatternIds.length ? `(${s.studyPlanPatternIds.length})` : '(all active patterns)'}`} className="md:col-span-2" hint="New problems are picked from these patterns, in pattern order.">
              <div className="flex flex-wrap gap-1.5">
                {patterns.filter(p => p.learning !== 'yet_to_learn').map(p => (
                  <button key={p.id} onClick={() => togglePlan(p.id)} aria-pressed={s.studyPlanPatternIds.includes(p.id)}
                    className={cx('rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors', s.studyPlanPatternIds.includes(p.id) ? 'border-interactive bg-accent/15 text-selected' : 'border-line text-muted hover:text-fg hover:border-muted/50')}>{p.name}</button>
                ))}
              </div>
            </Field>
          </div>
        </Card>

        {/* Spaced repetition */}
        <Card>
          <CardHeader title="Spaced repetition" icon={<Sliders size={18} />} sub="How far ahead the next review is scheduled after each rating" />
          <div className="px-4 sm:px-5 pb-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Red → review again in" htmlFor="st-red"><Num id="st-red" value={s.redDays} min={1} onChange={n => set({ redDays: n })} suffix="days" /></Field>
            <Field label="Yellow → review again in" htmlFor="st-yellow"><Num id="st-yellow" value={s.yellowDays} min={1} onChange={n => set({ yellowDays: n })} suffix="days" /></Field>
            <Field label="Green ladder (consecutive greens)" className="md:col-span-2" hint="1st green uses the first step, 2nd green in a row the next, and so on. The last step repeats.">
              <div className="flex flex-wrap items-center gap-2">
                {ladder.map((n, i) => (
                  <div key={i} className="flex items-center gap-1 rounded-xl border border-line bg-surface2 pl-2 pr-1 py-1">
                    <span className="text-[11px] text-muted">{i === 0 ? '1st' : i === 1 ? '2nd' : i === 2 ? '3rd' : `${i + 1}th`}</span>
                    <Num id={`st-ladder-${i}`} value={n} min={1} onChange={v => setLadder(ladder.map((x, j) => (j === i ? v : x)))} />
                    {ladder.length > 1 && <Button size="icon" variant="ghost" aria-label="Remove step" onClick={() => setLadder(ladder.filter((_, j) => j !== i))}><X size={13} /></Button>}
                    {i < ladder.length - 1 && <span className="text-muted">→</span>}
                  </div>
                ))}
                <Button size="sm" variant="outline" onClick={() => setLadder([...ladder, (ladder[ladder.length - 1] ?? 30) * 2])}><Plus size={13} />Step</Button>
              </div>
            </Field>
            <Field label="Mastered after" htmlFor="st-mastery" hint="Consecutive greens needed for the Mastered status."><Num id="st-mastery" value={s.masteryStreak} min={1} max={20} onChange={n => set({ masteryStreak: n })} suffix="greens in a row" /></Field>
            <Field label="Solved-while-learning → first review in" htmlFor="st-act"><Num id="st-act" value={s.activationDelayDays} min={0} max={30} onChange={n => set({ activationDelayDays: n })} suffix="days after activation" /></Field>
            <div className="md:col-span-2 -my-1">
              <Toggle id="st-yreset" checked={s.yellowResetsStreak} onChange={v => set({ yellowResetsStreak: v })} label="Yellow resets the green streak" hint="Red always resets it. With this off, Yellow keeps the streak but never adds to it." />
              <Toggle id="st-autopri" checked={s.autoPriority} onChange={v => set({ autoPriority: v })} label="Set priority from the rating" hint="Red → High, Yellow → Medium, Green → Low, as in your sheet. Turn off to set priorities yourself: a Priority field, filter, bulk action and a High-priority group in Today's Focus then appear." />
            </div>
            <div className="md:col-span-2 rounded-xl bg-surface2 px-3.5 py-2.5 text-xs text-muted">
              Example: Red +{intervalFor('red', 0, s)}d · Yellow +{intervalFor('yellow', 0, s)}d · Green ×1 +{intervalFor('green', 1, s)}d · ×2 +{intervalFor('green', 2, s)}d · ×3 +{intervalFor('green', 3, s)}d · ×4 +{intervalFor('green', 4, s)}d.
              Changes apply to future ratings; scheduled dates do not move.
            </div>
            <div className="md:col-span-2"><Button size="sm" variant="ghost" onClick={() => set({ redDays: DEFAULT_SETTINGS.redDays, yellowDays: DEFAULT_SETTINGS.yellowDays, greenLadder: DEFAULT_SETTINGS.greenLadder, masteryStreak: DEFAULT_SETTINGS.masteryStreak, yellowResetsStreak: true })}><RotateCcw size={13} />Restore default intervals (1 / 3 / 7 → 14 → 30 → 60)</Button></div>
          </div>
        </Card>

        {/* Practice sessions */}
        <Card>
          <CardHeader title="Practice sessions" icon={<Smartphone size={18} />} />
          <div className="px-4 sm:px-5 pb-5 grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Default session size" htmlFor="st-size"><Num id="st-size" value={s.defaultSessionSize} min={1} max={100} onChange={n => set({ defaultSessionSize: n })} suffix="problems" /></Field>
            <Field label="Default difficulty" htmlFor="st-diff">
              <Select id="st-diff" value={s.defaultDifficulty} onChange={e => set({ defaultDifficulty: e.target.value as DiffChoice })}>
                <option value="all">Mixed</option><option value="Easy">Easy</option><option value="Medium">Medium</option><option value="Hard">Hard</option><option value="easy-medium">Easy + Medium</option>
              </Select>
            </Field>
            <Field label="'Recently revised' means within" htmlFor="st-recent"><Num id="st-recent" value={s.recentDays} min={1} max={30} onChange={n => set({ recentDays: n })} suffix="days" /></Field>
          </div>
        </Card>

        {/* Reminders */}
        <Card>
          <CardHeader title="Reminders" icon={<Bell size={18} />} sub="Shown inside the app. Browser notifications are not available on this page." />
          <div className="px-4 sm:px-5 pb-4">
            <Toggle id="st-n1" checked={s.notifyOverdueBanner} onChange={v => set({ notifyOverdueBanner: v })} label="Overdue banner on the dashboard" />
            <Toggle id="st-n2" checked={s.notifyTargetReminder} onChange={v => set({ notifyTargetReminder: v })} label="Evening reminder when the daily target is not met" hint="Appears after 6 pm on the Today's Progress card." />
          </div>
        </Card>

        {/* Data */}
        <Card>
          <CardHeader title="Data" icon={d.backendKind === 'cloud' ? <Database size={18} /> : <HardDrive size={18} />}
            sub={<span className="inline-flex items-center gap-1.5">{d.backendKind === 'cloud' ? <>Stored in your account, synced across devices</> : <>Stored in this browser only</>}</span>} />
          <div className="px-4 sm:px-5 pb-5 flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={backup}><Download size={15} />Download backup (.json)</Button>
              <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-line px-3.5 text-sm font-semibold text-fg hover:bg-hover transition-colors">
                <Upload size={15} />Restore from backup<input type="file" accept=".json,application/json" className="sr-only" onChange={e => { restore(e.target.files?.[0]); e.target.value = ''; }} />
              </label>
              <Button variant="outline" onClick={() => setCsv('export')}><Download size={15} />Export CSV</Button>
              <Button variant="outline" onClick={() => setCsv('import')}><Upload size={15} />Import CSV</Button>
            </div>
            <p className="text-xs text-muted">A backup holds every problem, revision, session and setting. Restoring replaces what is here.</p>
            <div className="border-t border-line pt-3">
              <Button variant="ghost" className="!text-bad-ink hover:!bg-bad/10" onClick={reset}><Trash2 size={15} />Delete all data and re-run the import</Button>
            </div>
          </div>
        </Card>
      </div>
      <Dialog open={!!fallback} onClose={() => setFallback(null)} title="Copy your backup" width="max-w-2xl" footer={<Button onClick={() => setFallback(null)}>Done</Button>}>
        {fallback && <CopyBox text={fallback} label="The download did not start. Copy this JSON into a file named backup.json." />}
      </Dialog>
      {csv && <CsvDialog mode={csv} onClose={() => setCsv(null)} />}
    </div>
  );
}
