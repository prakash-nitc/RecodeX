import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X, Download } from 'lucide-react';
import { Button } from './ui';

export function ReloadPrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      if (r) {
        // Check for updates every hour
        setInterval(() => {
          r.update().catch(() => {});
        }, 60 * 60 * 1000);
      }
    },
    onRegisterError(error) {
      console.warn('[RecodeX PWA] Service worker registration error:', error);
    },
  });

  if (!needRefresh) return null;

  return (
    <div className="fixed z-[75] bottom-4 left-4 right-4 sm:left-auto sm:right-6 max-w-md animate-pop-in">
      <div className="flex items-center gap-3 rounded-2xl border border-accent/40 bg-surface p-4 shadow-pop">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent-ink">
          <RefreshCw size={18} className="animate-spin" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-fg">Update available</div>
          <div className="text-xs text-muted mt-0.5">A new version of RecodeX is ready.</div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button size="sm" variant="primary" onClick={() => updateServiceWorker(true)}>
            Reload
          </Button>
          <Button size="icon" variant="ghost" onClick={() => setNeedRefresh(false)} aria-label="Dismiss">
            <X size={15} />
          </Button>
        </div>
      </div>
    </div>
  );
}

