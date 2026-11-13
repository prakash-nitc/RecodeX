# RecodeX

> **The Journey to Mastery** — A calm, motivating training ground for lifelong problem-solving mastery with spaced repetition.

RecodeX is built with **React 18 + TypeScript + Vite + Tailwind CSS + Lucide + date-fns**, backed by **Supabase** (with offline-first IndexedDB caching) and packaged as an installable **Progressive Web App (PWA)**.

---

## Features

- **The Journey to Mastery Design**: Two cohesive themes — **Dawn** (light, default) and **Dusk** (dark) — adhering to strict semantic colour rules, Fraunces display typography, and WCAG AA contrast.
- **Mountain Sunrise Artwork**: Original procedural artwork that follows your local time (dawn, day, dusk, starry night).
- **Spaced Repetition Engine**: Red (1d), Yellow (3d), and Green ladder (7d → 14d → 30d → 60d) with customizable intervals and automatic phase progression (Reconstruction → Recall/Repair → Quick Recall).
- **Focus Mode**: Distraction-free, full-screen session runner with one problem at a time, keyboard controls (`1`/`2`/`3` to rate, `Enter` to save, `S` to skip, `P` to pause), and a large timer.
- **Problem Bank**: Filterable, sortable library with compact views, quick inline ratings, and full details drawer.
- **Today's Focus that explains itself**: every queued problem says which rule put it there ("Red on 2 Nov · 1-day interval · due 3 Nov").
- **Mixed Practice Arena**: three presets (Daily Mixed Revision, Weakness Challenge, Overdue Recovery) plus fully custom sessions, with round-robin pattern interleaving. Each pattern's page starts a Pattern Mastery session.
- **Week in review**: what improved, slipped or was mastered this week, and what is one Green from mastery.
- **52-Week Consistency Heatmap & Analytics**: lightweight SVG charts, monthly comparisons, streak counters, and lifetime milestones awarded as you reach them.
- **Exports**: problem bank and full revision history as CSV; complete JSON backup and restore.
- **Yet to Learn Roadmap**: Visual trail from Base Camp to the Summit for tracking unstudied topics; marking a topic learned moves its problems into revision.
- **Installable PWA**: Works offline, installable on desktop (Chrome / Edge) and mobile (Android / iOS), with service worker caching and update notifications.

---

## Local Setup

### 1. Prerequisites

- **Node.js**: v18+ (v20+ recommended)
- **npm**: v9+

### 2. Installation

```bash
# Clone the repository
git clone https://github.com/prakash-nitc/RecodeX.git
cd RecodeX

# Install dependencies
npm install
```

### 3. Development

```bash
# Run local dev server (default on http://localhost:5173)
npm run dev

# Run TypeScript typecheck
npm run typecheck

# Run unit tests (engine, dates, CSV, schema, contrast)
npm test

# Build production bundle and service worker
npm run build

# Preview production build locally
npm run preview
```

*Note: Without `.env`, the app automatically runs in local offline mode using `localStorage`.*

---

## Supabase Setup

RecodeX uses Supabase for database storage, row-level security (RLS), and authentication.

### 1. Create a Project

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. Note your **Project URL** and **anon / public key** from **Project Settings → API**.

### 2. Configure Environment Variables

Create `.env` in the project root (refer to `.env.example`):

```bash
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

> **Security Note:** Never expose the `service_role` secret key in client-side code or `.env`.

### 3. Apply Database Migration

1. In your Supabase Dashboard, open the **SQL Editor**.
2. Run the migration script located at `supabase/migrations/20261107000000_init.sql`.
3. This creates:
   - `patterns`, `problems`, `revisions`, `sessions`, and `user_meta` tables
   - Row-level security (RLS) policies ensuring users only view and mutate their own records

### 4. Auth & Redirect Configuration

1. In Supabase Dashboard, navigate to **Authentication → URL Configuration**.
2. Set **Site URL** to your deployed URL (or `http://localhost:5173/` during local testing).
3. Under **Redirect URLs**, add:
   - `http://localhost:5173/**`
   - `http://localhost:5174/**`
   - `https://your-app-name.vercel.app/**` (once deployed)

---

## Deployment (Vercel)

RecodeX uses **hash routing** (`#dashboard`, `#today`, `#bank`, etc.), so no special SPA rewrite rules or server redirects are required.

### Deploying to Vercel:

1. Push your repository to GitHub: `https://github.com/prakash-nitc/RecodeX.git`.
2. Go to [vercel.com](https://vercel.com) and click **Add New → Project**.
3. Import your `RecodeX` GitHub repository.
4. Keep the default build settings:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. In the **Environment Variables** section, add:
   - `VITE_SUPABASE_URL`: Your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY`: Your Supabase anon public key
6. Click **Deploy**.
7. Once deployed, copy your production Vercel URL and add it to your Supabase **Redirect URLs** (e.g. `https://your-recodex.vercel.app/**`).

---

## Installing the App (PWA)

RecodeX is an installable PWA that opens in its own window:

- **Desktop (Google Chrome / Microsoft Edge)**:
  - Click the install icon in the browser address bar, or
  - Navigate to **Settings** within RecodeX and click **Install RecodeX**.
- **Android (Chrome)**:
  - Tap the three-dot menu `⋮` and select **Add to Home screen** / **Install app**, or click the **Install app** button in Settings.
- **iOS / iPadOS (Safari)**:
  - Tap the **Share** button (`⎙`) in Safari and choose **Add to Home Screen**.

---

## Backup & Restore

### Full JSON Backup
- **Export**: Navigate to **Settings → Data** and click **Download backup (.json)**. This creates a timestamped JSON file containing all problems, revisions, sessions, patterns, and settings.
- **Restore**: Click **Restore from backup** and select a previous `.json` backup file. Restoring safely replaces local data with the backed-up state.

### CSV Import & Export
- **Export CSV**: Export all problems as a clean CSV file suitable for spreadsheets.
- **Import CSV**: Import new problems or update existing ones in bulk with automatic duplicate detection.

---

## Architecture & Code Structure

- `src/types.ts`: Domain models (`Problem`, `Pattern`, `Revision`, `Session`, `Settings`).
- `src/lib/engine.ts`: Revision scheduling logic, intervals, streak calculation, priority suggestions, and session generation.
- `src/lib/store.ts`: Reactive state store with optimistic updates and IndexedDB persistence.
- `src/lib/supabase/`: Supabase client integration, snake_case mapping, offline write queue, and synchronization.
- `src/components/ui.tsx`: Reusable design system components (buttons, dialogs, cards, pills, ratings, rings).
- `src/components/art/`: Anime-inspired procedural SVG mountain sunrise artwork.
- `src/pages/`: Redesigned pages (`Dashboard`, `Today`, `ProblemBank`, `Practice`, `Patterns`, `Analytics`, `Learn`, `History`, `Settings`, `Session`).

---

## License

Personal project — All rights reserved.
