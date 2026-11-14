// Sign-in page: email + password, or a magic link, beside the mountain artwork.
import React, { useState } from 'react';
import { Mail, LogIn, UserPlus } from 'lucide-react';
import { supabase, authRedirectUrl } from '../lib/supabase/client';
import { Button, Field, Input, Segmented } from '../components/ui';
import { MountainScene } from '../components/art/Mountains';
import { BrandMark } from '../components/Brand';

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
    <div className="min-h-screen lg:grid lg:grid-cols-[1.15fr_1fr]">
      <section className="relative h-[230px] sm:h-[300px] lg:h-auto lg:min-h-screen overflow-hidden" aria-label="RecodeX">
        <MountainScene className="absolute inset-0 h-full w-full" />
        <div className="absolute inset-0 bg-gradient-to-t from-scrim/[0.7] via-scrim/[0.25] to-scrim/[0.15] lg:bg-gradient-to-r lg:from-scrim/[0.65] lg:via-scrim/[0.3] lg:to-transparent" />
        <div className="relative flex h-full flex-col justify-between p-6 sm:p-10 text-onart [text-shadow:0_1px_14px_rgb(0_0_0/0.35)]">
          <div className="flex items-center gap-2.5">
            <BrandMark size={36} />
            <span className="font-display text-2xl font-semibold tracking-tight">RecodeX</span>
          </div>
          <div className="max-w-lg">
            <h1 className="font-display text-[26px] sm:text-4xl lg:text-5xl font-semibold leading-[1.1] tracking-tight text-balance">
              Recode. Revise. Reinforce. Repeat. <span className="headline-accent [text-shadow:none]">Master.</span>
            </h1>
            <p className="mt-3 hidden sm:block text-[15px] text-onart/85 leading-relaxed">A calm, daily training ground for problem solving. Spaced repetition decides what to revise; you just show up.</p>
          </div>
        </div>
      </section>

      <div className="flex items-start lg:items-center justify-center px-4 py-8 sm:py-12 page-gutter">
        <div className="w-full max-w-sm">
          <h2 className="font-display text-[28px] font-semibold text-fg leading-tight">{mode === 'signup' ? 'Begin your journey' : 'Welcome back'}</h2>
          <p className="mt-1 text-sm text-muted">{mode === 'signup' ? 'Create an account to keep your revision data in sync.' : mode === 'magic' ? 'We will email you a one-time sign-in link.' : 'Sign in to continue where you left off.'}</p>
          <div className="mt-6 mb-5">
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
            {error && <p role="alert" className="rounded-xl border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-fg">{error}</p>}
            {notice && <p role="status" className="rounded-xl border border-ok/40 bg-ok/10 px-3 py-2 text-sm text-fg">{notice}</p>}
            <Button type="submit" variant="primary" size="lg" disabled={busy}>
              {mode === 'signin' ? <><LogIn size={16} />Sign in</> : mode === 'signup' ? <><UserPlus size={16} />Create account</> : <><Mail size={16} />Email me a sign-in link</>}
            </Button>
          </form>
          {mode === 'signin' && <p className="mt-4 text-xs text-muted">Forgot your password? Use <button className="font-semibold text-accent-ink hover:underline" onClick={() => setMode('magic')}>a magic link</button>, then set a new one in Settings.</p>}
        </div>
      </div>
    </div>
  );
}
