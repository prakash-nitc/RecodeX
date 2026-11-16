-- Previous-mistake verification on a revision: did the mistake from the revision before come back
-- ('repeated') or was it avoided without help ('avoided')? Null when it was not answered.
alter table public.revisions
  add column if not exists mistake_check text check (mistake_check in ('repeated', 'avoided'));
