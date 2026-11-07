# DSA Revision Manager

React 18 + TypeScript + Tailwind + Recharts + Lucide + date-fns, bundled with esbuild into one HTML file.

- `npm install` then `node build.mjs` → `dist/index.html`
- `npx tsc -p .` type-checks the project
- Data layer: `src/lib/backend.ts` (Artifact database or localStorage behind one `Backend` interface)
- Revision engine: `src/lib/engine.ts` (intervals, phases, Today's Focus, mixed-session generation)
- Seed data from the Revision Master PDF: `src/seed.ts`
- Supabase schema for a later migration: `schema.sql`
