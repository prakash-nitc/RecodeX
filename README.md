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

## Where things live

- `src/lib/engine.ts`: revision engine (intervals, green ladder, phases, Today's Focus, mixed-session generation)
- `src/lib/store.ts`: in-memory state and every mutation (optimistic updates)
- `src/lib/backend.ts`: the `Backend` interface; data is currently kept in localStorage
- `src/seed.ts`: initial problem data for the first-run import screen
- `schema.sql`: draft Supabase schema

Dates are local calendar days stored as `YYYY-MM-DD` strings.

Full setup, Supabase, deployment and install instructions arrive as the build plan progresses (see `RECODEX_BUILD_PLAN.md`).
