import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  LayoutDashboard, Library, CalendarCheck, Shuffle, Shapes, GraduationCap, History as HistoryIcon, BarChart3, Settings as SettingsIcon,
  PanelLeftClose, PanelLeftOpen, Menu, Plus, Cloud, CloudOff, HardDrive, Loader2, X, Play,
} from 'lucide-react';
import { useData, settingsOf, clearError } from './lib/store';
import { buildFocus } from './lib/engine';
import { applyTheme } from './lib/theme';
import { today } from './lib/dates';
import { UiProvider, Button, cx, Spinner } from './components/ui';
import { AppProvider, useApp } from './components/shared';
import { BrandLockup, BrandMark } from './components/Brand';
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
  const [collapsed, setCollapsed] = useState(lsGet('recodex-sidebar') === '1');
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => { if (d.meta) applyTheme(s.theme); }, [s.theme, !!d.meta]);
  useEffect(() => setMobileOpen(false), [route]);
  const t = today();
  const queue = useMemo(() => d.status === 'ready' ? buildFocus(Object.values(d.problems), d.patterns, s, t).filter(f => f.problem.lastRevised !== t).length : 0, [d.problems, d.patterns, d.status, d.meta]);
  const running = Object.values(d.sessions).find(x => x.status === 'in_progress');

  if (d.status === 'booting' || d.status === 'slow') {
    return (
      <div className="flex min-h-[80vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <BrandMark size={44} className="animate-pulse" />
        <Spinner size={22} />
        <div className="font-display text-lg font-semibold text-fg">Loading your revision data</div>
        {d.error ? <p className="max-w-md text-sm text-bad-ink">{d.error}</p>
          : d.status === 'slow' && <p className="max-w-sm text-sm text-muted">{d.offline ? 'You are offline and this device has no saved copy yet. Connect once to load your data.' : 'The database is taking longer than usual to answer. It keeps trying; check your connection if this stays.'}</p>}
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

  const nav = (compact: boolean) => (
    <nav className="flex flex-col gap-0.5" aria-label="Main">
      {NAV.map(n => {
        const Icon = n.icon; const on = sec === n.id;
        const badge = n.id === 'today' && queue > 0 ? queue : n.id === 'learn' ? Object.values(d.patterns).filter(p => p.learning === 'yet_to_learn' || p.learning === 'learning').length || null : null;
        return (
          <button key={n.id} onClick={() => go(n.id)} title={compact ? n.label : undefined} aria-current={on ? 'page' : undefined}
            className={cx('group relative flex items-center gap-3 rounded-xl h-10 text-sm font-semibold transition-colors', compact ? 'justify-center px-0' : 'px-3',
              on ? 'bg-accent/12 text-accent-ink' : 'text-muted hover:text-fg hover:bg-surface2')}>
            {on && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-accent" aria-hidden />}
            <Icon size={18} className="shrink-0" />
            {!compact && <span className="flex-1 text-left truncate">{n.label}</span>}
            {!compact && badge ? <span className={cx('rounded-lg px-1.5 text-[11px] font-bold tabular-nums', n.id === 'today' ? 'bg-hot/20 text-hot-ink' : 'bg-surface2 text-muted')}>{badge}</span> : null}
            {compact && badge && n.id === 'today' ? <span className="absolute top-1.5 right-2 h-2 w-2 rounded-full bg-hot" aria-hidden /> : null}
          </button>
        );
      })}
    </nav>
  );
  const syncChip = (compact: boolean) => (
    <div className={cx('flex items-center gap-2 text-[11px] text-muted', compact && 'justify-center')} title={d.backendKind === 'cloud' ? (d.offline ? 'Offline: changes are kept on this device and sent when you are back online' : 'Synced to your account') : 'Saved in this browser only'}>
      {d.backendKind === 'cloud' && d.offline ? <CloudOff size={13} className="text-hot-ink" /> : d.pending > 0 ? <Loader2 size={13} className="animate-spin text-accent-ink" /> : d.backendKind === 'cloud' ? <Cloud size={13} className="text-ok-ink" /> : <HardDrive size={13} className="text-muted" />}
      {!compact && <span>{d.backendKind === 'cloud' && d.offline ? (d.pending > 0 ? `Offline · ${d.pending} waiting` : 'Offline') : d.pending > 0 ? `Saving ${d.pending}…` : d.backendKind === 'cloud' ? 'All changes saved' : 'Saved in this browser'}</span>}
    </div>
  );

  return (
    <div className="min-h-full lg:flex">
      <aside className={cx('hidden lg:flex sticky top-0 h-screen shrink-0 flex-col gap-6 border-r border-line bg-surface py-5 side-pad transition-[width] duration-200', collapsed ? 'w-[72px] px-3 items-center' : 'w-64 px-4')}>
        <button onClick={() => go('dashboard')} className="text-left" aria-label="RecodeX dashboard"><BrandLockup collapsed={collapsed} /></button>
        <Button variant="primary" size="md" className={cx('h-10', collapsed ? '!px-0 w-10' : 'w-full')} onClick={() => addProblemDialog()} title="Add problem"><Plus size={16} />{!collapsed && 'Add problem'}</Button>
        <div className={cx(collapsed && 'w-full')}>{nav(collapsed)}</div>
        <div className={cx('mt-auto flex flex-col gap-3', collapsed && 'w-full')}>
          {running && <button onClick={() => go('session')} className={cx('flex items-center gap-2 rounded-xl border border-accent/40 bg-accent/10 text-xs font-semibold text-accent-ink h-10', collapsed ? 'justify-center' : 'px-3')}><Play size={14} />{!collapsed && 'Resume session'}</button>}
          {syncChip(collapsed)}
          <button onClick={() => { setCollapsed(!collapsed); lsSet('recodex-sidebar', collapsed ? '0' : '1'); }} className={cx('flex items-center gap-2 rounded-xl h-8 text-xs text-muted hover:text-fg hover:bg-surface2', collapsed ? 'justify-center' : 'px-3')} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            {collapsed ? <PanelLeftOpen size={16} /> : <><PanelLeftClose size={16} />Collapse</>}
          </button>
        </div>
      </aside>

      <header className="lg:hidden sticky z-30 flex items-center justify-between gap-2 border-b border-line bg-surface/90 backdrop-blur-md h-14 mobile-bar">
        <div className="flex items-center gap-1.5 min-w-0">
          <Button size="icon" variant="ghost" aria-label="Open menu" onClick={() => setMobileOpen(true)}><Menu size={19} /></Button>
          <button onClick={() => go('dashboard')} className="flex items-center gap-2" aria-label="RecodeX dashboard">
            <BrandMark size={26} /><span className="font-display text-[17px] font-semibold text-fg">Recode<span className="text-accent-ink">X</span></span>
          </button>
        </div>
        <div className="flex items-center gap-2">{syncChip(true)}<Button size="icon" variant="primary" className="h-9 w-9" aria-label="Add problem" onClick={() => addProblemDialog()}><Plus size={16} /></Button></div>
      </header>
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-[rgb(11_16_32/0.5)] backdrop-blur-[2px]" onMouseDown={e => { if (e.target === e.currentTarget) setMobileOpen(false); }}>
          <div className="h-full w-72 max-w-[85%] bg-surface border-r border-line p-4 flex flex-col gap-5 drawer-left animate-page-in overflow-y-auto">
            <div className="flex items-center justify-between"><BrandLockup /><Button size="icon" variant="ghost" aria-label="Close menu" onClick={() => setMobileOpen(false)}><X size={16} /></Button></div>
            {nav(false)}
            {running && <Button variant="outline" onClick={() => go('session')}><Play size={14} />Resume session</Button>}
            <div className="mt-auto">{syncChip(false)}</div>
          </div>
        </div>
      )}

      <main className="flex-1 min-w-0 page-gutter py-5 lg:py-8">
        {d.error && (
          <div className="mb-4 flex items-start justify-between gap-3 rounded-2xl border border-bad/40 bg-bad/10 px-4 py-3 text-sm text-fg" role="alert">
            <span>{d.error}</span><Button size="icon" variant="ghost" aria-label="Dismiss" onClick={clearError}><X size={14} /></Button>
          </div>
        )}
        {d.backendKind === 'local' && lsGet('recodex-local-note') !== '1' && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-fg">
            <span className="flex items-center gap-2"><HardDrive size={15} className="text-muted shrink-0" />Your data is saved in this browser only. Download a backup from Settings now and then so you do not lose it.</span>
            <Button size="sm" variant="ghost" onClick={() => { lsSet('recodex-local-note', '1'); go(route); }}>Got it</Button>
          </div>
        )}
        <div key={route} className="mx-auto max-w-[1400px] animate-page-in">{page}</div>
      </main>
      {d.pending > 15 && !d.offline && (
        <div className="fixed z-[70] bottom-0 left-0 toast-pad pointer-events-none">
          <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-5 py-4 shadow-pop">
            <Spinner /><div><div className="font-semibold text-fg">Saving your problem bank</div><div className="text-xs text-muted tabular-nums">{d.pending} records left</div></div>
          </div>
        </div>
      )}
    </div>
  );
}
