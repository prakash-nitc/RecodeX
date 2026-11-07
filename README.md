# RecodeX

A personal spaced-repetition app for revising data structures and algorithms problems.

React 18 + TypeScript + Tailwind + Recharts + Lucide + date-fns, built with Vite.

## Develop

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # Vitest unit tests (engine, dates, CSV)
npx tsc            # type-check
npm run build      # production build in dist/
```

## Supabase

1. Create a Supabase project and copy `.env.example` to `.env` with the Project URL and the publishable (anon) key. Never use the secret / service_role key in the app.
2. In the Supabase SQL Editor, run `supabase/migrations/20261107000000_init.sql`.
3. Authentication → URL Configuration: set Site URL to your app URL and add `http://localhost:5173/**` (and later the deployed URL) to Redirect URLs, so magic links and confirmation emails come back to the app.

Without `.env` the app runs on localStorage with no sign-in.

Data sync: the app opens from a copy cached on the device (IndexedDB), fetches only rows changed since the last sync, refetches when the window regains focus, and queues writes (persisted, retried, sent in chunks) so it keeps working offline.

## Where things live

- `src/lib/engine.ts`: revision engine (intervals, green ladder, phases, Today's Focus, mixed-session generation)
- `src/lib/store.ts`: in-memory state and every mutation (optimistic updates)
- `src/lib/backend.ts`: the `Backend` interface and the localStorage backend
- `src/lib/supabase/`: Supabase client, camelCase ↔ snake_case mapping, and `SupabaseBackend` (cache, sync, write queue)
- `supabase/migrations/`: database schema with row-level security (tested in PGlite by `supabase/schema.test.ts`)
- `src/seed.ts`: initial problem data for the first-run import screen

Dates are local calendar days stored as `YYYY-MM-DD` strings.

Full setup, Supabase, deployment and install instructions arrive as the build plan progresses (see `RECODEX_BUILD_PLAN.md`).
