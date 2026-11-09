// Persistence layer. Every backend implements one interface, so the store does not care where data lives.
//  - LocalBackend: browser localStorage.
//  - SupabaseBackend (src/lib/supabase/backend.ts): Supabase tables, with an offline cache and write queue.

export type Col = 'patterns' | 'problems' | 'revisions' | 'sessions';
export const COLS: Col[] = ['patterns', 'problems', 'revisions', 'sessions'];
export type Change = { id: string; data: any | null };

export interface BackendEvents {
  onChanges(col: Col | 'meta', changes: Change[]): void;
  onReady(hasMeta: boolean): void;
  onSlow(): void;
  onError(message: string): void;
  /** A previously reported write-retry error recovered after the queue drained. */
  onWriteRecovered?(): void;
  onPending(n: number): void;
  onOffline?(offline: boolean): void;
}

export interface Backend {
  kind: 'cloud' | 'local';
  start(ev: BackendEvents): void;
  put(col: Col, id: string, data: any): void;
  remove(col: Col, id: string): void;
  putMeta(data: any): void;
  flushed(): Promise<void>;
  /** Stop syncing and remove listeners (sign-out). */
  stop?(): void;
  /** Remove data cached on this device. */
  clearLocal?(): Promise<void>;
}

// ---------------------------------------------------------------------------------------------

const LS_KEY = 'recodex-v1';
const LEGACY_LS_KEY = 'dsa-revision-manager-v1';

export class LocalBackend implements Backend {
  kind = 'local' as const;
  private data: { meta: any | null } & Record<Col, Record<string, any>> = { meta: null, patterns: {}, problems: {}, revisions: {}, sessions: {} };
  private timer: any = null;
  private ev!: BackendEvents;

  start(ev: BackendEvents) {
    this.ev = ev;
    try {
      const raw = localStorage.getItem(LS_KEY) ?? localStorage.getItem(LEGACY_LS_KEY);
      if (raw) this.data = { ...this.data, ...JSON.parse(raw) };
    } catch { /* storage blocked: keep in memory */ }
    if (this.data.meta) ev.onChanges('meta', [{ id: 'meta', data: this.data.meta }]);
    for (const col of COLS) {
      const ch = Object.entries(this.data[col]).map(([id, data]) => ({ id, data }));
      if (ch.length) ev.onChanges(col, ch);
    }
    setTimeout(() => ev.onReady(!!this.data.meta), 0);
  }
  private save() {
    clearTimeout(this.timer);
    this.ev?.onPending(1);
    this.timer = setTimeout(() => {
      try { localStorage.setItem(LS_KEY, JSON.stringify(this.data)); }
      catch { this.ev?.onError('This browser blocked local storage, so changes last only until you close the page. Export a backup to keep them.'); }
      this.ev?.onPending(0);
    }, 250);
  }
  put(col: Col, id: string, data: any) { this.data[col][id] = data; this.save(); }
  remove(col: Col, id: string) { delete this.data[col][id]; this.save(); }
  putMeta(data: any) { this.data.meta = data; this.save(); }
  flushed() { return new Promise<void>(r => setTimeout(r, 300)); }
}

