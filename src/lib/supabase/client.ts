import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** True when the app is built with Supabase settings; otherwise it runs on localStorage without sign-in. */
export const supabaseConfigured = !!(url && key);

export const supabase: SupabaseClient | null = supabaseConfigured
  ? createClient(url!, key!, {
    auth: {
      // PKCE puts the sign-in code in ?code=… instead of the URL hash, which the app uses for routing.
      flowType: 'pkce',
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'recodex-auth',
    },
  })
  : null;

/** Where magic links and confirmation emails return to: the app itself, without any hash route. */
export function authRedirectUrl() {
  return `${window.location.origin}${window.location.pathname}`;
}
