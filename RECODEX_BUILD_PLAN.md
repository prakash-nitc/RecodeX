# RecodeX Build Plan

This folder holds my DSA revision app, currently called "DSA Revision Manager". It is React 18 + TypeScript + Tailwind + Recharts + Lucide + date-fns, bundled by esbuild into one HTML file (`build.mjs`) that ran as a claude.ai artifact.

Turn it into **RecodeX**: a deployed app with my own URL, data in Supabase, an installable desktop and phone app (PWA), and a complete visual redesign called "The Journey to Mastery".

## How to work

- Read the code before changing anything. Key files:
  - `src/types.ts`: domain types (Pattern, Problem, Revision, Session, Settings)
  - `src/lib/engine.ts`: revision engine (spaced repetition, phases, Today's Focus, mixed-session generation)
  - `src/lib/store.ts`: in-memory state and every mutation (optimistic updates)
  - `src/lib/backend.ts`: `Backend` interface with `CloudBackend` (claude.ai artifact DB) and `LocalBackend` (localStorage)
  - `src/seed.ts`: my initial problem data, used by the first-run import screen
  - `schema.sql`: draft Supabase schema
- Go one phase at a time, in order. Commit at the end of each phase with a clear message.
- Each phase ends with a **Done when** checklist. Check every item before moving on, and tell me the result.
- **STOP** markers mean: stop and tell me exactly what to do (an account, a key, a click), then wait for me.
- Never change the behaviour of `engine.ts` or remove a working feature. If something is broken, fix it and tell me what was wrong.
- Dates are local calendar days stored as `'YYYY-MM-DD'` strings (Postgres `date`). Never pass them through `new Date()` or `toISOString()` in a way that can shift the day. I am in Asia/Kolkata (UTC+5:30).

---

## Phase 1: Vite migration and safety net

1. Convert to a standard Vite + React + TypeScript project. Keep the `src` structure and Tailwind setup. `build.mjs` and the single-file build can go.
2. Remove everything that depends on claude.ai:
   - `window.claude` in `backend.ts` (`createBackend`, `getDownloads`)
   - the downloads capability in `CsvDialog.tsx` `saveFile` (replace with a normal Blob + `<a download>`)
   - copy that mentions claude.ai or "Artifact database" (banners in `App.tsx`, the Data card in Settings)
3. Rename the app to **RecodeX** everywhere (page title, sidebar brand, README). Remove the "Placement season" subtitle and any other placement-specific wording.
4. Add Vitest and write unit tests for `engine.ts` now, before any other refactoring. Cover the Red/Yellow/Green intervals, the green ladder, Red and Yellow streak resets, overdue detection, phase suggestion, Today's Focus ordering, and round-robin pattern mixing in `generateSession`. Also test the CSV parser in `src/lib/csv.ts`.

**Done when**
- [ ] `npm run dev` runs the app and it works as before, on localStorage
- [ ] `npx tsc` is clean and `npm test` passes
- [ ] No `window.claude` references remain

---

## Phase 2: Supabase

**STOP** first: ask me to create a Supabase project and put `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env`.

1. Review `schema.sql` against `src/types.ts` and fix mismatches. For example, `Session.results` lives inside the session in the app, so use a jsonb column or the `session_results` table, whichever is simpler. Put the schema in `supabase/migrations/`. Every table gets row-level security so a user sees only their own rows.
2. Auth: email + password and magic link, all routes behind sign-in. Keep the sign-in page plain for now; Phase 3 restyles it.
3. Write `SupabaseBackend` implementing the existing `Backend` interface:
   - map camelCase to snake_case in one place
   - keep optimistic updates and the existing write queue with retry (one write per row at a time)
   - upsert in chunks for bulk work like the first-run import (about 195 problems and 29 revisions)
4. Keep a localStorage cache of the last loaded data, so the app opens instantly and shows data offline. Persist pending writes and flush them when back online. Refetch when the window regains focus, or use Supabase realtime, so my laptop and phone stay in sync.
5. Empty account: show the existing first-run import review screen. Settings → "Restore from backup" must accept the `.json` backup exported from the old version and load it into Supabase.
6. Add `.env.example` and make sure `.env` is gitignored. Never put the `service_role` key in frontend code.

**Done when**
- [ ] I can sign up, import, rate a problem, reload, and the data is still there
- [ ] Restoring my old backup `.json` brings back my ratings and history
- [ ] Two browser windows signed in to the same account show the same data after a refocus
- [ ] Tests still pass

---

## Phase 3: Design system and dashboard

Read the **Design Spec** at the end of this file in full. Then:

1. Build the shared design system: tokens for both themes, typography, and the core components (buttons, cards, pills, inputs, tables, dialogs, side panel, toasts, chart theme).
2. Create the mountain artwork (see Artwork).
3. Rebuild the dashboard to the spec, and restyle the sign-in page with the artwork.

**STOP**: show me screenshots of the dashboard in Dawn and Dusk at desktop width and at phone width (390px). Wait for my feedback before Phase 4.

**Done when**
- [ ] Every dashboard number matches what it showed before the redesign
- [ ] Both themes switch correctly, including System
- [ ] Text passes WCAG AA contrast in both themes

---

## Phase 4: Redesign the other pages

Redesign one page at a time, following the Pages section of the spec: Problem Bank, Today's Revision (with Focus mode), Mixed Practice and its session and summary screens, Patterns and pattern detail, Analytics, Yet to Learn, Revision History, Settings, and the add/edit/rating dialogs and problem side panel.

After each page, check that all of its existing features still work (filters, bulk actions, CSV import and export, quick rating, undo, session flow, backup and restore), then commit.

**Done when**
- [ ] Every page matches the spec in both themes, at desktop and phone width
- [ ] No feature from before the redesign is missing
- [ ] Tests pass

---

## Phase 5: Installable app (PWA)

1. Add `vite-plugin-pwa`: manifest name "RecodeX", standalone display, theme colours from the design tokens, and icons at all required sizes, derived from the RecodeX brand mark.
2. Add a service worker that caches the app shell, plus an "Update available, reload" prompt when a new version is deployed.
3. Add an "Install app" button in Settings using `beforeinstallprompt`, hidden once installed.

**Done when**
- [ ] Lighthouse reports the app as installable
- [ ] It installs from Chrome/Edge on Windows and from Chrome on Android, and opens in its own window

---

## Phase 6: Deploy

**STOP**: ask me to create an empty GitHub repo, then push to it.

1. Walk me through connecting the repo to Vercel and adding the two env vars.
2. Tell me which Supabase Auth redirect URLs to add (localhost and the Vercel URL).
3. The app uses hash routing, so no SPA rewrites should be needed. Confirm this.

**Done when**
- [ ] The Vercel URL loads, I can sign in, and my data appears
- [ ] Pushing to `main` redeploys automatically

---

## Phase 7: Final testing and docs

1. Write a Playwright smoke test: sign in, import, rate a problem, run a mixed session to its summary, open Analytics, switch theme.
2. Write a README covering local setup, Supabase setup, deployment, installing the app, and backup and restore.
3. Give me a short list of anything left undone or worth improving later.

---

# Design Spec: "The Journey to Mastery"

## Philosophy

RecodeX is a personal training ground for lifelong problem-solving mastery that I open every day, not a generic SaaS dashboard. It should feel calm, warm and motivating, like early morning in the mountains. Elegant and sustainable over flashy: no XP, points, levels or badge spam, and no heavy glows or gradients on every card. It must stay useful after years of use and thousands of problems.

## Themes

Two themes from one token system, switchable in Settings (System / Dawn / Dusk). **Default: Dawn.**

| Token | Dawn (light) | Dusk (dark) |
|---|---|---|
| Background | `#F6F4FB` | `#0B1020` |
| Cards | `#FFFFFF` | `#171B38` |
| Borders | `#E6E2F0` | `#262B52` |
| Text | `#1A1D3A` | `#ECEEF8` |
| Muted text | `#636887` | `#9AA0C3` |
| Accent | `#6A4BD1` | `#7655D9` (`#9D85F0` for accent-coloured text) |

## Colour meanings

Each colour means one thing. Never use these decoratively in the UI.

| Colour | Meaning |
|---|---|
| Green `#35C98A` | Green rating, mastered |
| Gold `#FFC857` | Yellow rating |
| Red `#F0565B` | Red rating, failed recall |
| Grey `#8B90AD` | Not reviewed |
| Sunrise orange `#FF963D` | Overdue, high priority, needs attention |
| Purple accent | Buttons, links, selection, focus rings |

- The sunrise gradient (orange to gold) appears only in the hero artwork, the lifetime mastery ring and the streak flame.
- On Dawn, use darker shades of green, gold and orange for text and pills so they pass WCAG AA.

## Typography

- A characterful but readable display face for headings and big numbers, a clean body face, and a mono face for IDs and timers. All from Google Fonts. Not Inter, not Space Grotesk.
- Tabular numbers in all stats and tables.

## Artwork

- Create original layered SVG mountain-sunrise illustrations in an anime-inspired painterly style: 4–6 silhouette ridges with atmospheric depth, a sky gradient and a sun.
- Do not copy any studio's or artist's work, and do not use images from the web. If I later add images to `/public/art`, use them instead.
- The sky follows my local time: dawn colours in the morning, bright day, warm dusk in the evening, a starry night sky late at night.
- Use artwork only on the dashboard hero, the sign-in page, the Yet to Learn roadmap, empty states and the session-complete screen.

## Dashboard

- **Hero**: compact, about 240px tall on desktop, not full screen. Mountain sunrise, the headline "Recode. Revise. Reinforce. Repeat. Master.", a greeting using the time of day and my display name (add a display-name field in Settings), and today's quote.
- **Today's mission**: due + overdue count, the daily target, and a large "Start revision" button, visible without scrolling.
- **Lifetime mastery**: a ring showing the % of all problems mastered, plus totals for problems, reviewed, due, overdue and mastered.
- **Journey roadmap**: a winding trail up the mountain with one camp per pattern, in pattern order. Each camp fills by that pattern's mastery %, shows weak counts on hover or tap, and opens the pattern on click. It must stay readable with 30+ patterns (scroll or collapse).
- Weekly consistency, current and longest streak, and pattern mastery bars.
- **Quick actions**: Mixed Practice, Weakness Challenge, Add Problem.
- **Quotes**: a curated list of about 60 short quotes on learning, practice and persistence, with accurate, verifiable attributions only. One per day, chosen by date.
- Motivating, but keep at least the information density of the current dashboard.

## Pages

- **Problem Bank**: a clean, premium library with compact rows, filters, pattern tags, inline quick rating and the detail side panel. Must stay fast with 5,000+ problems (pagination or virtualization, filtering in Supabase where needed).
- **Today's Revision**: keep the grouped list with inline rating. Make **Focus mode** the primary action: one problem at a time, a large timer, rating controls, a clear progress bar, and a calm, distraction-free layout.
- **Mixed Practice**: an "arena" feel for session configuration, difficulty, pattern mixing and the performance summary. Keep every existing option and preset.
- **Patterns**: mastery cards with completion progress, weak (Red/Yellow) counts, overdue counts and a sub-pattern breakdown.
- **Analytics**: polished charts, a 52-week consistency heatmap, long-term progress (week, month and year ranges), pattern comparisons, and the milestone list.
- **Yet to Learn**: unstudied topics as a visual learning roadmap (base camp to summit) with the existing learning / learned / activate controls.
- **Revision History**: a chronological timeline grouped by day, showing each problem's rating changes (for example Red → Yellow → Green), with the existing filters.

## Lifetime milestones

- Permanent milestones only: first problem mastered; 50, 100, 250, 500 and 1000 mastered; each pattern fully mastered; 7, 30, 100 and 365-day streaks.
- Show a short, tasteful celebration when one is reached. Store the date it was reached and list them quietly in Analytics.

## Global

- A consistent sidebar on desktop, a top bar plus drawer on mobile, fully responsive down to 360px wide.
- Micro-interactions for completing a rating, finishing a session, reaching the daily target and milestones.
- Subtle page transitions (fade or slide, 150–200ms). Respect `prefers-reduced-motion`.
- Visible keyboard focus and readable text everywhere.
