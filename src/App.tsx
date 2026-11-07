import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  LayoutDashboard, Library, CalendarCheck, Shuffle, Shapes, GraduationCap, History as HistoryIcon, BarChart3, Settings as SettingsIcon,
  PanelLeftClose, PanelLeftOpen, Menu, Plus, Cloud, HardDrive, Loader2, X, Play,
} from 'lucide-react';
import { useData, settingsOf, clearError } from './lib/store';
import { buildFocus } from './lib/engine';
import { applyTheme } from './lib/theme';
import { today } from './lib/dates';
import { UiProvider, Button, cx, Spinner } from './components/ui';
import { AppProvider, useApp } from './components/shared';
import Dashboard from './pages/Dashboard';
import Today from './pages/Today';
import ProblemBank from './pages/ProblemBank';
import Practice from './pages/Practice';
import Patterns, { PatternDetail } from './pages/Patterns';
import Learn from './pages/Learn';
import History from './pages/History';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import SessionPage from './pages/Session';
import ImportReview from './pages/ImportReview';

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'bank', label: 'Problem Bank', icon: Library },
  { id: 'today', label: "Today's Revision", icon: CalendarCheck },
  { id: 'practice', label: 'Mixed Practice', icon: Shuffle },
  { id: 'patterns', label: 'Patterns', icon: Shapes },
  { id: 'learn', label: 'Yet to Learn', icon: GraduationCap },
  { id: 'history', label: 'Revision History', icon: HistoryIcon },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'prefs', label: 'Settings', icon: SettingsIcon },
];

