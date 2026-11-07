// Plain sign-in page (restyled with the artwork in Phase 3): email + password, or a magic link.
import React, { useState } from 'react';
import { Mail, LogIn, UserPlus } from 'lucide-react';
import { supabase, authRedirectUrl } from '../lib/supabase/client';
import { Button, Card, Field, Input, Segmented } from '../components/ui';

type Mode = 'signin' | 'signup' | 'magic';

function friendly(msg: string): string {
  if (/invalid login credentials/i.test(msg)) return 'That email and password do not match. Check them, or use a magic link instead.';
  if (/email not confirmed/i.test(msg)) return 'Confirm your email first: open the link we sent you, then sign in.';
  if (/user already registered/i.test(msg)) return 'An account with this email already exists. Sign in instead.';
  if (/rate limit|too many/i.test(msg)) return 'Too many emails were requested. Wait a few minutes and try again.';
  if (/password should be/i.test(msg)) return msg;
  if (/failed to fetch|network/i.test(msg)) return 'Could not reach the server. Check your connection and try again.';
  return msg;
}

export default function SignIn() {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      const addr = email.trim();
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email: addr, password });
        if (error) throw error;
      } else if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email: addr, password, options: { emailRedirectTo: authRedirectUrl() } });
        if (error) throw error;
        if (!data.session) setNotice(`We sent a confirmation link to ${addr}. Open it on this device to finish creating your account.`);
      } else {
        const { error } = await supabase.auth.signInWithOtp({ email: addr, options: { emailRedirectTo: authRedirectUrl() } });
        if (error) throw error;
        setNotice(`We sent a sign-in link to ${addr}. Open it in this browser to sign in.`);
      }
    } catch (err: any) {
      setError(friendly(String(err?.message ?? err)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-10 page-gutter">
      <Card className="w-full max-w-sm p-6">
        <div className="mb-6 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-accentfg font-display font-extrabold text-sm">RX</div>
          <div>
            <h1 className="font-display text-xl font-extrabold text-fg leading-tight">RecodeX</h1>
            <p className="text-xs text-muted">Sign in to your revision data</p>
          </div>
        </div>
        <div className="mb-5">
          <Segmented ariaLabel="Sign-in method" size="sm" value={mode} onChange={m => { setMode(m); setError(null); setNotice(null); }}
            options={[{ value: 'signin', label: 'Sign in' }, { value: 'signup', label: 'Create account' }, { value: 'magic', label: 'Magic link' }]} />
        </div>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field label="Email" htmlFor="si-email">
            <Input id="si-email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} />
          </Field>
          {mode !== 'magic' && (
            <Field label="Password" htmlFor="si-password" hint={mode === 'signup' ? 'At least 6 characters.' : undefined}>
              <Input id="si-password" type="password" required minLength={6} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                value={password} onChange={e => setPassword(e.target.value)} />
            </Field>
          )}
          {error && <p role="alert" className="rounded-lg border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-fg">{error}</p>}
          {notice && <p role="status" className="rounded-lg border border-ok/40 bg-ok/10 px-3 py-2 text-sm text-fg">{notice}</p>}
          <Button type="submit" variant="primary" size="lg" disabled={busy}>
            {mode === 'signin' ? <><LogIn size={16} />Sign in</> : mode === 'signup' ? <><UserPlus size={16} />Create account</> : <><Mail size={16} />Email me a sign-in link</>}
          </Button>
        </form>
        {mode === 'signin' && <p className="mt-4 text-xs text-muted">Forgot your password? Use <button className="font-semibold text-accent hover:underline" onClick={() => setMode('magic')}>a magic link</button>, then set a new one in Settings.</p>}
      </Card>
    </div>
  );
}
