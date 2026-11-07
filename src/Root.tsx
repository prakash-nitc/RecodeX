// Chooses the data backend. With Supabase configured every route sits behind sign-in;
// without it (no .env) the app runs on localStorage, as before.
import React, { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import App from './App';
import SignIn from './pages/SignIn';
import { Spinner } from './components/ui';
import { boot, shutdown } from './lib/store';
import { LocalBackend } from './lib/backend';
import { supabase } from './lib/supabase/client';
import { SupabaseBackend } from './lib/supabase/backend';

const LAST_UID = 'recodex-last-uid';
const lsGet = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k: string, v: string | null) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* ignore */ } };

export default function Root() {
  return supabase ? <CloudRoot /> : <LocalRoot />;
}

function LocalRoot() {
  useState(() => { boot(new LocalBackend()); return null; });
  return <App />;
}

function CloudRoot() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const { data } = supabase!.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'SIGNED_OUT') lsSet(LAST_UID, null);
      // Remove ?code=… left by a magic link or confirmation email once the session exists.
      if (s && new URLSearchParams(location.search).has('code')) history.replaceState(null, '', location.pathname + location.hash);
    });
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { data.subscription.unsubscribe(); window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  // Opened offline with a session that could not be refreshed: show the cached data of the last account.
  const offlineUid = session === null && !online ? lsGet(LAST_UID) : null;
  const uid = session?.user.id ?? offlineUid ?? null;

  useEffect(() => {
    if (!uid) return;
    lsSet(LAST_UID, uid);
    boot(new SupabaseBackend(supabase!, uid));
    return () => { void shutdown(); };
  }, [uid]);

  if (session === undefined) {
    return <div className="flex min-h-[80vh] items-center justify-center"><Spinner size={28} /></div>;
  }
  if (!uid) return <SignIn />;
  return <App />;
}