function readHash() { const h = decodeURIComponent(location.hash.replace(/^#/, '')); return h || 'dashboard'; }
function section(route: string) {
  if (route.startsWith('pattern-')) return 'patterns';
  if (route.startsWith('practice')) return 'practice';
  if (route.startsWith('bank')) return 'bank';
  if (route.startsWith('history')) return 'history';
  if (route.startsWith('summary-') || route === 'session') return 'practice';
  return route;
}
const lsGet = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } };

export default function App() {
  const [route, setRoute] = useState(readHash());
  useEffect(() => {
    const h = () => { setRoute(readHash()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, []);
  const go = useCallback((r: string) => { if (readHash() === r) setRoute(r); else location.hash = r; }, []);
  return (
    <UiProvider>
      <AppProvider route={route} go={go}><Shell /></AppProvider>
    </UiProvider>
  );
}

function Shell() {
  const d = useData(); const s = settingsOf(d);
  const { route, go, addProblemDialog } = useApp();
  const [collapsed, setCollapsed] = useState(lsGet('dsa-sidebar') === '1');
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => { if (d.meta) applyTheme(s.theme); }, [s.theme, !!d.meta]);
  useEffect(() => setMobileOpen(false), [route]);
  const t = today();
  const queue = useMemo(() => d.status === 'ready' ? buildFocus(Object.values(d.problems), d.patterns, s, t).filter(f => f.problem.lastRevised !== t).length : 0, [d.problems, d.patterns, d.status, d.meta]);
  const running = Object.values(d.sessions).find(x => x.status === 'in_progress');

  if (d.status === 'booting' || d.status === 'slow') {
    return (
      <div className="flex min-h-[80vh] flex-col items-center justify-center gap-3 px-6 text-center">
        <Spinner size={28} />
        <div className="font-display text-lg font-bold text-fg">Loading your revision data</div>
        {d.status === 'slow' && <p className="max-w-sm text-sm text-muted">The database is taking longer than usual to answer. It keeps trying; check your connection if this stays.</p>}
      </div>
    );
  }
  if (d.needsImport) return <div className="px-4 py-8 sm:px-8 page-gutter"><ImportReview /></div>;

  const sec = section(route);
  const page = (() => {
    if (route === 'dashboard') return <Dashboard />;
    if (route === 'bank') return <ProblemBank />;
    if (route === 'bank-high') return <ProblemBank initial={{ priority: 'High' }} />;
    if (route === 'today') return <Today />;
    if (route === 'practice') return <Practice />;
    if (route.startsWith('practice-')) return <Practice preset={route.slice(9)} />;
    if (route === 'patterns') return <Patterns />;
    if (route.startsWith('pattern-')) return <PatternDetail id={`pt-${route.slice(8)}`} />;
    if (route === 'learn') return <Learn />;
    if (route === 'history') return <History />;
    if (route === 'history-sessions') return <History initialTab="sessions" />;
    if (route === 'analytics') return <Analytics />;
    if (route === 'prefs') return <Settings />;
    if (route === 'session') return <SessionPage />;
    if (route.startsWith('summary-')) return <SessionPage summaryId={route.slice(8)} />;
    return <Dashboard />;
  })();

  const nav = (
    <nav className="flex flex-col gap-0.5" aria-label="Main">
      {NAV.map(n => {
        const Icon = n.icon; const on = sec === n.id;
        const badge = n.id === 'today' && queue > 0 ? queue : n.id === 'learn' ? Object.values(d.patterns).filter(p => p.learning === 'yet_to_learn' || p.learning === 'learning').length || null : null;
        return (
          <button key={n.id} onClick={() => go(n.id)} title={collapsed ? n.label : undefined} aria-current={on ? 'page' : undefined}
            className={cx('group flex items-center gap-3 rounded-lg h-9 text-sm font-semibold transition-colors', collapsed ? 'justify-center px-0' : 'px-3',
              on ? 'bg-accent/15 text-accent' : 'text-muted hover:text-fg hover:bg-surface2')}>
            <Icon size={17} className="shrink-0" />
            {!collapsed && <span className="flex-1 text-left truncate">{n.label}</span>}
            {!collapsed && badge ? <span className={cx('rounded-md px-1.5 text-[11px] font-bold tabular-nums', n.id === 'today' ? 'bg-bad/15 text-bad' : 'bg-surface2 text-muted')}>{badge}</span> : null}
          </button>
        );
      })}
    </nav>
  );
  const syncChip = (
    <div className={cx('flex items-center gap-2 text-[11px] text-muted', collapsed && 'justify-center')} title={d.backendKind === 'cloud' ? 'Saved to your private Artifact database' : 'Saved in this browser only'}>
      {d.pending > 0 ? <Loader2 size={13} className="animate-spin text-accent" /> : d.backendKind === 'cloud' ? <Cloud size={13} className="text-ok" /> : <HardDrive size={13} className="text-warn" />}
      {!collapsed && <span>{d.pending > 0 ? `Saving ${d.pending}…` : d.backendKind === 'cloud' ? 'All changes saved' : 'Saved in this browser'}</span>}
    </div>
  );
  const brand = (
    <div className={cx('flex items-center gap-2.5', collapsed && 'justify-center')}>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-accentfg font-display font-extrabold text-sm">DR</div>
      {!collapsed && <div className="min-w-0"><div className="font-display text-[15px] font-extrabold leading-tight text-fg">DSA Revision</div><div className="text-[11px] text-muted">Placement season</div></div>}
    </div>
  );

  return (
    <div className="min-h-full lg:flex">
      <aside className={cx('hidden lg:flex sticky top-0 h-screen shrink-0 flex-col gap-5 border-r border-line bg-surface py-4 side-pad transition-[width]', collapsed ? 'w-[68px] px-2.5' : 'w-60 px-3')}>
        {brand}
        <Button variant="primary" size="md" className={collapsed ? '!px-0' : ''} onClick={() => addProblemDialog()} title="Add problem"><Plus size={16} />{!collapsed && 'Add problem'}</Button>
        {nav}
        <div className="mt-auto flex flex-col gap-3">
          {running && <button onClick={() => go('session')} className={cx('flex items-center gap-2 rounded-lg border border-accent/40 bg-accent/10 text-xs font-semibold text-accent h-9', collapsed ? 'justify-center' : 'px-3')}><Play size={14} />{!collapsed && 'Resume session'}</button>}
          {syncChip}
          <button onClick={() => { setCollapsed(!collapsed); lsSet('dsa-sidebar', collapsed ? '0' : '1'); }} className={cx('flex items-center gap-2 rounded-lg h-8 text-xs text-muted hover:text-fg hover:bg-surface2', collapsed ? 'justify-center' : 'px-3')} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            {collapsed ? <PanelLeftOpen size={16} /> : <><PanelLeftClose size={16} />Collapse</>}
          </button>
        </div>
      </aside>

      <header className="lg:hidden sticky z-30 flex items-center justify-between gap-2 border-b border-line bg-surface/95 backdrop-blur h-14 mobile-bar">
        <div className="flex items-center gap-2">
          <Button size="icon" variant="ghost" aria-label="Open menu" onClick={() => setMobileOpen(true)}><Menu size={18} /></Button>
          <span className="font-display font-extrabold text-fg">DSA Revision</span>
        </div>
        <div className="flex items-center gap-2">{syncChip}<Button size="icon" variant="primary" aria-label="Add problem" onClick={() => addProblemDialog()}><Plus size={16} /></Button></div>
      </header>
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/50" onMouseDown={e => { if (e.target === e.currentTarget) setMobileOpen(false); }}>
          <div className="h-full w-72 max-w-[85%] bg-surface border-r border-line p-4 flex flex-col gap-5 drawer-left">
            <div className="flex items-center justify-between">{brand}<Button size="icon" variant="ghost" aria-label="Close menu" onClick={() => setMobileOpen(false)}><X size={16} /></Button></div>
            {nav}
            {running && <Button variant="outline" onClick={() => go('session')}><Play size={14} />Resume session</Button>}
          </div>
        </div>
      )}

      <main className="flex-1 min-w-0 page-gutter py-6 lg:py-8">
        {d.error && (
          <div className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-bad/40 bg-bad/10 px-4 py-3 text-sm text-fg">
            <span>{d.error}</span><Button size="icon" variant="ghost" aria-label="Dismiss" onClick={clearError}><X size={14} /></Button>
          </div>
        )}
        {d.backendKind === 'local' && lsGet('dsa-local-note') !== '1' && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-fg">
            <span>Your data is saved in this browser only, because the synced database is not available in this view. Open the app from its claude.ai link while signed in to sync across devices, and download a backup from Settings now and then.</span>
            <Button size="sm" variant="ghost" onClick={() => { lsSet('dsa-local-note', '1'); go(route); }}>Got it</Button>
          </div>
        )}
        <div className="mx-auto max-w-[1400px]">{page}</div>
      </main>
      {d.pending > 15 && (
        <div className="fixed z-[70] bottom-0 left-0 toast-pad pointer-events-none">
          <div className="flex items-center gap-3 rounded-xl border border-line bg-surface px-5 py-4 shadow-pop">
            <Spinner /><div><div className="font-semibold text-fg">Saving your problem bank</div><div className="text-xs text-muted tabular-nums">{d.pending} records left</div></div>
          </div>
        </div>
      )}
    </div>
  );
}
