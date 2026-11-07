-- Supabase / PostgreSQL schema for the DSA Revision Manager.
-- The shipped app stores the same records in its private Artifact database (src/lib/backend.ts);
-- a Supabase backend implements the same Backend interface against these tables.

create type rating as enum ('green', 'yellow', 'red');
create type revision_phase as enum ('Reconstruction', 'Recall/Repair', 'Quick Recall');
create type priority as enum ('High', 'Medium', 'Low');
create type difficulty as enum ('Easy', 'Medium', 'Hard');
create type learning_state as enum ('active', 'yet_to_learn', 'learning', 'completed');
create type track as enum ('active', 'backlog');
create type session_status as enum ('in_progress', 'completed', 'abandoned');

create table patterns (
  id           text primary key,
  user_id      uuid not null references auth.users on delete cascade,
  name         text not null,
  sort_order   int  not null default 0,
  description  text not null default '',
  learning     learning_state not null default 'active',
  sub_patterns text[] not null default '{}',
  created_at   timestamptz not null default now(),
  unique (user_id, name)
);

create table problems (
  id                text primary key,
  user_id           uuid not null references auth.users on delete cascade,
  num               int  not null,                       -- human-facing Problem ID (#101)
  pattern_id        text not null references patterns on delete restrict,
  name              text not null,
  sub_pattern       text not null default '',
  difficulty        difficulty not null default 'Medium',
  url               text not null default '',
  priority          priority not null default 'Medium',
  track             track not null default 'active',
  last_rating       rating,
  last_revised      date,
  next_review       date,
  phase             revision_phase not null default 'Reconstruction',
  phase_manual      boolean not null default false,
  consecutive_green int not null default 0,
  revision_count    int not null default 0,
  weakness          text not null default '',
  notes             text not null default '',
  learned_at        date,
  imported_name     text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (user_id, num),
  check ((last_rating is null) = (last_revised is null))
);
create index problems_due on problems (user_id, next_review) where track = 'active';
create unique index problems_url on problems (user_id, lower(url), pattern_id) where url <> '';

create table practice_sessions (
  id          text primary key,
  user_id     uuid not null references auth.users on delete cascade,
  kind        text not null,
  title       text not null,
  config      jsonb,
  problem_ids text[] not null,
  position    int not null default 0,
  status      session_status not null default 'in_progress',
  elapsed_sec int not null default 0,
  started_at  timestamptz not null default now(),
  ended_at    timestamptz
);

-- Append-only: one row per revision, never updated.
create table revisions (
  id           text primary key,
  user_id      uuid not null references auth.users on delete cascade,
  problem_id   text not null references problems on delete cascade,
  session_id   text references practice_sessions on delete set null,
  revised_on   date not null,
  revised_at   timestamptz not null default now(),
  rating       rating not null,
  phase        revision_phase not null,
  time_min     numeric,
  independent  boolean,
  mistake      text not null default '',
  notes        text not null default '',
  source       text not null check (source in ('import', 'quick', 'today', 'session')),
  next_review  date not null,
  prev_state   jsonb                                    -- snapshot used to undo the latest revision
);
create index revisions_by_problem on revisions (problem_id, revised_at);
create index revisions_by_day on revisions (user_id, revised_on);

create table session_results (
  session_id  text not null references practice_sessions on delete cascade,
  problem_id  text not null references problems on delete cascade,
  outcome     text not null check (outcome in ('rated', 'skipped')),
  rating      rating,
  time_sec    int not null default 0,
  revision_id text references revisions on delete set null,
  primary key (session_id, problem_id)
);

create table user_settings (
  user_id   uuid primary key references auth.users on delete cascade,
  settings  jsonb not null,
  next_num  int not null default 101
);

alter table patterns enable row level security;
alter table problems enable row level security;
alter table revisions enable row level security;
alter table practice_sessions enable row level security;
alter table user_settings enable row level security;
create policy own_patterns on patterns using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_problems on problems using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_revisions on revisions using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_sessions on practice_sessions using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_settings on user_settings using (user_id = auth.uid()) with check (user_id = auth.uid());
